import Link from "next/link";
import { exigirAdmin } from "@/lib/contexto";

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  PENDIENTE: { texto: "Pendiente", clase: "bg-amber-50 text-amber-700" },
  PARCIAL: { texto: "Abono parcial", clase: "bg-amber-50 text-amber-700" },
  PAGADA: { texto: "Pagada", clase: "bg-green-50 text-green-700" },
};

export default async function ComprasPage() {
  const { db } = await exigirAdmin();

  // Últimas facturas de compra registradas, con el nombre del proveedor —
  // solo para tener a la vista lo que se cargó recientemente, no busca
  // reemplazar el historial completo de escritorio.
  const res = await db.execute(
    `SELECT fc.id, fc.numero_factura, fc.fecha, fc.moneda, fc.monto_total_usd, fc.estado, pr.nombre as proveedor_nombre
     FROM facturas_compra fc JOIN proveedores pr ON pr.id = fc.proveedor_id
     ORDER BY fc.fecha DESC LIMIT 30`
  );

  const facturas = res.rows.map((r) => ({
    id: String(r.id),
    numero_factura: String(r.numero_factura),
    fecha: String(r.fecha),
    moneda: String(r.moneda),
    monto_total_usd: Number(r.monto_total_usd),
    estado: String(r.estado),
    proveedor_nombre: String(r.proveedor_nombre),
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Compras</h1>
      <p className="text-sm text-gray-500 mb-4">Registra la mercancía que recibes de tus proveedores.</p>

      <Link
        href="/panel/compras/nueva"
        className="block w-full text-center rounded-lg bg-kaxa-600 text-white font-medium py-3 mb-6 transition-transform active:scale-[0.98]"
      >
        + Nueva factura de compra
      </Link>

      <h2 className="font-semibold mb-2">Últimas facturas</h2>
      <div className="flex flex-col gap-2">
        {facturas.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Todavía no registraste ninguna compra.</p>
        )}
        {facturas.map((f) => {
          const estado = ESTADOS[f.estado] ?? { texto: f.estado, clase: "bg-gray-50 text-gray-600" };
          return (
            <div key={f.id} className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{f.proveedor_nombre}</p>
                <p className="text-xs text-gray-400">
                  Factura {f.numero_factura} · {new Date(f.fecha.replace(" ", "T")).toLocaleDateString("es-VE")}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">USD {f.monto_total_usd.toFixed(2)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${estado.clase}`}>{estado.texto}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
