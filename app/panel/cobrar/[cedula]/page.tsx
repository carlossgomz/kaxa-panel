import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerContexto } from "@/lib/contexto";
import NavTabs from "@/components/NavTabs";
import AbonoForm from "./AbonoForm";

type VentaCredito = {
  id: string;
  numero_ticket: string;
  fecha_hora: string;
  total_bs: number;
  monto_pendiente_usd: number;
};

export default async function ClienteCobrarPage({ params }: { params: { cedula: string } }) {
  const { sesion, db } = await obtenerContexto();
  const cedula = decodeURIComponent(params.cedula);

  const [config, clienteRes, ventasRes] = await Promise.all([
    db.execute("SELECT tasa_cambio_dia FROM config WHERE id = 1"),
    db.execute({
      sql: `SELECT cliente_nombre, SUM(monto_pendiente_usd) as total_pendiente_usd
            FROM ventas WHERE cliente_cedula = ? AND estado = 'CREDITO_PENDIENTE'
            GROUP BY cliente_cedula`,
      args: [cedula],
    }),
    db.execute({
      sql: `SELECT id, numero_ticket, fecha_hora, total_bs, monto_pendiente_usd
            FROM ventas WHERE cliente_cedula = ? AND estado = 'CREDITO_PENDIENTE'
            ORDER BY fecha_hora`,
      args: [cedula],
    }),
  ]);

  const filaCliente = clienteRes.rows[0];
  if (!filaCliente) notFound();

  const tasa = Number(config.rows[0]?.tasa_cambio_dia ?? 1) || 1;
  const nombreCliente = String(filaCliente.cliente_nombre);
  const totalPendienteUsd = Number(filaCliente.total_pendiente_usd);
  const ventas = ventasRes.rows.map((r) => ({
    id: String(r.id),
    numero_ticket: String(r.numero_ticket),
    fecha_hora: String(r.fecha_hora),
    total_bs: Number(r.total_bs),
    monto_pendiente_usd: Number(r.monto_pendiente_usd),
  })) as VentaCredito[];

  return (
    <main className="min-h-screen px-4 py-8 pb-28 max-w-md mx-auto">
      <Link href="/panel/cobrar" className="text-sm text-kaxa-600 mb-4 inline-block">
        ← Cuentas por cobrar
      </Link>
      <h1 className="text-xl font-semibold mb-1">{nombreCliente}</h1>
      <p className="text-sm text-gray-500 mb-6">{cedula}</p>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-5 mb-4">
        <p className="text-sm text-gray-500">Deuda total</p>
        <p className="text-2xl font-semibold mt-1">USD {totalPendienteUsd.toFixed(2)}</p>
        <p className="text-sm text-kaxa-600 font-medium">Bs {(totalPendienteUsd * tasa).toFixed(2)}</p>
      </div>

      <AbonoForm clienteCedula={cedula} totalPendienteUsd={totalPendienteUsd} tasaHoy={tasa} />

      <h2 className="font-semibold mt-6 mb-2">Ventas pendientes</h2>
      <div className="flex flex-col gap-2">
        {ventas.map((v) => (
          <div key={v.id} className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{v.numero_ticket}</p>
              <p className="text-xs text-gray-400">{new Date(v.fecha_hora.replace(" ", "T")).toLocaleDateString("es-VE")}</p>
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-400">Total: Bs {v.total_bs.toFixed(2)}</p>
              <p className="text-sm font-semibold text-kaxa-700">Debe USD {v.monto_pendiente_usd.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>

      <NavTabs rol={sesion.rol} />
    </main>
  );
}
