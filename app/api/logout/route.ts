import { NextRequest, NextResponse } from "next/server";
import { cerrarSesion } from "@/lib/auth";

export async function POST(req: NextRequest) {
  cerrarSesion();
  // 303 (no el 307 por defecto) para que el navegador cambie a GET en el
  // redirect — si no, repite el POST hacia /login y esa página lo rechaza.
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
