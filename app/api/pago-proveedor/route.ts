import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";
import { EPS } from "@/lib/dinero";

function ahoraVenezuela(): string {
  const ahora = new Date(Date.now() - 4 * 3600 * 1000);
  return ahora.toISOString().slice(0, 19).replace("T", " ");
}

// Pago a UNA factura de proveedor puntual (no reparte entre varias, a
// diferencia del abono de clientes) — réplica exacta de
// registrar_pago_proveedor en src-tauri/src/comandos.rs. Solo ADMIN, igual
// que CuentasPorPagar en el escritorio (verificado acá también, no solo en
// la UI, por si alguien pega la URL a mano).
export async function POST(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  if (sesion.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador puede registrar pagos." }, { status: 403 });

  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const { factura_compra_id, monto_usd, tasa_cambio_dia, monto_bs, metodo, referencia } = await req.json();
  if (!factura_compra_id || typeof monto_usd !== "number" || monto_usd <= 0) {
    return NextResponse.json({ error: "Faltan datos o el monto no es válido." }, { status: 400 });
  }
  if (typeof tasa_cambio_dia !== "number" || tasa_cambio_dia <= 0) {
    return NextResponse.json({ error: "La tasa del día debe ser mayor a 0." }, { status: 400 });
  }

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  const tx = await db.transaction("write");
  try {
    const filas = await tx.execute({
      sql: "SELECT monto_total_usd, monto_pagado_usd FROM facturas_compra WHERE id = ? AND estado != 'PAGADA'",
      args: [factura_compra_id],
    });
    const fila = filas.rows[0];
    if (!fila) {
      await tx.rollback();
      return NextResponse.json({ error: "Esa factura ya está pagada o no existe." }, { status: 400 });
    }

    const total = Number(fila.monto_total_usd);
    const pagado = Number(fila.monto_pagado_usd);
    const saldo = total - pagado;
    if (monto_usd > saldo + EPS) {
      await tx.rollback();
      return NextResponse.json(
        { error: `Ese monto equivale a USD ${monto_usd.toFixed(2)}, pero el saldo es de solo USD ${saldo.toFixed(2)}.` },
        { status: 400 }
      );
    }

    const nuevoPagado = pagado + monto_usd;
    const saldada = total - nuevoPagado <= EPS;

    await tx.execute({
      sql: `INSERT INTO pagos_proveedor (id, factura_compra_id, monto_usd, tasa_cambio_dia, monto_bs, metodo, referencia, created_at)
            VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?)`,
      args: [factura_compra_id, monto_usd, tasa_cambio_dia, monto_bs ?? monto_usd * tasa_cambio_dia, metodo ?? null, referencia ?? null, ahoraVenezuela()],
    });
    await tx.execute({
      sql: "UPDATE facturas_compra SET monto_pagado_usd = ?, estado = ? WHERE id = ?",
      args: [nuevoPagado, saldada ? "PAGADA" : "PARCIAL", factura_compra_id],
    });

    await tx.commit();
    return NextResponse.json({ ok: true });
  } catch (e) {
    try {
      await tx.rollback();
    } catch {
      // La conexión ya pudo haberse cerrado sola al fallar.
    }
    return NextResponse.json({ error: `No se pudo registrar el pago: ${String(e)}` }, { status: 500 });
  } finally {
    tx.close();
  }
}
