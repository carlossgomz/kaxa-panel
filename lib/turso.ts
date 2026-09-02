import { createClient } from "@libsql/client";

// Conexión a la base de Turso de UN cliente en particular — url/token
// cambian según quién inició sesión, por eso no es un cliente fijo como
// lib/directorio.ts. Misma base y mismas tablas que ya usa el escritorio
// (src-tauri/src/db.rs, modo remoto), este panel solo LEE.
export function clienteTurso(url: string, authToken: string) {
  return createClient({ url, authToken });
}
