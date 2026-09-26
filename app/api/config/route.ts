import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";

// Configuración del negocio - solo admin, igual que la categoría
// "Negocio" en Configuracion.tsx del escritorio (nombre, tasa del día,
// secciones ocultas, y ahora también RIF/dirección/teléfono). Métodos de
// pago, Usuarios y Tema quedan afuera de esta primera versión para Kaxa
// Móvil.
export async function PATCH(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion || sesion.rol !== "ADMIN") return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const body = await req.json();
  const db = clienteTurso(negocio.turso_url, negocio.turso_token);

  const campos: string[] = [];
  const valores: (string | number | null)[] = [];

  if (typeof body.nombre_negocio === "string" && body.nombre_negocio.trim()) {
    campos.push("nombre_negocio = ?");
    valores.push(body.nombre_negocio.trim());
  }
  if (typeof body.tasa_cambio_dia === "number" && body.tasa_cambio_dia > 0) {
    campos.push("tasa_cambio_dia = ?");
    valores.push(body.tasa_cambio_dia);
  }
  if (Array.isArray(body.secciones_ocultas)) {
    campos.push("secciones_ocultas = ?");
    valores.push(JSON.stringify(body.secciones_ocultas));
  }
  if (typeof body.rif_negocio === "string") {
    campos.push("rif_negocio = ?");
    valores.push(body.rif_negocio.trim() || null);
  }
  if (typeof body.direccion_negocio === "string") {
    campos.push("direccion_negocio = ?");
    valores.push(body.direccion_negocio.trim() || null);
  }
  if (typeof body.telefono_negocio === "string") {
    campos.push("telefono_negocio = ?");
    valores.push(body.telefono_negocio.trim() || null);
  }

  if (campos.length === 0) return NextResponse.json({ error: "Nada para guardar." }, { status: 400 });

  await db.execute({ sql: `UPDATE config SET ${campos.join(", ")} WHERE id = 1`, args: valores });
  return NextResponse.json({ ok: true });
}
