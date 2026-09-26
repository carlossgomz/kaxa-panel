import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";

// Lista de TODOS los proveedores activos — a diferencia de /panel/pagar
// (solo los que ya tienen deuda pendiente), acá hace falta cualquiera,
// para elegirlo al armar una factura de compra nueva.
export async function GET() {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  const res = await db.execute("SELECT id, nombre FROM proveedores WHERE activo = 1 ORDER BY nombre");
  const proveedores = res.rows.map((r) => ({ id: String(r.id), nombre: String(r.nombre) }));
  return NextResponse.json({ proveedores });
}

// Crear un proveedor nuevo desde la pantalla de Compras — mismos campos y
// misma validación (nombre + rif obligatorios) que el formulario de
// escritorio en Compras.tsx.
export async function POST(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const { nombre, rif, direccion, telefono } = await req.json();
  if (!nombre?.trim() || !rif?.trim()) {
    return NextResponse.json({ error: "El nombre y el RIF son obligatorios." }, { status: 400 });
  }

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  const id = crypto.randomUUID();
  try {
    await db.execute({
      sql: "INSERT INTO proveedores (id, nombre, rif, direccion, telefono) VALUES (?, ?, ?, ?, ?)",
      args: [id, nombre.trim(), rif.trim(), direccion?.trim() || null, telefono?.trim() || null],
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo crear el proveedor (¿el RIF ya existe?): ${String(e)}` }, { status: 400 });
  }

  return NextResponse.json({ id, nombre: nombre.trim() });
}
