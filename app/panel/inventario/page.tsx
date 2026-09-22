import Link from "next/link";
import { obtenerContexto } from "@/lib/contexto";
import { normalizarTexto, sqlSinAcentos } from "@/lib/busqueda";
import { estadoStock, formatearStock, precioVentaBsHoy } from "@/lib/precios";
import InventarioFiltro from "./InventarioFiltro";

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

// Mismo valor especial que SIN_CATEGORIA en Inventario.tsx del escritorio
// — distinto de "" (todas) y de cualquier id real de categoría.
const SIN_CATEGORIA = "__SIN_CATEGORIA__";
const TAMANO_PAGINA = 20;

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: { q?: string; problemas?: string; categoria?: string; pagina?: string };
}) {
  const { db } = await obtenerContexto();

  const term = (searchParams.q || "").trim();
  const soloProblemas = searchParams.problemas === "1";
  const categoriaFiltro = searchParams.categoria || "";
  const paginaActual = Math.max(0, Number(searchParams.pagina || "0") || 0);

  const [config, categoriasRes, productosRes] = await Promise.all([
    db.execute("SELECT tasa_cambio_dia FROM config WHERE id = 1"),
    db.execute("SELECT id, nombre FROM categorias ORDER BY nombre"),
    db.execute({
      sql: `SELECT nombre, codigo_barra, categoria_id, costo_actual_usd, margen_porcentaje, stock_actual, stock_minimo
            FROM productos
            WHERE (${sqlSinAcentos("nombre")} LIKE ? OR codigo_barra LIKE ?)
            ORDER BY nombre`,
      args: [`%${normalizarTexto(term)}%`, `%${term}%`],
    }),
  ]);

  const tasa = Number(config.rows[0]?.tasa_cambio_dia ?? 1) || 1;
  const categorias = categoriasRes.rows.map((r) => ({ id: String(r.id), nombre: String(r.nombre) }));

  let productos = productosRes.rows.map((r) => ({
    nombre: String(r.nombre),
    codigo_barra: String(r.codigo_barra),
    categoria_id: r.categoria_id ? String(r.categoria_id) : null,
    costo_actual_usd: Number(r.costo_actual_usd),
    margen_porcentaje: r.margen_porcentaje == null ? null : Number(r.margen_porcentaje),
    stock_actual: Number(r.stock_actual),
    stock_minimo: Number(r.stock_minimo),
  }));

  // Mismos filtros (y mismo orden de aplicación) que Inventario.tsx del
  // escritorio: solo problemas duros (agotado/última unidad) y categoría.
  if (soloProblemas) {
    productos = productos.filter((p) => {
      const e = estadoStock(p);
      return e === "agotado" || e === "critico";
    });
  }
  if (categoriaFiltro === SIN_CATEGORIA) {
    productos = productos.filter((p) => !p.categoria_id);
  } else if (categoriaFiltro) {
    productos = productos.filter((p) => p.categoria_id === categoriaFiltro);
  }

  const totalPaginas = Math.max(1, Math.ceil(productos.length / TAMANO_PAGINA));
  const pagina = Math.min(paginaActual, totalPaginas - 1);
  const productosPagina = productos.slice(pagina * TAMANO_PAGINA, (pagina + 1) * TAMANO_PAGINA);

  function hrefPagina(p: number) {
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (soloProblemas) params.set("problemas", "1");
    if (categoriaFiltro) params.set("categoria", categoriaFiltro);
    params.set("pagina", String(p));
    return `/panel/inventario?${params.toString()}`;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Inventario</h1>
      <p className="text-sm text-gray-500 mb-4">
        Stock y precio de venta a la tasa de hoy ({tasa.toFixed(2)} Bs/$) — {productos.length}{" "}
        {productos.length === 1 ? "producto" : "productos"}.
      </p>

      <InventarioFiltro q={term} problemas={soloProblemas} categoria={categoriaFiltro} categorias={categorias} />

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mb-3 text-sm">
          <Link
            href={hrefPagina(pagina - 1)}
            aria-disabled={pagina === 0}
            className={`px-3 py-1.5 rounded-lg border border-kaxa-100 bg-white ${pagina === 0 ? "opacity-40 pointer-events-none" : "active:bg-kaxa-50"}`}
          >
            ← Anterior
          </Link>
          <span className="text-gray-400 text-xs">
            Página {pagina + 1} de {totalPaginas}
          </span>
          <Link
            href={hrefPagina(pagina + 1)}
            aria-disabled={pagina >= totalPaginas - 1}
            className={`px-3 py-1.5 rounded-lg border border-kaxa-100 bg-white ${pagina >= totalPaginas - 1 ? "opacity-40 pointer-events-none" : "active:bg-kaxa-50"}`}
          >
            Siguiente →
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {productosPagina.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Nada que coincida.</p>}
        {productosPagina.map((p) => {
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

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm">
          <Link
            href={hrefPagina(pagina - 1)}
            aria-disabled={pagina === 0}
            className={`px-3 py-1.5 rounded-lg border border-kaxa-100 bg-white ${pagina === 0 ? "opacity-40 pointer-events-none" : "active:bg-kaxa-50"}`}
          >
            ← Anterior
          </Link>
          <span className="text-gray-400 text-xs">
            Página {pagina + 1} de {totalPaginas}
          </span>
          <Link
            href={hrefPagina(pagina + 1)}
            aria-disabled={pagina >= totalPaginas - 1}
            className={`px-3 py-1.5 rounded-lg border border-kaxa-100 bg-white ${pagina >= totalPaginas - 1 ? "opacity-40 pointer-events-none" : "active:bg-kaxa-50"}`}
          >
            Siguiente →
          </Link>
        </div>
      )}
    </div>
  );
}
