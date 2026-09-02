import { NextRequest, NextResponse } from "next/server";

// El middleware corre en el runtime Edge, donde no está disponible el
// módulo crypto de Node (createHmac) que usa lib/auth.ts para firmar la
// cookie — así que acá solo se hace un chequeo rápido de "¿existe la
// cookie?" para mandar de una a /login a quien no tiene sesión. La
// verificación de verdad (firma válida, negocio real) la hace
// lib/auth.ts::obtenerSesion() dentro de app/panel/page.tsx, que sí corre
// en Node — mismo patrón de dos capas que ya usa delivery-app/middleware.ts.
export function middleware(req: NextRequest) {
  const tieneSesion = req.cookies.has("kaxa_session");
  if (!tieneSesion) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/panel/:path*"]
};
