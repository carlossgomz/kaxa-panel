import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";

// Mismo campo config.logo_base64 que ya usan pos-basico/medio/avanzado
// (y ahora también pos-minimarket) para el logo en su propia ventana y
// en los tickets — cambiarlo acá lo cambia también en el programa de
// escritorio de ese negocio, porque es la misma base.
export async function POST(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  if (sesion.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador puede cambiar el logo." }, { status: 403 });

  const { logo_base64 } = await req.json();
  if (!logo_base64 || typeof logo_base64 !== "string" || !logo_base64.startsWith("data:image/")) {
    return NextResponse.json({ error: "La imagen no es válida." }, { status: 400 });
  }
  // El logo se guarda como texto en la base y se lee en cada carga de
  // config — un límite generoso pero real para que nadie suba sin
  // querer una foto de varios MB sin comprimir.
  if (logo_base64.length > 1_500_000) {
    return NextResponse.json({ error: "La imagen es muy pesada — usa una más chica." }, { status: 400 });
  }

  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  await db.execute({ sql: "UPDATE config SET logo_base64 = ? WHERE id = 1", args: [logo_base64] });
  return NextResponse.json({ ok: true });
}
