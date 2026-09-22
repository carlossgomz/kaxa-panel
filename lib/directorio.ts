import { createClient, type Client } from "@libsql/client";

// Base de Turso propia de Carlos (no de ningún cliente) que mapea el
// "código de negocio" que escribe cada dueño en el login contra las
// credenciales de SU base de Turso — así un solo deploy de este panel
// sirve a todos los clientes de Kaxa Avanzado. Ver
// licencias-tool/generar-licencia.bat para cómo se llena esta tabla.
//
// El cliente se crea recién en el primer uso (no al importar el módulo):
// crearlo a nivel de módulo hace que Next intente conectarse durante el
// build (p.ej. al analizar las rutas), cuando las variables de entorno
// todavía no están disponibles.
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

export type NegocioDirectorio = {
  slug: string;
  negocio: string;
  turso_url: string;
  turso_token: string;
  edicion: string;
  // Recargo por producto en delivery, en USD — solo Day Express lo tiene
  // (0.10), configurado acá en el directorio y no en el código
  // compartido, porque este panel se vende a otros clientes de Kaxa
  // Avanzado que no deben tenerlo.
  recargo_delivery_usd: number;
};

export async function buscarNegocio(slug: string): Promise<NegocioDirectorio | null> {
  const resultado = await obtenerDirectorio().execute({
    sql: "SELECT slug, negocio, turso_url, turso_token, edicion, recargo_delivery_usd FROM negocios WHERE slug = ?",
    args: [slug.trim().toLowerCase()]
  });
  const fila = resultado.rows[0];
  if (!fila) return null;
  return {
    slug: fila.slug as string,
    negocio: fila.negocio as string,
    turso_url: fila.turso_url as string,
    turso_token: fila.turso_token as string,
    edicion: fila.edicion as string,
    recargo_delivery_usd: Number(fila.recargo_delivery_usd ?? 0)
  };
}
