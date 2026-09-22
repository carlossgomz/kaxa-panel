import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { desvincularCuenta } from "@/lib/cuentas";

// Para darle acceso a alguien ver /api/invitaciones (un solo campo de
// email resuelve tanto vincular a alguien que ya tiene cuenta como
// invitar a alguien nuevo). Acá solo queda quitar el acceso.
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
