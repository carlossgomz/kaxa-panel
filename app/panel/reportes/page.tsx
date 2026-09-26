import Link from "next/link";
import { exigirAdmin } from "@/lib/contexto";
import ReportesFiltro from "./ReportesFiltro";

// Mismo producto "placeholder" del recargo de delivery que ya excluyen
// Estadisticas.tsx y /panel (Inicio) del escritorio - no es un producto
// real, así que no debería aparecer en ningún ranking.
const PRODUCTO_DELIVERY_ID = "f195fbac-103d-48fa-a27a-28371fba7745";

function hoyISO() {
  // America/Caracas, UTC-4 fijo.
  return new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
}

function primerDiaMesISO() {
  const hoy = new Date(Date.now() - 4 * 3600 * 1000);
  return `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export default async function ReportesPage({ searchParams }: { searchParams: { desde?: string; hasta?: string } }) {
  const { db } = await exigirAdmin();

  const desde = searchParams.desde || primerDiaMesISO();
  const hasta = searchParams.hasta || hoyISO();

  const [config, totales, gananciaRes, porMetodo, masVendidos, masGanancia] = await Promise.all([
    db.execute("SELECT tasa_cambio_dia FROM config WHERE id = 1"),

    db.execute({
      sql: `SELECT COALESCE(SUM(total_bs), 0) as total_bs, COUNT(*) as num_ventas
            FROM ventas WHERE date(fecha_hora) BETWEEN ? AND ?`,
      args: [desde, hasta],
    }),

    // Ganancia estimada: precio de venta menos el costo ACTUAL del
    // producto (no el histórico de cuando se vendió) convertido a la tasa
    // de esa venta - misma fórmula que Reportes.tsx del escritorio, por
    // eso "estimada" y no exacta.
    db.execute({
      sql: `SELECT COALESCE(SUM(vi.cantidad * (vi.precio_unit_bs - p.costo_actual_usd * v.tasa_cambio_dia)), 0) as ganancia_bs
            FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id JOIN productos p ON p.id = vi.producto_id
            WHERE date(v.fecha_hora) BETWEEN ? AND ?`,
      args: [desde, hasta],
    }),

    // Monto por método viene de pagos.monto_bs (lo que realmente se cobró
    // por cada método) - así siempre coincide con Cuadre de Caja, incluso
    // con pagos divididos.
    db.execute({
      sql: `SELECT pg.metodo, SUM(pg.monto_bs) as monto_bs
            FROM pagos pg JOIN ventas v ON v.id = pg.venta_id
            WHERE date(v.fecha_hora) BETWEEN ? AND ?
            GROUP BY pg.metodo ORDER BY monto_bs DESC`,
      args: [desde, hasta],
    }),

    // Un producto por peso cuenta como 1 línea vendida, no como los kilos
    // que pesó esa venta - mezclar kilos con unidades no tiene sentido en
    // este ranking (igual que en Estadisticas.tsx del escritorio).
    db.execute({
      sql: `SELECT p.nombre, SUM(CASE WHEN p.por_peso = 1 THEN 1 ELSE vi.cantidad END) as cantidad
            FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id JOIN productos p ON p.id = vi.producto_id
            WHERE date(v.fecha_hora) BETWEEN ? AND ? AND p.id != ?
            GROUP BY vi.producto_id ORDER BY cantidad DESC LIMIT 5`,
      args: [desde, hasta, PRODUCTO_DELIVERY_ID],
    }),

    db.execute({
      sql: `SELECT p.nombre, SUM(vi.cantidad * (vi.precio_unit_bs - p.costo_actual_usd * v.tasa_cambio_dia)) as ganancia_bs
            FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id JOIN productos p ON p.id = vi.producto_id
            WHERE date(v.fecha_hora) BETWEEN ? AND ? AND p.id != ?
            GROUP BY vi.producto_id ORDER BY ganancia_bs DESC LIMIT 5`,
      args: [desde, hasta, PRODUCTO_DELIVERY_ID],
    }),
  ]);

  const tasa = Number(config.rows[0]?.tasa_cambio_dia ?? 1) || 1;
  const totalBs = Number(totales.rows[0]?.total_bs ?? 0);
  const numVentas = Number(totales.rows[0]?.num_ventas ?? 0);
  const gananciaBs = Number(gananciaRes.rows[0]?.ganancia_bs ?? 0);
  const ticketPromedioBs = numVentas > 0 ? totalBs / numVentas : 0;

  const metodos = porMetodo.rows.map((r) => ({ metodo: String(r.metodo), monto_bs: Number(r.monto_bs) }));
  const productosTop = masVendidos.rows.map((r) => ({ nombre: String(r.nombre), cantidad: Number(r.cantidad) }));
  const productosGanancia = masGanancia.rows.map((r) => ({ nombre: String(r.nombre), ganancia_bs: Number(r.ganancia_bs) }));

  const hoy = hoyISO();
  const rangos = [
    { label: "Hoy", desde: hoy, hasta: hoy },
    { label: "Este mes", desde: primerDiaMesISO(), hasta: hoy },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Reportes</h1>
      <p className="text-sm text-gray-500 mb-4">Cómo le fue a tu negocio en el período elegido.</p>

      <div className="flex gap-2 mb-3">
        {rangos.map((r) => (
          <Link
            key={r.label}
            href={`/panel/reportes?desde=${r.desde}&hasta=${r.hasta}`}
            className="text-sm px-3 py-1.5 rounded-full border border-kaxa-100 bg-white text-kaxa-700 font-medium active:bg-kaxa-50"
          >
            {r.label}
          </Link>
        ))}
      </div>

      <ReportesFiltro desde={desde} hasta={hasta} />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Total vendido</p>
          <p className="text-lg font-semibold mt-1">Bs {totalBs.toLocaleString("es-VE", { maximumFractionDigits: 0 })}</p>
          <p className="text-sm text-kaxa-600 font-medium">${(totalBs / tasa).toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Ganancia estimada</p>
          <p className="text-lg font-semibold mt-1">Bs {gananciaBs.toLocaleString("es-VE", { maximumFractionDigits: 0 })}</p>
          <p className="text-sm text-kaxa-600 font-medium">${(gananciaBs / tasa).toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">N.º de ventas</p>
          <p className="text-lg font-semibold mt-1">{numVentas}</p>
        </div>
        <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Ticket promedio</p>
          <p className="text-lg font-semibold mt-1">Bs {ticketPromedioBs.toLocaleString("es-VE", { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
        <h2 className="font-semibold mb-2">Ventas por método de pago</h2>
        {metodos.length === 0 && <p className="text-sm text-gray-400 py-2">Sin ventas en este período.</p>}
        <div className="flex flex-col gap-1.5">
          {metodos.map((m) => (
            <div key={m.metodo} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{m.metodo.split("_").join(" ")}</span>
              <span className="font-medium">Bs {m.monto_bs.toLocaleString("es-VE", { maximumFractionDigits: 0 })}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
        <h2 className="font-semibold mb-2">Productos más vendidos</h2>
        {productosTop.length === 0 && <p className="text-sm text-gray-400 py-2">Sin ventas en este período.</p>}
        <div className="flex flex-col gap-1.5">
          {productosTop.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-600 truncate pr-2">{p.nombre}</span>
              <span className="font-medium shrink-0">{p.cantidad} vendidos</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
        <h2 className="font-semibold mb-2">Productos que más ganancia generan</h2>
        {productosGanancia.length === 0 && <p className="text-sm text-gray-400 py-2">Sin ventas en este período.</p>}
        <div className="flex flex-col gap-1.5">
          {productosGanancia.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-600 truncate pr-2">{p.nombre}</span>
              <span className="font-medium shrink-0">Bs {p.ganancia_bs.toLocaleString("es-VE", { maximumFractionDigits: 0 })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
