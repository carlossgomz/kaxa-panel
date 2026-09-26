import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sesion = obtenerSesion();
  if (!sesion || sesion.rol !== "ADMIN") return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const { nombre, rif, direccion, telefono } = await req.json();
  if (!nombre?.trim() || !rif?.trim()) {
    return NextResponse.json({ error: "El nombre y el RIF son obligatorios." }, { status: 400 });
  }

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  try {
    await db.execute({
      sql: "UPDATE proveedores SET nombre = ?, rif = ?, direccion = ?, telefono = ? WHERE id = ?",
      args: [nombre.trim(), rif.trim(), direccion?.trim() || null, telefono?.trim() || null, params.id],
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar (¿RIF repetido?): ${String(e)}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// Mismo chequeo que eliminarProveedor en Proveedores.tsx del escritorio:
// no se puede borrar si tiene facturas de compra (se perdería el
// historial real) - codigos_proveedor_producto sí se limpia, es memoria
// descartable.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const sesion = obtenerSesion();
  if (!sesion || sesion.rol !== "ADMIN") return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  const proveedorRes = await db.execute({ sql: "SELECT nombre FROM proveedores WHERE id = ?", args: [params.id] });
  const proveedor = proveedorRes.rows[0];
  if (!proveedor) return NextResponse.json({ error: "Proveedor no encontrado." }, { status: 404 });

  const conteo = await db.execute({ sql: "SELECT COUNT(*) as total FROM facturas_compra WHERE proveedor_id = ?", args: [params.id] });
  if (Number(conteo.rows[0]?.total ?? 0) > 0) {
    return NextResponse.json(
      { error: `"${proveedor.nombre}" tiene facturas de compra registradas — no se puede eliminar sin perder ese historial.` },
      { status: 400 }
    );
  }

  await db.execute({ sql: "DELETE FROM codigos_proveedor_producto WHERE proveedor_id = ?", args: [params.id] });
  await db.execute({ sql: "DELETE FROM proveedores WHERE id = ?", args: [params.id] });

  return NextResponse.json({ ok: true });
}
