import { redirect } from "next/navigation";
import { obtenerSesion, type Sesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";

// Repetido al principio de cada página del panel (sesión → negocio → db) —
// centralizado acá para no repetir las mismas 6 líneas y el mismo redirect
// a /login en cada page.tsx nuevo.
export async function obtenerContexto() {
  const sesion = obtenerSesion();
  if (!sesion) redirect("/login");

  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) redirect("/login");

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  return { sesion: sesion as Sesion, negocio, db };
}

// Cuentas por pagar, ajustes de factura, etc. son solo para el dueño/admin
// — igual que esAdmin en el programa de escritorio (Cuentas.tsx). Un cajero
// que entre a esas rutas rebota al inicio del panel.
export async function exigirAdmin() {
  const ctx = await obtenerContexto();
  if (ctx.sesion.rol !== "ADMIN") redirect("/panel");
  return ctx;
}
