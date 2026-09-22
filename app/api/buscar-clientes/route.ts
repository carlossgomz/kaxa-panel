import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";
import { normalizarTexto, sqlSinAcentos } from "@/lib/busqueda";

// Misma consulta que la búsqueda de cliente en Venta.tsx del escritorio.
export async function GET(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const term = (req.nextUrl.searchParams.get("q") || "").trim();
  if (term.length < 2) return NextResponse.json({ clientes: [] });

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  const res = await db.execute({
    sql: `SELECT id, nombre, cedula, direccion, credito_autorizado
          FROM clientes WHERE cedula LIKE ? OR ${sqlSinAcentos("nombre")} LIKE ?
          ORDER BY nombre LIMIT 6`,
    args: [`%${term}%`, `%${normalizarTexto(term)}%`],
  });

  const clientes = res.rows.map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre),
    cedula: String(r.cedula),
    direccion: r.direccion ? String(r.direccion) : null,
    credito_autorizado: Number(r.credito_autorizado ?? 0) === 1,
  }));

  return NextResponse.json({ clientes });
}
