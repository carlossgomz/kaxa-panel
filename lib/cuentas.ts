import { randomUUID } from "crypto";
import { createClient, type Client } from "@libsql/client";

// Cuentas del panel: viven en la misma base "directorio" que la tabla
// negocios (ver lib/directorio.ts), porque son datos de la PLATAFORMA
// (quién puede entrar a qué negocio), no datos de un negocio en
// particular. Una cuenta (un email) se puede vincular a varios negocios
// — y un negocio puede tener varias cuentas vinculadas, cada una con su
// propio rol — para casos como Day Express, donde el papá, la mamá y
// Carlos entran cada uno con su propio login.
let directorio: Client | null = null;
function obtenerDirectorio(): Client {
  if (!directorio) {
    directorio = createClient({
      url: process.env.KAXA_DIRECTORIO_URL!,
      authToken: process.env.KAXA_DIRECTORIO_TOKEN!
    });
  }
  return directorio;
}

export type Cuenta = { id: string; email: string; nombre: string; password_hash: string };
export type NegocioVinculado = { slug: string; negocio: string; rol: string };
export type CuentaVinculada = { cuentaId: string; email: string; nombre: string; rol: string };

function emailNormalizado(email: string): string {
  return email.trim().toLowerCase();
}

export async function buscarCuentaPorEmail(email: string): Promise<Cuenta | null> {
  const r = await obtenerDirectorio().execute({
    sql: "SELECT id, email, nombre, password_hash FROM cuentas WHERE email = ?",
    args: [emailNormalizado(email)]
  });
  const fila = r.rows[0];
  if (!fila) return null;
  return { id: String(fila.id), email: String(fila.email), nombre: String(fila.nombre), password_hash: String(fila.password_hash) };
}

// Devuelve el error tal cual para mostrarlo — el único caso posible acá
// es el email repetido (UNIQUE en la columna), así que no hace falta
// distinguir más que eso.
export async function crearCuenta(email: string, nombre: string, passwordHash: string): Promise<{ id: string } | { error: string }> {
  const existente = await buscarCuentaPorEmail(email);
  if (existente) return { error: "Ya existe una cuenta con ese email." };
  const id = randomUUID();
  await obtenerDirectorio().execute({
    sql: "INSERT INTO cuentas (id, email, nombre, password_hash) VALUES (?, ?, ?, ?)",
    args: [id, emailNormalizado(email), nombre.trim(), passwordHash]
  });
  return { id };
}

export async function negociosDeCuenta(cuentaId: string): Promise<NegocioVinculado[]> {
  const r = await obtenerDirectorio().execute({
    sql: `SELECT cn.slug, n.negocio, cn.rol
          FROM cuenta_negocio cn JOIN negocios n ON n.slug = cn.slug
          WHERE cn.cuenta_id = ?
          ORDER BY n.negocio`,
    args: [cuentaId]
  });
  return r.rows.map((f) => ({ slug: String(f.slug), negocio: String(f.negocio), rol: String(f.rol) }));
}

// Quién ya está vinculado a un negocio — para la pantalla de Cuentas
// dentro del panel (solo ADMIN, ver app/panel/cuentas).
export async function cuentasVinculadas(slug: string): Promise<CuentaVinculada[]> {
  const r = await obtenerDirectorio().execute({
    sql: `SELECT c.id, c.email, c.nombre, cn.rol
          FROM cuenta_negocio cn JOIN cuentas c ON c.id = cn.cuenta_id
          WHERE cn.slug = ?
          ORDER BY c.nombre`,
    args: [slug]
  });
  return r.rows.map((f) => ({ cuentaId: String(f.id), email: String(f.email), nombre: String(f.nombre), rol: String(f.rol) }));
}

// Vincula una cuenta YA REGISTRADA (por email) a un negocio. El slug lo
// tiene que resolver quien llama a partir de la SESIÓN del admin que está
// vinculando (nunca de un dato que mande el cliente) — si no, cualquiera
// podría vincularse a mano a un negocio ajeno solo adivinando el slug.
export async function vincularCuenta(email: string, slug: string, rol: string): Promise<{ ok: true } | { error: string }> {
  const cuenta = await buscarCuentaPorEmail(email);
  if (!cuenta) return { error: "No existe ninguna cuenta registrada con ese email — primero tiene que crearla en /registro." };
  await obtenerDirectorio().execute({
    sql: `INSERT INTO cuenta_negocio (cuenta_id, slug, rol) VALUES (?, ?, ?)
          ON CONFLICT (cuenta_id, slug) DO UPDATE SET rol = excluded.rol`,
    args: [cuenta.id, slug, rol]
  });
  return { ok: true };
}

export async function desvincularCuenta(cuentaId: string, slug: string): Promise<void> {
  await obtenerDirectorio().execute({
    sql: "DELETE FROM cuenta_negocio WHERE cuenta_id = ? AND slug = ?",
    args: [cuentaId, slug]
  });
}
