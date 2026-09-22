import { NextRequest, NextResponse } from "next/server";
import { crearCuenta, usarInvitacion } from "@/lib/cuentas";
import { hashPasswordCuenta } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Crea la cuenta — sin invitación, a propósito NO la vincula a ningún
// negocio: eso lo hace después un ADMIN ya vinculado a ese negocio, desde
// app/panel/cuentas, escribiendo el email de la persona. Con invitación
// (link generado por un ADMIN, ver /api/invitaciones), el token ES la
// prueba de que alguien de ese negocio invitó a esta persona, así que acá
// se consume y se vincula de una — nadie puede autovincularse a un
// negocio ajeno solo registrándose sin ese token.
export async function POST(req: NextRequest) {
  const { email, nombre, password, invite } = await req.json();
  if (!email || !nombre || !password) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }
  if (!EMAIL_RE.test(String(email).trim())) {
    return NextResponse.json({ error: "Ese email no parece válido." }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: "La contraseña tiene que tener al menos 6 caracteres." }, { status: 400 });
  }

  try {
    const resultado = await crearCuenta(email, nombre, hashPasswordCuenta(password));
    if ("error" in resultado) {
      return NextResponse.json({ error: resultado.error }, { status: 409 });
    }

    if (!invite) return NextResponse.json({ ok: true, vinculado: null });

    const vinculado = await usarInvitacion(invite, resultado.id, email);
    if (!vinculado) {
      // La cuenta ya se creó igual — el link estaba vencido, ya usado, no
      // existía, o el email no coincide con el invitado. No se pierde el
      // registro por esto, solo no queda vinculado automáticamente.
      return NextResponse.json({ ok: true, vinculado: null, avisoInvitacion: "El link de invitación ya no es válido para este email — pedile uno nuevo a quien te invitó." });
    }
    return NextResponse.json({ ok: true, vinculado });
  } catch {
    // Caso raro: dos registros con el mismo email llegando casi al mismo
    // tiempo — el chequeo de arriba no lo agarra, pero la restricción
    // UNIQUE de la tabla sí, y ahí es cuando esto se dispara.
    return NextResponse.json({ error: "Ya existe una cuenta con ese email." }, { status: 409 });
  }
}
