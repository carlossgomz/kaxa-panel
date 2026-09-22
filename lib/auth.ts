import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "crypto";

// Mismo hash que ya usa el escritorio (src/auth.ts: SHA-256 sin sal vía
// Web Crypto) — reproducido acá con el módulo crypto de Node, para poder
// validar la contraseña contra la MISMA tabla usuarios de la base del
// cliente, sin tocar nada del programa de escritorio.
export function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
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
