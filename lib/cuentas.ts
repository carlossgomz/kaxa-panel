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

async function vincularCuentaId(cuentaId: string, slug: string, rol: string): Promise<void> {
  await obtenerDirectorio().execute({
    sql: `INSERT INTO cuenta_negocio (cuenta_id, slug, rol) VALUES (?, ?, ?)
          ON CONFLICT (cuenta_id, slug) DO UPDATE SET rol = excluded.rol`,
    args: [cuentaId, slug, rol]
  });
}

export async function desvincularCuenta(cuentaId: string, slug: string): Promise<void> {
  await obtenerDirectorio().execute({
    sql: "DELETE FROM cuenta_negocio WHERE cuenta_id = ? AND slug = ?",
    args: [cuentaId, slug]
  });
}

// --- Invitaciones: el campo de email es OPCIONAL y hace tres cosas
// distintas según el caso:
//  1. Email de una cuenta que YA existe → se vincula al toque, sin link.
//  2. Email de alguien que todavía no se registró → link de un solo uso
//     ATADO A ESE EMAIL (aunque se reenvíe o se filtre, solo lo puede
//     completar esa persona).
//  3. Sin email (no se sabe quién se va a registrar todavía) → link
//     "abierto": quien lo reciba se registra con el correo que quiera y
//     queda vinculado igual, sin restricción de email.
// En los tres casos el slug/creadoPor los resuelve quien llama a partir
// de la sesión del admin (nunca un dato que mande el cliente), y el
// token es la única prueba de que alguien fue invitado por un admin de
// ESE negocio — por eso es impredecible (randomUUID) y de un solo uso.
export type Invitacion = { token: string; slug: string; negocio: string; rol: string; email: string | null; expiraAt: string };
export type ResultadoInvitar = { vinculadoDirecto: true; negocio: string; rol: string } | { vinculadoDirecto: false; token: string };

const DIAS_EXPIRACION_INVITACION = 7;

export async function invitarOVincular(email: string | null, slug: string, negocio: string, rol: string, creadoPor: string): Promise<ResultadoInvitar> {
  if (email) {
    const cuenta = await buscarCuentaPorEmail(email);
    if (cuenta) {
      await vincularCuentaId(cuenta.id, slug, rol);
      return { vinculadoDirecto: true, negocio, rol };
    }
  }
  const token = randomUUID();
  const expiraAt = new Date(Date.now() + DIAS_EXPIRACION_INVITACION * 24 * 3600 * 1000).toISOString();
  await obtenerDirectorio().execute({
    sql: "INSERT INTO invitaciones (token, slug, rol, email, creado_por, expira_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [token, slug, rol, email ? emailNormalizado(email) : null, creadoPor, expiraAt]
  });
  return { vinculadoDirecto: false, token };
}

// Invitaciones pendientes (todavía no usadas ni vencidas) de un negocio —
// para mostrarlas en Cuentas con opción de revocarlas.
export async function invitacionesPendientes(slug: string): Promise<Invitacion[]> {
  const r = await obtenerDirectorio().execute({
    sql: `SELECT i.token, i.slug, n.negocio, i.rol, i.email, i.expira_at
          FROM invitaciones i JOIN negocios n ON n.slug = i.slug
          WHERE i.slug = ? AND i.usado_por IS NULL AND i.expira_at > datetime('now')
          ORDER BY i.creado_at DESC`,
    args: [slug]
  });
  return r.rows.map((f) => ({
    token: String(f.token),
    slug: String(f.slug),
    negocio: String(f.negocio),
    rol: String(f.rol),
    email: f.email == null ? null : String(f.email),
    expiraAt: String(f.expira_at)
  }));
}

export async function revocarInvitacion(token: string, slug: string): Promise<void> {
  await obtenerDirectorio().execute({
    sql: "DELETE FROM invitaciones WHERE token = ? AND slug = ?",
    args: [token, slug]
  });
}

export async function buscarInvitacionValida(token: string): Promise<{ slug: string; negocio: string; rol: string; email: string | null } | null> {
  const r = await obtenerDirectorio().execute({
    sql: `SELECT i.slug, n.negocio, i.rol, i.email
          FROM invitaciones i JOIN negocios n ON n.slug = i.slug
          WHERE i.token = ? AND i.usado_por IS NULL AND i.expira_at > datetime('now')`,
    args: [token]
  });
  const f = r.rows[0];
  if (!f) return null;
  return { slug: String(f.slug), negocio: String(f.negocio), rol: String(f.rol), email: f.email == null ? null : String(f.email) };
}

// Consume la invitación y vincula de una — el UPDATE con "usado_por IS
// NULL" en el WHERE es lo que hace que sea de un solo uso incluso si dos
// pedidos llegan casi al mismo tiempo (el segundo actualiza 0 filas y se
// entera de que ya se usó). Si la invitación tiene un email asignado,
// tiene que coincidir con el que se usó para registrarse — si no,
// cualquiera que consiga el link podría registrarse con SU PROPIO email
// y quedar vinculado igual. Si NO tiene email asignado (link abierto),
// no hay nada que comparar: vale para cualquier email.
export async function usarInvitacion(token: string, cuentaId: string, emailRegistrado: string): Promise<{ slug: string; negocio: string; rol: string } | null> {
  const invitacion = await buscarInvitacionValida(token);
  if (!invitacion) return null;
  if (invitacion.email !== null && invitacion.email !== emailNormalizado(emailRegistrado)) return null;
  const r = await obtenerDirectorio().execute({
    sql: "UPDATE invitaciones SET usado_por = ?, usado_at = datetime('now') WHERE token = ? AND usado_por IS NULL",
    args: [cuentaId, token]
  });
  if (r.rowsAffected === 0) return null;
  await vincularCuentaId(cuentaId, invitacion.slug, invitacion.rol);
  return invitacion;
}
