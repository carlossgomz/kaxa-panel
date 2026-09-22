import { obtenerContexto } from "@/lib/contexto";
import { normalizarTexto, sqlSinAcentos } from "@/lib/busqueda";
import { estadoStock, formatearStock, precioVentaBsHoy } from "@/lib/precios";
import NavTabs from "@/components/NavTabs";

const BADGE: Record<string, string> = {
  agotado: "bg-red-50 text-red-700",
  critico: "bg-amber-50 text-amber-700",
  bajo: "bg-amber-50 text-amber-700",
  ok: "bg-green-50 text-green-700",
};

const ETIQUETA: Record<string, string> = {
  agotado: "Agotado",
  critico: "¡Última unidad!",
  bajo: "Stock bajo",
  ok: "OK",
};

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: { q?: string; problemas?: string };
}) {
  const { sesion, db } = await obtenerContexto();

  const term = (searchParams.q || "").trim();
  const soloProblemas = searchParams.problemas === "1";

  const [config, productosRes] = await Promise.all([
    db.execute("SELECT tasa_cambio_dia FROM config WHERE id = 1"),
    db.execute({
      sql: `SELECT nombre, codigo_barra, costo_actual_usd, margen_porcentaje, stock_actual, stock_minimo
            FROM productos
            WHERE (${sqlSinAcentos("nombre")} LIKE ? OR codigo_barra LIKE ?)
            ORDER BY nombre
            LIMIT 300`,
      args: [`%${normalizarTexto(term)}%`, `%${term}%`],
    }),
  ]);

  const tasa = Number(config.rows[0]?.tasa_cambio_dia ?? 1) || 1;
  let productos = productosRes.rows.map((r) => ({
    nombre: String(r.nombre),
    codigo_barra: String(r.codigo_barra),
    costo_actual_usd: Number(r.costo_actual_usd),
    margen_porcentaje: r.margen_porcentaje == null ? null : Number(r.margen_porcentaje),
    stock_actual: Number(r.stock_actual),
    stock_minimo: Number(r.stock_minimo),
  }));

  if (soloProblemas) {
    productos = productos.filter((p) => {
      const e = estadoStock(p);
      return e === "agotado" || e === "critico";
    });
  }

  return (
    <main className="min-h-screen px-4 py-8 pb-28 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-1">Inventario</h1>
      <p className="text-sm text-gray-500 mb-4">Stock y precio de venta a la tasa de hoy ({tasa.toFixed(2)} Bs/$).</p>

      <form className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4 flex flex-col gap-2">
        <input
          name="q"
          defaultValue={term}
          placeholder="Buscar por nombre o código"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="problemas" value="1" defaultChecked={soloProblemas} />
          Solo crítico (1 unidad) o agotado
        </label>
        <button type="submit" className="rounded-lg bg-kaxa-600 text-white font-medium py-2 text-sm">
          Buscar
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {productos.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Nada que coincida.</p>}
        {productos.map((p) => {
          const estado = estadoStock(p);
          return (
            <div key={p.codigo_barra} className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{p.nombre}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-2 ${BADGE[estado]}`}>{ETIQUETA[estado]}</span>
              </div>
              <div className="flex items-center justify-between mt-1 text-sm">
                <p className="text-gray-400 text-xs">{p.codigo_barra}</p>
                <p className="text-gray-500">
                  Stock: <span className="font-medium text-gray-800">{formatearStock(p.stock_actual)}</span>
                </p>
              </div>
              <p className="text-sm text-kaxa-700 font-medium mt-1">Bs {precioVentaBsHoy(p, tasa).toFixed(2)}</p>
            </div>
          );
        })}
      </div>

      <NavTabs rol={sesion.rol} />
    </main>
  );
}
