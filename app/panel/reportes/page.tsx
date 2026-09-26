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

// Paleta fija para gráficos — se repite en ciclo si hay más filas que
// colores (ej. un negocio con muchos métodos de pago propios agregados).
const COLORES = ["#16A37C", "#F5A623", "#3B82F6", "#EC4899", "#8B5CF6", "#EF4444"];

// Gráfico de torta hecho con conic-gradient — nada de librerías ni SVG a
// mano, un solo div con el fondo calculado basta.
function fondoTorta(datos: { valor: number }[]): string {
  const total = datos.reduce((a, d) => a + d.valor, 0) || 1;
  let acumulado = 0;
  const tramos = datos.map((d, i) => {
    const inicio = (acumulado / total) * 100;
    acumulado += d.valor;
    const fin = (acumulado / total) * 100;
    return `${COLORES[i % COLORES.length]} ${inicio}% ${fin}%`;
  });
  return `conic-gradient(${tramos.join(", ")})`;
}

function GraficoTorta({ datos, formato }: { datos: { etiqueta: string; valor: number }[]; formato: (n: number) => string }) {
  const total = datos.reduce((a, d) => a + d.valor, 0);
  return (
    <div className="flex items-center gap-4">
      <div className="w-24 h-24 rounded-full shrink-0" style={{ background: fondoTorta(datos) }} />
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        {datos.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORES[i % COLORES.length] }} />
            <span className="text-gray-600 dark:text-gray-300 truncate flex-1">{d.etiqueta}</span>
            <span className="font-medium shrink-0">{total > 0 ? Math.round((d.valor / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
      <p className="sr-only">{datos.map((d) => `${d.etiqueta}: ${formato(d.valor)}`).join(", ")}</p>
    </div>
  );
}

// Barra horizontal con relleno proporcional al máximo de la lista — más
// llamativo que una fila de número contra número.
function BarraHorizontal({ etiqueta, valor, max, color, sufijo }: { etiqueta: string; valor: number; max: number; color: string; sufijo: string }) {
  const pct = max > 0 ? Math.max(4, (valor / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline gap-2 mb-1">
        <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{etiqueta}</span>
        <span className="text-xs font-semibold shrink-0">{sufijo}</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 dark:bg-[#0d1210] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default async function ReportesPage({ searchParams }: { searchParams: { desde?: string; hasta?: string } }) {
  const { db } = await exigirAdmin();

  const desde = searchParams.desde || primerDiaMesISO();
  const hasta = searchParams.hasta || hoyISO();

  const [config, totales, gananciaRes, porMetodo, masVendidos, masGanancia, clientesFrecuentesRes, categoriasRes, horasPicoRes] = await Promise.all([
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

    db.execute({
      sql: `SELECT v.cliente_nombre as nombre, COUNT(*) as num_compras, SUM(v.total_bs) as total_gastado_bs
            FROM ventas v WHERE date(v.fecha_hora) BETWEEN ? AND ? AND v.cliente_id IS NOT NULL
            GROUP BY v.cliente_id ORDER BY total_gastado_bs DESC LIMIT 5`,
      args: [desde, hasta],
    }),

    db.execute({
      sql: `SELECT COALESCE(c.nombre, 'Sin categoría') as categoria, SUM(vi.subtotal_bs) as monto_bs
            FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id JOIN productos p ON p.id = vi.producto_id
            LEFT JOIN categorias c ON c.id = p.categoria_id
            WHERE date(v.fecha_hora) BETWEEN ? AND ? AND p.id != ?
            GROUP BY categoria ORDER BY monto_bs DESC LIMIT 5`,
      args: [desde, hasta, PRODUCTO_DELIVERY_ID],
    }),

    // Sin LIMIT ni ORDER BY num_ventas acá — se completan las 24 horas
    // abajo (con 0 en las que no hubo ventas) para dibujar el histograma
    // completo del día, no solo las 3 puntas.
    db.execute({
      sql: `SELECT strftime('%H', fecha_hora) as hora, COUNT(*) as num_ventas
            FROM ventas WHERE date(fecha_hora) BETWEEN ? AND ?
            GROUP BY hora`,
      args: [desde, hasta],
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
  const clientesFrecuentes = clientesFrecuentesRes.rows.map((r) => ({
    nombre: String(r.nombre ?? "Consumidor final"),
    num_compras: Number(r.num_compras),
    total_gastado_bs: Number(r.total_gastado_bs),
  }));
  const categorias = categoriasRes.rows.map((r) => ({ categoria: String(r.categoria), monto_bs: Number(r.monto_bs) }));

  // Se completan las 24 horas del día (0 en las que no hubo ventas) para
  // dibujar el histograma entero, no solo picos sueltos.
  const ventasPorHora: Record<string, number> = {};
  for (const r of horasPicoRes.rows) ventasPorHora[String(r.hora)] = Number(r.num_ventas);
  const horas24 = Array.from({ length: 24 }, (_, h) => {
    const hh = String(h).padStart(2, "0");
    return { hora: hh, num_ventas: ventasPorHora[hh] ?? 0 };
  });
  const maxVentasHora = Math.max(1, ...horas24.map((h) => h.num_ventas));
  const horaPicoTop = horas24.reduce((a, b) => (b.num_ventas > a.num_ventas ? b : a), horas24[0]);

  const maxCantidadProducto = Math.max(1, ...productosTop.map((p) => p.cantidad));
  const maxGananciaProducto = Math.max(1, ...productosGanancia.map((p) => p.ganancia_bs));
  const maxGastadoCliente = Math.max(1, ...clientesFrecuentes.map((c) => c.total_gastado_bs));

  const hoy = hoyISO();
  const rangos = [
    { label: "Hoy", desde: hoy, hasta: hoy },
    { label: "Este mes", desde: primerDiaMesISO(), hasta: hoy },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Reportes</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Cómo le fue a tu negocio en el período elegido.</p>

      <div className="flex gap-2 mb-3">
        {rangos.map((r) => (
          <Link
            key={r.label}
            href={`/panel/reportes?desde=${r.desde}&hasta=${r.hasta}`}
            className="text-sm px-3 py-1.5 rounded-full border border-kaxa-100 dark:border-[#2a332e] bg-white dark:bg-[#141b18] text-kaxa-700 font-medium active:bg-kaxa-50 dark:active:bg-kaxa-900/30"
          >
            {r.label}
          </Link>
        ))}
      </div>

      <ReportesFiltro desde={desde} hasta={hasta} />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white dark:bg-[#141b18] rounded-2xl border border-kaxa-100 dark:border-[#2a332e] shadow-sm p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">💰 Total vendido</p>
          <p className="text-lg font-semibold mt-1">Bs {totalBs.toLocaleString("es-VE", { maximumFractionDigits: 0 })}</p>
          <p className="text-sm text-kaxa-600 font-medium">${(totalBs / tasa).toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-[#141b18] rounded-2xl border border-kaxa-100 dark:border-[#2a332e] shadow-sm p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">📈 Ganancia estimada</p>
          <p className="text-lg font-semibold mt-1">Bs {gananciaBs.toLocaleString("es-VE", { maximumFractionDigits: 0 })}</p>
          <p className="text-sm text-kaxa-600 font-medium">${(gananciaBs / tasa).toFixed(2)}</p>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-[#0d1210] overflow-hidden mt-2">
            <div
              className="h-full rounded-full bg-kaxa-400"
              style={{ width: `${totalBs > 0 ? Math.min(100, (gananciaBs / totalBs) * 100) : 0}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            margen {totalBs > 0 ? Math.round((gananciaBs / totalBs) * 100) : 0}%
          </p>
        </div>
        <div className="bg-white dark:bg-[#141b18] rounded-2xl border border-kaxa-100 dark:border-[#2a332e] shadow-sm p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">🧾 N.º de ventas</p>
          <p className="text-lg font-semibold mt-1">{numVentas}</p>
        </div>
        <div className="bg-white dark:bg-[#141b18] rounded-2xl border border-kaxa-100 dark:border-[#2a332e] shadow-sm p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">🎟️ Ticket promedio</p>
          <p className="text-lg font-semibold mt-1">Bs {ticketPromedioBs.toLocaleString("es-VE", { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#141b18] rounded-2xl border border-kaxa-100 dark:border-[#2a332e] shadow-sm p-4 mb-4">
        <h2 className="font-semibold mb-3">💳 Ventas por método de pago</h2>
        {metodos.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Sin ventas en este período.</p>
        ) : (
          <GraficoTorta
            datos={metodos.map((m) => ({ etiqueta: m.metodo.split("_").join(" "), valor: m.monto_bs }))}
            formato={(n) => `Bs ${n.toFixed(0)}`}
          />
        )}
      </div>

      <div className="bg-white dark:bg-[#141b18] rounded-2xl border border-kaxa-100 dark:border-[#2a332e] shadow-sm p-4 mb-4">
        <h2 className="font-semibold mb-3">🏆 Productos más vendidos</h2>
        {productosTop.length === 0 && <p className="text-sm text-gray-400 py-2">Sin ventas en este período.</p>}
        <div className="flex flex-col gap-2.5">
          {productosTop.map((p, i) => (
            <BarraHorizontal
              key={i}
              etiqueta={p.nombre}
              valor={p.cantidad}
              max={maxCantidadProducto}
              color={COLORES[i % COLORES.length]}
              sufijo={`${p.cantidad} vendidos`}
            />
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#141b18] rounded-2xl border border-kaxa-100 dark:border-[#2a332e] shadow-sm p-4 mb-4">
        <h2 className="font-semibold mb-3">💵 Productos que más ganancia generan</h2>
        {productosGanancia.length === 0 && <p className="text-sm text-gray-400 py-2">Sin ventas en este período.</p>}
        <div className="flex flex-col gap-2.5">
          {productosGanancia.map((p, i) => (
            <BarraHorizontal
              key={i}
              etiqueta={p.nombre}
              valor={p.ganancia_bs}
              max={maxGananciaProducto}
              color={COLORES[i % COLORES.length]}
              sufijo={`Bs ${p.ganancia_bs.toLocaleString("es-VE", { maximumFractionDigits: 0 })}`}
            />
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#141b18] rounded-2xl border border-kaxa-100 dark:border-[#2a332e] shadow-sm p-4 mb-4">
        <h2 className="font-semibold mb-3">🧑‍🤝‍🧑 Clientes frecuentes</h2>
        {clientesFrecuentes.length === 0 && <p className="text-sm text-gray-400 py-2">Sin compras de clientes identificados en este período.</p>}
        <div className="flex flex-col gap-2.5">
          {clientesFrecuentes.map((c, i) => (
            <BarraHorizontal
              key={i}
              etiqueta={`${c.nombre} (${c.num_compras})`}
              valor={c.total_gastado_bs}
              max={maxGastadoCliente}
              color={COLORES[i % COLORES.length]}
              sufijo={`Bs ${c.total_gastado_bs.toLocaleString("es-VE", { maximumFractionDigits: 0 })}`}
            />
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#141b18] rounded-2xl border border-kaxa-100 dark:border-[#2a332e] shadow-sm p-4 mb-4">
        <h2 className="font-semibold mb-3">🍰 Categorías más vendidas</h2>
        {categorias.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Sin ventas en este período.</p>
        ) : (
          <GraficoTorta
            datos={categorias.map((c) => ({ etiqueta: c.categoria, valor: c.monto_bs }))}
            formato={(n) => `Bs ${n.toFixed(0)}`}
          />
        )}
      </div>

      <div className="bg-white dark:bg-[#141b18] rounded-2xl border border-kaxa-100 dark:border-[#2a332e] shadow-sm p-4">
        <h2 className="font-semibold mb-1">⏰ Horas de mayor venta</h2>
        {numVentas === 0 ? (
          <p className="text-sm text-gray-400 py-2">Sin ventas en este período.</p>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-3">
              La hora más movida es <span className="font-semibold text-kaxa-600">{horaPicoTop.hora}:00</span>, con{" "}
              {horaPicoTop.num_ventas} venta{horaPicoTop.num_ventas === 1 ? "" : "s"}.
            </p>
            <div className="flex items-end gap-[3px] h-20">
              {horas24.map((h) => (
                <div key={h.hora} className="flex-1 h-full flex items-end">
                  <div
                    className={`w-full rounded-t ${h.hora === horaPicoTop.hora ? "bg-kaxa-600" : "bg-kaxa-100 dark:bg-kaxa-900/50"}`}
                    style={{ height: `${Math.max(3, (h.num_ventas / maxVentasHora) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 mt-1">
              <span>12am</span>
              <span>6am</span>
              <span>12pm</span>
              <span>6pm</span>
              <span>11pm</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
