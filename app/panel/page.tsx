import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";

async function totalPeriodo(db: ReturnType<typeof clienteTurso>, condicionFecha: string) {
  const r = await db.execute(
    `SELECT COALESCE(SUM(total_bs), 0) as total FROM ventas WHERE ${condicionFecha}`
  );
  return Number(r.rows[0]?.total ?? 0);
}

// Variación contra el período anterior equivalente — null cuando no hay
// base de comparación (el período anterior dio 0), para no mostrar un
// "+∞%" sin sentido.
function variacion(actual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return ((actual - anterior) / anterior) * 100;
}

type ProductoTop = { nombre: string; cantidad: number };

export default async function PanelPage() {
  const sesion = obtenerSesion();
  if (!sesion) redirect("/login");

  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) redirect("/login");

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);

  const [
    config,
    hoyBs,
    ayerBs,
    semanaBs,
    semanaAnteriorBs,
    mesBs,
    mesAnteriorBs,
    deuda,
    productoTop
  ] = await Promise.all([
    db.execute("SELECT tasa_cambio_dia, nombre_negocio FROM config WHERE id = 1"),
    totalPeriodo(db, "date(fecha_hora) = date('now')"),
    totalPeriodo(db, "date(fecha_hora) = date('now', '-1 day')"),
    totalPeriodo(db, "date(fecha_hora) >= date('now', '-6 days')"),
    totalPeriodo(db, "date(fecha_hora) BETWEEN date('now', '-13 days') AND date('now', '-7 days')"),
    totalPeriodo(db, "strftime('%Y-%m', fecha_hora) = strftime('%Y-%m', 'now')"),
    totalPeriodo(db, "strftime('%Y-%m', fecha_hora) = strftime('%Y-%m', 'now', '-1 month')"),
    // Mismo criterio que Cuentas.tsx del programa: monto_pendiente_usd ya
    // está en dólares, no hace falta convertirlo.
    db.execute("SELECT COALESCE(SUM(monto_pendiente_usd), 0) as total FROM ventas WHERE estado = 'CREDITO_PENDIENTE'"),
    // Producto más vendido del mes — mismo criterio que Estadisticas.tsx:
    // un producto por peso cuenta como 1 línea, no como los kilos que
    // pesó esa venta (mezclar kilos con unidades no tiene sentido acá).
    // Se excluye el mismo producto "placeholder" del recargo de delivery
    // (código de barra 1111111, legado de antes de la integración) que ya
    // excluye Estadisticas.tsx — no es un producto real.
    db.execute(
      `SELECT p.nombre,
              SUM(CASE WHEN p.por_peso = 1 THEN 1 ELSE vi.cantidad END) as cantidad
       FROM venta_items vi
       JOIN ventas v ON v.id = vi.venta_id
       JOIN productos p ON p.id = vi.producto_id
       WHERE strftime('%Y-%m', v.fecha_hora) = strftime('%Y-%m', 'now')
         AND vi.producto_id != 'f195fbac-103d-48fa-a27a-28371fba7745'
       GROUP BY vi.producto_id
       ORDER BY cantidad DESC
       LIMIT 1`
    )
  ]);

  const tasa = Number(config.rows[0]?.tasa_cambio_dia ?? 1) || 1;
  const nombreNegocio = (config.rows[0]?.nombre_negocio as string) ?? negocio.negocio;
  const deudaUsd = Number(deuda.rows[0]?.total ?? 0);
  const filaTop = productoTop.rows[0];
  const top: ProductoTop | undefined = filaTop
    ? { nombre: String(filaTop.nombre), cantidad: Number(filaTop.cantidad) }
    : undefined;

  const tarjetas = [
    { titulo: "Hoy", bs: hoyBs, variacion: variacion(hoyBs, ayerBs), comparacion: "vs. ayer" },
    { titulo: "Últimos 7 días", bs: semanaBs, variacion: variacion(semanaBs, semanaAnteriorBs), comparacion: "vs. los 7 días previos" },
    { titulo: "Este mes", bs: mesBs, variacion: variacion(mesBs, mesAnteriorBs), comparacion: "vs. el mes pasado" }
  ];

  return (
    <main className="min-h-screen px-4 py-8 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-kaxa-400 to-kaxa-900 flex items-center justify-center text-white font-bold text-sm">
          K
        </div>
        <span className="font-semibold">Kaxa · Panel</span>
      </div>
      <h1 className="text-xl font-semibold mt-4 mb-6">{nombreNegocio}</h1>

      <div className="flex flex-col gap-3">
        {tarjetas.map((t) => (
          <div key={t.titulo} className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-5">
            <p className="text-sm text-gray-500">{t.titulo}</p>
            <p className="text-2xl font-semibold mt-1">Bs {t.bs.toFixed(2)}</p>
            <p className="text-sm text-kaxa-600 font-medium">USD {(t.bs / tasa).toFixed(2)}</p>
            <p className={`text-xs mt-2 ${t.variacion === null ? "text-gray-400" : t.variacion >= 0 ? "text-green-600" : "text-red-500"}`}>
              {t.variacion === null ? "Sin datos del período anterior" : `${t.variacion >= 0 ? "▲" : "▼"} ${Math.abs(t.variacion).toFixed(0)}% ${t.comparacion}`}
            </p>
          </div>
        ))}

        <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Cuentas por cobrar</p>
          <p className="text-2xl font-semibold mt-1">USD {deudaUsd.toFixed(2)}</p>
          <p className="text-sm text-kaxa-600 font-medium">Bs {(deudaUsd * tasa).toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-2">Lo que te deben tus clientes a crédito, a hoy</p>
        </div>

        <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Producto más vendido este mes</p>
          {top ? (
            <>
              <p className="text-2xl font-semibold mt-1">{top.nombre}</p>
              <p className="text-sm text-kaxa-600 font-medium">{top.cantidad} vendidos</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-1">Todavía no hay ventas este mes</p>
          )}
        </div>
      </div>

      <form action="/api/logout" method="post" className="mt-8">
        <button className="text-sm text-gray-500 underline">cerrar sesión</button>
      </form>
    </main>
  );
}
