import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerContexto } from "@/lib/contexto";
import NavTabs from "@/components/NavTabs";

export default async function FacturaDetallePage({ params }: { params: { id: string } }) {
  const { sesion, db } = await obtenerContexto();

  const [ventaRes, itemsRes, pagosRes] = await Promise.all([
    db.execute({
      sql: `SELECT numero_ticket, fecha_hora, cliente_nombre, cliente_cedula, cliente_direccion,
                   vendedor_nombre, subtotal_bs, iva_bs, total_bs, estado, tasa_cambio_dia, monto_pendiente_usd
            FROM ventas WHERE id = ?`,
      args: [params.id],
    }),
    db.execute({
      sql: `SELECT p.nombre as producto_nombre, vi.cantidad, vi.precio_unit_bs, vi.subtotal_bs
            FROM venta_items vi JOIN productos p ON p.id = vi.producto_id
            WHERE vi.venta_id = ?`,
      args: [params.id],
    }),
    db.execute({
      sql: "SELECT metodo, monto_bs, referencia, verificado_admin FROM pagos WHERE venta_id = ?",
      args: [params.id],
    }),
  ]);

  const venta = ventaRes.rows[0];
  if (!venta) notFound();

  const items = itemsRes.rows.map((r) => ({
    producto_nombre: String(r.producto_nombre),
    cantidad: Number(r.cantidad),
    precio_unit_bs: Number(r.precio_unit_bs),
    subtotal_bs: Number(r.subtotal_bs),
  }));
  const pagos = pagosRes.rows.map((r) => ({
    metodo: String(r.metodo),
    monto_bs: Number(r.monto_bs),
    referencia: r.referencia ? String(r.referencia) : null,
    verificado_admin: Number(r.verificado_admin ?? 0),
  }));

  return (
    <main className="min-h-screen px-4 py-8 pb-28 max-w-md mx-auto">
      <Link href="/panel/facturas" className="text-sm text-kaxa-600 mb-4 inline-block">
        ← Facturas
      </Link>
      <h1 className="text-xl font-semibold mb-1">{String(venta.numero_ticket)}</h1>
      <p className="text-sm text-gray-500 mb-1">
        {new Date(String(venta.fecha_hora).replace(" ", "T")).toLocaleString("es-VE")}
      </p>
      <p className="text-sm text-gray-500 mb-1">Vendedor: {venta.vendedor_nombre ? String(venta.vendedor_nombre) : "sin especificar"}</p>
      <p className="text-sm text-gray-500 mb-6">
        Cliente: {venta.cliente_nombre ? `${venta.cliente_nombre} (${venta.cliente_cedula})` : "Consumidor final"}
      </p>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
        <h2 className="font-semibold mb-2 text-sm">Productos</h2>
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>
                {it.cantidad} × {it.producto_nombre}
              </span>
              <span className="font-medium">Bs {it.subtotal_bs.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-kaxa-100 mt-3 pt-3 flex flex-col gap-1 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>Bs {Number(venta.subtotal_bs).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>IVA</span>
            <span>Bs {Number(venta.iva_bs).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span>Bs {Number(venta.total_bs).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
        <h2 className="font-semibold mb-2 text-sm">Pagos</h2>
        <div className="flex flex-col gap-2">
          {pagos.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>
                {p.metodo === "CREDITO" ? "Crédito pendiente" : p.metodo.split("_").join(" ")}
                {p.referencia ? ` (${p.referencia})` : ""}
              </span>
              <span className="font-medium">Bs {p.monto_bs.toFixed(2)}</span>
            </div>
          ))}
          {pagos.length === 0 && <p className="text-sm text-gray-400">Sin pagos registrados.</p>}
        </div>
        {venta.monto_pendiente_usd != null && Number(venta.monto_pendiente_usd) > 0 && (
          <p className="text-sm text-red-600 font-medium mt-3">
            Saldo pendiente: USD {Number(venta.monto_pendiente_usd).toFixed(2)}
          </p>
        )}
      </div>

      <NavTabs rol={sesion.rol} />
    </main>
  );
}
