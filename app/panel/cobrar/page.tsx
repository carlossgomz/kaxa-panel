import Link from "next/link";
import { obtenerContexto } from "@/lib/contexto";
import NavTabs from "@/components/NavTabs";

type ClienteDeudor = {
  cliente_nombre: string;
  cliente_cedula: string;
  total_pendiente_usd: number;
  num_ventas: number;
};

export default async function CobrarPage() {
  const { sesion, db } = await obtenerContexto();

  // Misma consulta que CuentasPorCobrar en Cuentas.tsx del escritorio.
  const [config, clientesRes] = await Promise.all([
    db.execute("SELECT tasa_cambio_dia FROM config WHERE id = 1"),
    db.execute(
      `SELECT v.cliente_nombre, v.cliente_cedula,
              SUM(v.monto_pendiente_usd) as total_pendiente_usd,
              COUNT(*) as num_ventas
       FROM ventas v
       WHERE v.estado = 'CREDITO_PENDIENTE'
       GROUP BY v.cliente_cedula
       ORDER BY total_pendiente_usd DESC`
    ),
  ]);

  const tasa = Number(config.rows[0]?.tasa_cambio_dia ?? 1) || 1;
  const clientes = clientesRes.rows.map((r) => ({
    cliente_nombre: String(r.cliente_nombre),
    cliente_cedula: String(r.cliente_cedula),
    total_pendiente_usd: Number(r.total_pendiente_usd),
    num_ventas: Number(r.num_ventas),
  })) as ClienteDeudor[];

  const totalUsd = clientes.reduce((acc, c) => acc + c.total_pendiente_usd, 0);

  return (
    <main className="min-h-screen px-4 py-8 pb-28 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-1">Cuentas por cobrar</h1>
      <p className="text-sm text-gray-500 mb-6">
        Lo que te deben tus clientes a crédito — el Bs se calcula a la tasa de hoy ({tasa.toFixed(2)} Bs/$).
      </p>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-5 mb-4">
        <p className="text-sm text-gray-500">Total pendiente</p>
        <p className="text-2xl font-semibold mt-1">USD {totalUsd.toFixed(2)}</p>
        <p className="text-sm text-kaxa-600 font-medium">Bs {(totalUsd * tasa).toFixed(2)}</p>
      </div>

      <div className="flex flex-col gap-2">
        {clientes.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Ningún cliente tiene deuda pendiente ahora.</p>
        )}
        {clientes.map((c) => (
          <Link
            key={c.cliente_cedula}
            href={`/panel/cobrar/${encodeURIComponent(c.cliente_cedula)}`}
            className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 flex items-center justify-between"
          >
            <div>
              <p className="font-medium">{c.cliente_nombre}</p>
              <p className="text-xs text-gray-400">
                {c.cliente_cedula} · {c.num_ventas} {c.num_ventas === 1 ? "venta pendiente" : "ventas pendientes"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-kaxa-700">USD {c.total_pendiente_usd.toFixed(2)}</p>
              <p className="text-xs text-gray-400">Bs {(c.total_pendiente_usd * tasa).toFixed(2)}</p>
            </div>
          </Link>
        ))}
      </div>

      <NavTabs rol={sesion.rol} />
    </main>
  );
}
