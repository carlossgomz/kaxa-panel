import { NextRequest, NextResponse } from "next/server";
import { buscarNegocio } from "@/lib/directorio";
import { buscarCuentaPorEmail, negociosDeCuenta } from "@/lib/cuentas";
import { fijarSesion, verificarPasswordCuenta } from "@/lib/auth";

// Login por email/contraseña de la CUENTA del panel (lib/cuentas.ts), ya
// no por código de negocio + usuario del escritorio — una cuenta se
// vincula a uno o más negocios desde app/panel/cuentas, así que acá solo
// hace falta resolver a cuál entrar. Mismo mensaje de error genérico para
// "no existe ese email" y "contraseña incorrecta", para no revelar con un
// intento si un email está registrado o no.
export async function POST(req: NextRequest) {
  const { email, password, slug } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  const cuenta = await buscarCuentaPorEmail(email);
  if (!cuenta || !verificarPasswordCuenta(password, cuenta.password_hash)) {
    return NextResponse.json({ error: "Email o contraseña incorrectos." }, { status: 401 });
  }

  const negocios = await negociosDeCuenta(cuenta.id);
  if (negocios.length === 0) {
    return NextResponse.json(
      { error: "Tu cuenta todavía no está vinculada a ningún negocio. Pídele a quien lo administra que te vincule desde Cuentas, dentro del panel." },
      { status: 403 }
    );
  }

  // Más de un negocio vinculado y todavía no eligió cuál: se le devuelve
  // la lista para que el login (cliente) muestre un selector y vuelva a
  // mandar el mismo email/password con el slug elegido — no se guarda
  // ninguna sesión intermedia sin negocio resuelto.
  let elegido = negocios[0];
  if (negocios.length > 1) {
    if (!slug) {
      return NextResponse.json({ elegirNegocio: negocios.map((n) => ({ slug: n.slug, negocio: n.negocio })) });
    }
    const match = negocios.find((n) => n.slug === slug);
    if (!match) return NextResponse.json({ error: "Ese negocio no está vinculado a tu cuenta." }, { status: 403 });
    elegido = match;
  }

  const negocioInfo = await buscarNegocio(elegido.slug);
  if (!negocioInfo) return NextResponse.json({ error: "No se encontró el negocio." }, { status: 500 });
  if (negocioInfo.edicion !== "avanzado") {
    return NextResponse.json(
      { error: "El panel web es exclusivo de Kaxa Avanzado. Escríbenos para actualizar tu plan." },
      { status: 403 }
    );
  }

  await fijarSesion({
    slug: elegido.slug,
    negocio: elegido.negocio,
    rol: elegido.rol,
    usuarioId: cuenta.id,
    usuarioNombre: cuenta.nombre
  });
  return NextResponse.json({ ok: true });
}
