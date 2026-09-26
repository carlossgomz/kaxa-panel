import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";
import { normalizarTexto, sqlSinAcentos } from "@/lib/busqueda";

// Búsqueda de producto para Compras — a diferencia de /api/buscar-productos
// (Venta), acá también hace falta el costo/margen/stock ACTUALES del
// producto para poder mostrar la previsualización y calcular el costo
// vigente (promedio ponderado) antes de guardar, igual que
// seleccionarProductoExistente en Compras.tsx del escritorio.
export async function GET(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const term = (req.nextUrl.searchParams.get("q") || "").trim();
  if (term.length < 2) return NextResponse.json({ productos: [] });

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  const res = await db.execute({
    sql: `SELECT id, codigo_barra, codigo_proveedor, nombre, costo_actual_usd, margen_porcentaje,
                 stock_actual, unidades_por_paquete
          FROM productos WHERE ${sqlSinAcentos("nombre")} LIKE ? OR codigo_barra LIKE ? OR codigo_proveedor LIKE ?
          ORDER BY nombre LIMIT 8`,
    args: [`%${normalizarTexto(term)}%`, `%${term}%`, `%${term}%`],
  });

  const productos = res.rows.map((r) => ({
    id: String(r.id),
    codigo_barra: String(r.codigo_barra),
    codigo_proveedor: r.codigo_proveedor == null ? null : String(r.codigo_proveedor),
    nombre: String(r.nombre),
    costo_actual_usd: Number(r.costo_actual_usd),
    margen_porcentaje: r.margen_porcentaje == null ? null : Number(r.margen_porcentaje),
    stock_actual: Number(r.stock_actual),
    unidades_por_paquete: Number(r.unidades_por_paquete),
  }));

  return NextResponse.json({ productos });
}
