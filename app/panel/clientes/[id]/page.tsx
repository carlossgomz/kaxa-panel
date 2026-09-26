import { notFound } from "next/navigation";
import { obtenerContexto } from "@/lib/contexto";
import ClienteFichaClient from "./ClienteFichaClient";

export default async function ClienteFichaPage({ params }: { params: { id: string } }) {
  const { db } = await obtenerContexto();

  const clienteRes = await db.execute({
    sql: "SELECT id, nombre, cedula, telefono, direccion, cliente_app_id, credito_autorizado, es_empleado FROM clientes WHERE id = ?",
    args: [params.id],
  });
  const fila = clienteRes.rows[0];
  if (!fila) notFound();

  const [saldoRes, historialRes] = await Promise.all([
    db.execute({
      sql: "SELECT COALESCE(SUM(monto_pendiente_usd), 0) as total FROM ventas WHERE cliente_cedula = ? AND estado = 'CREDITO_PENDIENTE'",
      args: [String(fila.cedula)],
    }),
    db.execute({
      sql: "SELECT id, numero_ticket, fecha_hora, total_bs, estado FROM ventas WHERE cliente_cedula = ? ORDER BY fecha_hora DESC LIMIT 50",
      args: [String(fila.cedula)],
    }),
  ]);

  const cliente = {
    id: String(fila.id),
    nombre: String(fila.nombre),
    cedula: String(fila.cedula),
    telefono: fila.telefono == null ? null : String(fila.telefono),
    direccion: fila.direccion == null ? null : String(fila.direccion),
    cliente_app_id: fila.cliente_app_id == null ? null : String(fila.cliente_app_id),
    credito_autorizado: Number(fila.credito_autorizado),
    es_empleado: Number(fila.es_empleado),
  };

  const historial = historialRes.rows.map((r) => ({
    id: String(r.id),
    numero_ticket: String(r.numero_ticket),
    fecha_hora: String(r.fecha_hora),
    total_bs: Number(r.total_bs),
    estado: String(r.estado),
  }));

  return <ClienteFichaClient cliente={cliente} saldoPendienteUsd={Number(saldoRes.rows[0]?.total ?? 0)} historial={historial} />;
}
