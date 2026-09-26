import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";
import { normalizarTexto, sqlSinAcentos } from "@/lib/busqueda";

// Lista/busca clientes — accesible a cualquier rol, igual que Clientes.tsx
// del escritorio (está en SECCIONES_CAJERO, no es exclusivo de admin).
export async function GET(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const term = (req.nextUrl.searchParams.get("q") || "").trim();
  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  const res = term
    ? await db.execute({
        sql: `SELECT id, nombre, cedula, telefono, direccion, cliente_app_id, credito_autorizado, es_empleado
              FROM clientes WHERE ${sqlSinAcentos("nombre")} LIKE ? OR cedula LIKE ? ORDER BY nombre`,
        args: [`%${normalizarTexto(term)}%`, `%${term}%`],
      })
    : await db.execute(
        "SELECT id, nombre, cedula, telefono, direccion, cliente_app_id, credito_autorizado, es_empleado FROM clientes ORDER BY nombre"
      );

  const clientes = res.rows.map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre),
    cedula: String(r.cedula),
    telefono: r.telefono == null ? null : String(r.telefono),
    direccion: r.direccion == null ? null : String(r.direccion),
    cliente_app_id: r.cliente_app_id == null ? null : String(r.cliente_app_id),
    credito_autorizado: Number(r.credito_autorizado),
    es_empleado: Number(r.es_empleado),
  }));

  return NextResponse.json({ clientes });
}

export async function POST(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const { nombre, cedula, telefono, direccion } = await req.json();
  if (!nombre?.trim() || !cedula?.trim()) {
    return NextResponse.json({ error: "Nombre y cédula son obligatorios." }, { status: 400 });
  }

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  const id = crypto.randomUUID();
  try {
    await db.execute({
      sql: "INSERT INTO clientes (id, nombre, cedula, telefono, direccion) VALUES (?, ?, ?, ?, ?)",
      args: [id, nombre.trim(), cedula.trim(), telefono?.trim() || null, direccion?.trim() || null],
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo crear el cliente (¿cédula repetida?): ${String(e)}` }, { status: 400 });
  }

  return NextResponse.json({ id, nombre: nombre.trim(), cedula: cedula.trim() });
}
