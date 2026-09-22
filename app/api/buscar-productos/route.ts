import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";
import { normalizarTexto, sqlSinAcentos } from "@/lib/busqueda";
import { precioVentaBsHoy } from "@/lib/precios";

// Misma consulta que la búsqueda de producto en Venta.tsx del escritorio.
export async function GET(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const term = (req.nextUrl.searchParams.get("q") || "").trim();
  if (term.length < 2) return NextResponse.json({ productos: [] });

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  const [config, res] = await Promise.all([
    db.execute("SELECT tasa_cambio_dia FROM config WHERE id = 1"),
    db.execute({
      sql: `SELECT id, codigo_barra, nombre, costo_actual_usd, margen_porcentaje, stock_actual
            FROM productos WHERE activo = 1 AND (${sqlSinAcentos("nombre")} LIKE ? OR codigo_barra LIKE ?)
            ORDER BY nombre LIMIT 8`,
      args: [`%${normalizarTexto(term)}%`, `%${term}%`],
    }),
  ]);
  const tasa = Number(config.rows[0]?.tasa_cambio_dia ?? 1) || 1;

  const productos = res.rows.map((r) => {
    const p = {
      costo_actual_usd: Number(r.costo_actual_usd),
      margen_porcentaje: r.margen_porcentaje == null ? null : Number(r.margen_porcentaje),
    };
    return {
      id: String(r.id),
      codigo_barra: String(r.codigo_barra),
      nombre: String(r.nombre),
      stock_actual: Number(r.stock_actual),
      precio_unit_bs: precioVentaBsHoy(p, tasa),
    };
  });

  return NextResponse.json({ productos });
}
