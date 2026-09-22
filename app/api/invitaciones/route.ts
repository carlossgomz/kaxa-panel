import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { invitarOVincular, revocarInvitacion, buscarInvitacionValida } from "@/lib/cuentas";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sin sesión a propósito — la usa /registro para mostrar "te invitaron a
// tal negocio" antes de crear la cuenta. No es información sensible (el
// nombre del negocio ya se ve en el login normal), y solo responde algo
// para un token válido, no vencido y sin usar.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Falta el token." }, { status: 400 });
  const invitacion = await buscarInvitacionValida(token);
  if (!invitacion) return NextResponse.json({ error: "Ese link de invitación ya no es válido." }, { status: 404 });
  return NextResponse.json(invitacion);
}

// El slug siempre sale de la sesión firmada de quien invita (nunca del
// body) — mismo motivo que en /api/cuentas: si se tomara del body,
// cualquier ADMIN podría invitar gente a un negocio que no es el suyo.
// El email es OPCIONAL: si se escribe uno y ya tiene cuenta, se vincula
// directo; si se escribe uno nuevo, el link queda atado a ese email; si
// se deja vacío, se genera un link abierto para alguien que todavía no
// se sabe qué email va a usar.
export async function POST(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  if (sesion.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador puede invitar cuentas." }, { status: 403 });

  const { email, rol } = await req.json();
  const emailLimpio = email ? String(email).trim() : "";
  if (emailLimpio && !EMAIL_RE.test(emailLimpio)) {
    return NextResponse.json({ error: "Ese email no parece válido." }, { status: 400 });
  }
  if (!rol || !["ADMIN", "CAJERO"].includes(rol)) {
    return NextResponse.json({ error: "El rol no es válido." }, { status: 400 });
  }

  const resultado = await invitarOVincular(emailLimpio || null, sesion.slug, sesion.negocio, rol, sesion.usuarioId);
  return NextResponse.json(resultado);
}

export async function DELETE(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  if (sesion.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador puede revocar invitaciones." }, { status: 403 });

  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Falta el token." }, { status: 400 });

  await revocarInvitacion(token, sesion.slug);
  return NextResponse.json({ ok: true });
}
