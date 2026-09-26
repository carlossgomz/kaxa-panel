import { exigirAdmin } from "@/lib/contexto";
import MovimientosClient from "./MovimientosClient";

export default async function MovimientosPage() {
  const { db } = await exigirAdmin();
  const res = await db.execute(
    `SELECT m.id, m.producto_id, p.nombre as producto_nombre, m.tipo, m.cantidad, m.motivo, m.created_at
     FROM movimientos_inventario m JOIN productos p ON p.id = m.producto_id
     ORDER BY m.created_at DESC LIMIT 50`
  );
  const movimientos = res.rows.map((r) => ({
    id: String(r.id),
    producto_id: String(r.producto_id),
    producto_nombre: String(r.producto_nombre),
    tipo: String(r.tipo),
    cantidad: Number(r.cantidad),
    motivo: r.motivo == null ? null : String(r.motivo),
    created_at: String(r.created_at),
  }));

  return <MovimientosClient movimientosIniciales={movimientos} />;
}
