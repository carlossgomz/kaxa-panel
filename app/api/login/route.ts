import { NextRequest, NextResponse } from "next/server";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";
import { fijarSesion, hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { slug, usuario, password } = await req.json();
  if (!slug || !usuario || !password) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  const negocio = await buscarNegocio(slug);
  if (!negocio) {
    return NextResponse.json({ error: "No encontramos ese código de negocio." }, { status: 401 });
  }
  if (negocio.edicion !== "avanzado") {
    return NextResponse.json(
      { error: "El panel web es exclusivo de Kaxa Avanzado. Escríbenos para actualizar tu plan." },
      { status: 403 }
    );
  }

  // Misma consulta que src/screens/Login.tsx del escritorio, contra la
  // base de ESE cliente — el panel no tiene sus propias cuentas, usa las
  // mismas que ya existen en Kaxa.
  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  const resultado = await db.execute({
    sql: "SELECT id, nombre, rol, activo, password_hash FROM usuarios WHERE usuario = ? AND activo = 1",
    args: [usuario.trim()]
  });
  const fila = resultado.rows[0];
  if (!fila || fila.password_hash !== hashPassword(password)) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
  }

  await fijarSesion({
    slug: negocio.slug,
    negocio: negocio.negocio,
    rol: fila.rol as string,
    usuarioId: String(fila.id),
    usuarioNombre: String(fila.nombre)
  });
  return NextResponse.json({ ok: true });
}
