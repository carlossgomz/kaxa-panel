import { exigirAdmin } from "@/lib/contexto";
import { formatearStock } from "@/lib/precios";
import StockPendienteClient from "./StockPendienteClient";

export default async function StockPendientePage() {
  const { db } = await exigirAdmin();

  // Misma consulta que listar_ventas_stock_pendiente en
  // src-tauri/src/comandos.rs - acá siempre la vista de admin (ve todas,
  // de cualquier vendedor), no la de cajero (que solo ve las suyas y deja
  // una nota) - Kaxa Móvil es la vía del dueño, no de la caja física.
  const res = await db.execute(
    `SELECT vi.id, v.numero_ticket, v.fecha_hora, v.vendedor_nombre, p.nombre as producto_nombre,
            vi.cantidad, vi.stock_disponible_al_vender, vi.nota_cajero
     FROM venta_items vi
     JOIN ventas v ON v.id = vi.venta_id
     JOIN productos p ON p.id = vi.producto_id
     WHERE vi.stock_insuficiente = 1 AND vi.revisado_admin = 0
     ORDER BY v.fecha_hora DESC`
  );

  const items = res.rows.map((r) => ({
    id: String(r.id),
    numero_ticket: String(r.numero_ticket),
    fecha_hora: String(r.fecha_hora),
    vendedor_nombre: r.vendedor_nombre == null ? null : String(r.vendedor_nombre),
    producto_nombre: String(r.producto_nombre),
    cantidad_vendida: formatearStock(Number(r.cantidad)),
    stock_disponible: formatearStock(Number(r.stock_disponible_al_vender ?? 0)),
    nota_cajero: r.nota_cajero == null ? null : String(r.nota_cajero),
  }));

  return <StockPendienteClient itemsIniciales={items} />;
}
