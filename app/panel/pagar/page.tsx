import Link from "next/link";
import { exigirAdmin } from "@/lib/contexto";

type ProveedorDeudor = {
  proveedor_id: string;
  proveedor_nombre: string;
  total_pendiente_usd: number;
  num_facturas: number;
};

export default async function PagarPage() {
  const { db } = await exigirAdmin();

  // Misma consulta que CuentasPorPagar en Cuentas.tsx del escritorio.
  const [config, proveedoresRes] = await Promise.all([
    db.execute("SELECT tasa_cambio_dia FROM config WHERE id = 1"),
    db.execute(
      `SELECT pr.id as proveedor_id, pr.nombre as proveedor_nombre,
              SUM(fc.monto_total_usd - fc.monto_pagado_usd) as total_pendiente_usd,
              COUNT(*) as num_facturas
       FROM facturas_compra fc
       JOIN proveedores pr ON pr.id = fc.proveedor_id
       WHERE fc.estado != 'PAGADA'
       GROUP BY pr.id
       ORDER BY total_pendiente_usd DESC`
    ),
  ]);

  const tasa = Number(config.rows[0]?.tasa_cambio_dia ?? 1) || 1;
  const proveedores = proveedoresRes.rows.map((r) => ({
    proveedor_id: String(r.proveedor_id),
    proveedor_nombre: String(r.proveedor_nombre),
    total_pendiente_usd: Number(r.total_pendiente_usd),
    num_facturas: Number(r.num_facturas),
  })) as ProveedorDeudor[];

  const totalUsd = proveedores.reduce((acc, p) => acc + p.total_pendiente_usd, 0);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Cuentas por pagar</h1>
      <p className="text-sm text-gray-500 mb-6">
        Lo que le debes a tus proveedores — el Bs se calcula a la tasa de hoy ({tasa.toFixed(2)} Bs/$).
      </p>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-5 mb-4">
        <p className="text-sm text-gray-500">Total pendiente</p>
        <p className="text-2xl font-semibold mt-1">USD {totalUsd.toFixed(2)}</p>
        <p className="text-sm text-kaxa-600 font-medium">Bs {(totalUsd * tasa).toFixed(2)}</p>
      </div>

      <div className="flex flex-col gap-2">
        {proveedores.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No le debes a ningún proveedor ahora.</p>
        )}
        {proveedores.map((p) => (
          <Link
            key={p.proveedor_id}
            href={`/panel/pagar/${p.proveedor_id}`}
            className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 flex items-center justify-between transition-transform active:scale-[0.98]"
          >
            <div>
              <p className="font-medium">{p.proveedor_nombre}</p>
              <p className="text-xs text-gray-400">
                {p.num_facturas} {p.num_facturas === 1 ? "factura pendiente" : "facturas pendientes"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-kaxa-700">USD {p.total_pendiente_usd.toFixed(2)}</p>
              <p className="text-xs text-gray-400">Bs {(p.total_pendiente_usd * tasa).toFixed(2)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
