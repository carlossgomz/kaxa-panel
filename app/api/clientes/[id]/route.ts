import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";

// Edita cualquier campo de un cliente ya existente — mismo criterio que
// los updates sueltos de Clientes.tsx del escritorio (nombre, cédula,
// teléfono, dirección, crédito autorizado, es empleado). Si cambia la
// cédula, también se actualizan sus ventas ya registradas (son una
// "foto" del momento, no una referencia viva) para no perder su
// historial — mismo comentario/lógica que actualizarCedula en el
// escritorio.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const body = await req.json();
  const db = clienteTurso(negocio.turso_url, negocio.turso_token);

  const clienteRes = await db.execute({ sql: "SELECT cedula FROM clientes WHERE id = ?", args: [params.id] });
  const clienteActual = clienteRes.rows[0];
  if (!clienteActual) return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });

  const campos: string[] = [];
  const valores: (string | number | null)[] = [];
  if (typeof body.nombre === "string" && body.nombre.trim()) {
    campos.push("nombre = ?");
    valores.push(body.nombre.trim());
  }
  if (typeof body.telefono === "string") {
    campos.push("telefono = ?");
    valores.push(body.telefono.trim() || null);
  }
  if (typeof body.direccion === "string") {
    campos.push("direccion = ?");
    valores.push(body.direccion.trim() || null);
  }
  if (typeof body.credito_autorizado === "number") {
    campos.push("credito_autorizado = ?");
    valores.push(body.credito_autorizado ? 1 : 0);
  }
  if (typeof body.es_empleado === "number") {
    campos.push("es_empleado = ?");
    valores.push(body.es_empleado ? 1 : 0);
  }

  const nuevaCedula = typeof body.cedula === "string" ? body.cedula.trim() : null;
  const cedulaCambio = nuevaCedula && nuevaCedula !== clienteActual.cedula;
  if (cedulaCambio) {
    campos.push("cedula = ?");
    valores.push(nuevaCedula);
  }

  if (campos.length === 0) return NextResponse.json({ ok: true });

  try {
    await db.execute({ sql: `UPDATE clientes SET ${campos.join(", ")} WHERE id = ?`, args: [...valores, params.id] });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar (¿cédula repetida?): ${String(e)}` }, { status: 400 });
  }

  if (cedulaCambio) {
    await db.execute({
      sql: "UPDATE ventas SET cliente_cedula = ? WHERE cliente_cedula = ?",
      args: [nuevaCedula, clienteActual.cedula],
    });
  }

  return NextResponse.json({ ok: true });
}
