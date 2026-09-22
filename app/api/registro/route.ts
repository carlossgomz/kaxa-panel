import { NextRequest, NextResponse } from "next/server";
import { crearCuenta } from "@/lib/cuentas";
import { hashPasswordCuenta } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Crea la cuenta sola — a propósito NO la vincula a ningún negocio ni
// abre sesión: eso lo hace después un ADMIN ya vinculado a ese negocio,
// desde app/panel/cuentas, escribiendo el email de la persona. Así nadie
// puede autovincularse a un negocio ajeno solo registrándose.
export async function POST(req: NextRequest) {
  const { email, nombre, password } = await req.json();
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
    return NextResponse.json({ ok: true });
  } catch {
    // Caso raro: dos registros con el mismo email llegando casi al mismo
    // tiempo — el chequeo de arriba no lo agarra, pero la restricción
    // UNIQUE de la tabla sí, y ahí es cuando esto se dispara.
    return NextResponse.json({ error: "Ya existe una cuenta con ese email." }, { status: 409 });
  }
}
