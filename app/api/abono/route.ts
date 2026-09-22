import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";
import { EPS } from "@/lib/dinero";

function ahoraVenezuela(): string {
  // America/Caracas, UTC-4 fijo, sin horario de verano — mismo formato
  // "%Y-%m-%d %H:%M:%S" que ahora_venezuela() en src-tauri/src/fecha.rs.
  const ahora = new Date(Date.now() - 4 * 3600 * 1000);
  return ahora.toISOString().slice(0, 19).replace("T", " ");
}

// Abono de un cliente aplicado a su DEUDA TOTAL — reparte el monto entre
// sus ventas a crédito pendientes, de la más vieja a la más nueva, hasta
// agotarlo. Réplica exacta de registrar_abono_cliente_total en
// src-tauri/src/comandos.rs, pero acá usando una transacción interactiva
// de @libsql/client en vez de la conexión persistente que tiene Rust —
// visible tanto para ADMIN como para CAJERO, igual que en el escritorio.
export async function POST(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const { cliente_cedula, monto_usd, tasa_cambio_dia, metodo } = await req.json();
  if (!cliente_cedula || typeof monto_usd !== "number" || monto_usd <= 0) {
    return NextResponse.json({ error: "Faltan datos o el monto no es válido." }, { status: 400 });
  }
  if (typeof tasa_cambio_dia !== "number" || tasa_cambio_dia <= 0) {
    return NextResponse.json({ error: "La tasa del día debe ser mayor a 0." }, { status: 400 });
  }

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  const tx = await db.transaction("write");
  try {
    const filas = await tx.execute({
      sql: `SELECT id, monto_pendiente_usd FROM ventas
            WHERE cliente_cedula = ? AND estado = 'CREDITO_PENDIENTE'
            ORDER BY fecha_hora ASC`,
      args: [cliente_cedula],
    });

    const ventas = filas.rows.map((r) => ({ id: String(r.id), pendiente: Number(r.monto_pendiente_usd) }));
    const totalPendiente = ventas.reduce((acc, v) => acc + v.pendiente, 0);

    if (ventas.length === 0) {
      await tx.rollback();
      return NextResponse.json({ error: "Ese cliente ya no tiene deuda pendiente." }, { status: 400 });
    }
    if (monto_usd > totalPendiente + EPS) {
      await tx.rollback();
      return NextResponse.json(
        {
          error: `Ese monto equivale a USD ${monto_usd.toFixed(2)}, pero la deuda total es de solo USD ${totalPendiente.toFixed(2)}.`,
        },
        { status: 400 }
      );
    }

    let restante = monto_usd;
    const fecha = ahoraVenezuela();
    for (const venta of ventas) {
      if (restante <= EPS) break;
      const aplicado = Math.min(restante, venta.pendiente);
      const nuevoPendiente = Math.max(venta.pendiente - aplicado, 0);

      await tx.execute({
        sql: `INSERT INTO cobros_cliente (id, venta_id, monto_usd, tasa_cambio_dia, monto_bs, metodo, created_at)
              VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?)`,
        args: [venta.id, aplicado, tasa_cambio_dia, aplicado * tasa_cambio_dia, metodo ?? null, fecha],
      });
      await tx.execute({
        sql: `UPDATE ventas
              SET monto_pendiente_usd = ?,
                  estado = CASE WHEN ? <= 0.01 THEN 'CREDITO_PAGADO' ELSE estado END
              WHERE id = ?`,
        args: [nuevoPendiente, nuevoPendiente, venta.id],
      });

      restante -= aplicado;
    }

    await tx.commit();
    return NextResponse.json({ ok: true });
  } catch (e) {
    try {
      await tx.rollback();
    } catch {
      // La conexión ya pudo haberse cerrado sola al fallar — no hay nada
      // más que deshacer.
    }
    return NextResponse.json({ error: `No se pudo registrar el abono: ${String(e)}` }, { status: 500 });
  } finally {
    tx.close();
  }
}
