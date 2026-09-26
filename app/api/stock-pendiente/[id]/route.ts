import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";

function ahoraVenezuela(): string {
  const ahora = new Date(Date.now() - 4 * 3600 * 1000);
  return ahora.toISOString().slice(0, 19).replace("T", " ");
}

// Cierra el caso — solo admin, igual que resolver_stock_pendiente en
// src-tauri/src/comandos.rs. Se asume que antes de llamar esto ya se
// corrigió el inventario real (a mano, o editando la venta).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sesion = obtenerSesion();
  if (!sesion || sesion.rol !== "ADMIN") return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  await db.execute({
    sql: "UPDATE venta_items SET revisado_admin = 1, revisado_por = ?, revisado_en = ? WHERE id = ?",
    args: [sesion.usuarioNombre, ahoraVenezuela(), params.id],
  });

  return NextResponse.json({ ok: true });
}
