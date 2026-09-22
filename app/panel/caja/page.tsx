import { obtenerContexto } from "@/lib/contexto";
import CajaFecha from "./CajaFecha";

function hoyISO() {
  return new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
}

function monedaDeMetodo(metodo: string): "USD" | "BS" {
  return metodo === "DIVISAS" ? "USD" : "BS";
}

const METODOS_BASE = ["PUNTO_VENTA", "BIOPAGO", "PAGO_MOVIL", "EFECTIVO", "DIVISAS", "TRANSFERENCIA"];

// Réplica de solo-lectura de calcularEsperados() en CuadreCaja.tsx del
// escritorio — mismo cálculo exacto ("por qué" de cada fuente está
// documentado allá), pero acá no se puede contar/guardar el cierre: eso
// sigue siendo una acción física, en la tienda, con el efectivo en mano.
export default async function CajaPage({ searchParams }: { searchParams: { fecha?: string } }) {
  const { db } = await obtenerContexto();
  const fecha = searchParams.fecha || hoyISO();

  const [config, porVentaRes, porCobroRes, porAvanceCobroRes, porAvanceEfectivoRes, porAporteRes] = await Promise.all([
    db.execute("SELECT tasa_cambio_dia FROM config WHERE id = 1"),
    db.execute({
      sql: `SELECT p.metodo as metodo, SUM(p.monto_bs) as monto
            FROM pagos p JOIN ventas v ON v.id = p.venta_id
            WHERE date(v.fecha_hora) = ? AND p.metodo != 'CREDITO'
            GROUP BY p.metodo`,
      args: [fecha],
    }),
    db.execute({
      sql: `SELECT metodo, SUM(monto_bs) as monto FROM cobros_cliente
            WHERE date(created_at) = ? AND metodo != 'DESCUENTO_NOMINA'
            GROUP BY metodo`,
      args: [fecha],
    }),
    db.execute({
      sql: `SELECT metodo_cobro, SUM(monto_cobrado_bs) as monto FROM avances_efectivo WHERE date(created_at) = ? GROUP BY metodo_cobro`,
      args: [fecha],
    }),
    db.execute({
      sql: `SELECT SUM(monto_efectivo_bs) as monto FROM avances_efectivo WHERE date(created_at) = ?`,
      args: [fecha],
    }),
    db.execute({
      sql: `SELECT SUM(monto_bs) as monto FROM aportes_capital_externo WHERE date(created_at) = ?`,
      args: [fecha],
    }),
  ]);

  const tasa = Number(config.rows[0]?.tasa_cambio_dia ?? 1) || 1;

  const esperados: Record<string, number> = {};
  for (const r of porVentaRes.rows) esperados[String(r.metodo)] = (esperados[String(r.metodo)] ?? 0) + Number(r.monto);
  for (const r of porCobroRes.rows) {
    const m = r.metodo ? String(r.metodo) : "SIN_ESPECIFICAR";
    esperados[m] = (esperados[m] ?? 0) + Number(r.monto);
  }
  for (const r of porAvanceCobroRes.rows) esperados[String(r.metodo_cobro)] = (esperados[String(r.metodo_cobro)] ?? 0) + Number(r.monto);

  const aporteCapitalExterno = Number(porAporteRes.rows[0]?.monto ?? 0);
  const avanceEfectivo = Number(porAvanceEfectivoRes.rows[0]?.monto ?? 0);
  if (aporteCapitalExterno > 0 || avanceEfectivo > 0) {
    esperados.EFECTIVO = (esperados.EFECTIVO ?? 0) + aporteCapitalExterno - avanceEfectivo;
  }

  const metodos = Array.from(new Set([...METODOS_BASE, ...Object.keys(esperados)]));
  const filas = metodos.map((m) => ({ metodo: m, moneda: monedaDeMetodo(m), esperado: esperados[m] ?? 0 }));

  const filasBs = filas.filter((f) => f.moneda !== "USD");
  const filasUsd = filas.filter((f) => f.moneda === "USD");
  const totalBs = filasBs.reduce((a, f) => a + f.esperado, 0);
  const totalUsdNativo = filasUsd.reduce((a, f) => a + f.esperado / tasa, 0);
  const totalBolivares = filas.reduce((a, f) => a + f.esperado, 0);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Cuadre de caja</h1>
      <p className="text-sm text-gray-500 mb-4">
        Lo esperado en caja, calculado en vivo — el conteo físico se sigue haciendo desde el programa en la tienda.
      </p>

      <CajaFecha fecha={fecha} />

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-5 mb-4">
        <p className="text-sm text-gray-500">Total estimado en bolívares</p>
        <p className="text-2xl font-semibold mt-1">Bs {totalBolivares.toFixed(2)}</p>
        {filasUsd.length > 0 && <p className="text-xs text-gray-400 mt-1">Incluye USD {totalUsdNativo.toFixed(2)} en Divisas</p>}
      </div>

      <div className="flex flex-col gap-2">
        {filas.map((f) => {
          const esperadoNativo = f.moneda === "USD" ? f.esperado / tasa : f.esperado;
          const simbolo = f.moneda === "USD" ? "$" : "Bs";
          return (
            <div key={f.metodo} className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 flex items-center justify-between">
              <p className="font-medium">{f.metodo.split("_").join(" ")}</p>
              <p className="text-sm font-semibold text-kaxa-700">
                {simbolo} {esperadoNativo.toFixed(2)}
              </p>
            </div>
          );
        })}
      </div>

      {(aporteCapitalExterno > 0 || avanceEfectivo > 0) && (
        <p className="text-xs text-gray-400 mt-3">
          Efectivo incluye +Bs {aporteCapitalExterno.toFixed(2)} de aportes de capital externo y −Bs {avanceEfectivo.toFixed(2)} entregados en avances.
        </p>
      )}
    </div>
  );
}
