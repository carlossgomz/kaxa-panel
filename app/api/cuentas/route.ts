import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { vincularCuenta, desvincularCuenta } from "@/lib/cuentas";

// Vincula una cuenta ya registrada (por email) al negocio de quien hace
// el pedido. IMPORTANTE: el negocio (slug) sale siempre de la sesión
// firmada de quien llama, nunca del body — si se tomara del body,
// cualquiera con una cuenta y algo de curiosidad podría vincularse a
// mano a un negocio ajeno solo adivinando o viendo su slug (son públicos,
// se escriben en la URL/el login).
export async function POST(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  if (sesion.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador puede vincular cuentas." }, { status: 403 });

  const { email, rol } = await req.json();
  if (!email || !rol || !["ADMIN", "CAJERO"].includes(rol)) {
    return NextResponse.json({ error: "Faltan datos o el rol no es válido." }, { status: 400 });
  }

  const resultado = await vincularCuenta(email, sesion.slug, rol);
  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  if (sesion.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador puede desvincular cuentas." }, { status: 403 });

  const { cuentaId } = await req.json();
  if (!cuentaId) return NextResponse.json({ error: "Falta la cuenta." }, { status: 400 });

  // No te podés desvincular a vos mismo — evita que un admin se quede
  // afuera de su propio negocio sin querer (y sin nadie más que lo
  // vuelva a vincular).
  if (cuentaId === sesion.usuarioId) {
    return NextResponse.json({ error: "No te podés desvincular a vos mismo." }, { status: 400 });
  }

  await desvincularCuenta(cuentaId, sesion.slug);
  return NextResponse.json({ ok: true });
}
