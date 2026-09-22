import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Contraseñas de las cuentas del panel (lib/cuentas.ts) — un sistema de
// login propio, separado del usuario/clave del programa de escritorio
// (una cuenta de panel puede no tener ningún usuario en el escritorio, y
// viceversa). scrypt con sal por cuenta, no el SHA-256 sin sal que usa el
// escritorio — acá no hace falta esa compatibilidad porque es una tabla
// de credenciales nueva, así que se usa algo más fuerte contra fuerza
// bruta/rainbow tables.
export function hashPasswordCuenta(password: string): string {
  const sal = randomBytes(16).toString("hex");
  const hash = scryptSync(password, sal, 64).toString("hex");
  return `${sal}:${hash}`;
}

export function verificarPasswordCuenta(password: string, guardado: string): boolean {
  const [sal, hashGuardado] = guardado.split(":");
  if (!sal || !hashGuardado) return false;
  const hash = scryptSync(password, sal, 64);
  const esperado = Buffer.from(hashGuardado, "hex");
  return hash.length === esperado.length && timingSafeEqual(hash, esperado);
}

const COOKIE = "kaxa_session";

export type Sesion = { slug: string; negocio: string; rol: string; usuarioId: string; usuarioNombre: string };

// A diferencia de delivery-app (un solo negocio, la cookie solo distingue
// "admin" de "delivery"), acá la cookie también dice A QUÉ NEGOCIO
// conectarse — si no estuviera firmada, cualquiera podría escribir a mano
// otro slug en la cookie del navegador y ver las ventas de OTRO cliente
// sin haber puesto ninguna contraseña. Por eso se firma con HMAC (con el
// módulo crypto de Node, sin agregar ninguna librería nueva) y se verifica
// la firma antes de confiar en el contenido.
function firmar(valor: string): string {
  const firma = createHmac("sha256", process.env.SESSION_SECRET!).update(valor).digest("hex");
  return `${valor}.${firma}`;
}

function verificarFirma(cocido: string): string | null {
  const idx = cocido.lastIndexOf(".");
  if (idx === -1) return null;
  const valor = cocido.slice(0, idx);
  const firma = cocido.slice(idx + 1);
  const esperada = createHmac("sha256", process.env.SESSION_SECRET!).update(valor).digest("hex");
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return valor;
}

export async function fijarSesion(sesion: Sesion) {
  cookies().set(COOKIE, firmar(JSON.stringify(sesion)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24
  });
}

export function obtenerSesion(): Sesion | null {
  const cruda = cookies().get(COOKIE)?.value;
  if (!cruda) return null;
  const valor = verificarFirma(cruda);
  if (!valor) return null;
  try {
    return JSON.parse(valor) as Sesion;
  } catch {
    return null;
  }
}

export function cerrarSesion() {
  cookies().delete(COOKIE);
}
