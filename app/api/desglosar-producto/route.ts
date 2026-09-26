import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";

function ahoraVenezuela(): string {
  const ahora = new Date(Date.now() - 4 * 3600 * 1000);
  return ahora.toISOString().slice(0, 19).replace("T", " ");
}

// Convierte stock de un producto (ej. una caja de cigarrillos) en stock de
// OTRO producto del catálogo (ej. cigarrillos sueltos) - réplica exacta de
// desglosar_producto_interna en src-tauri/src/comandos.rs: descuenta el
// origen por FIFO (mismos lotes que consume una venta), reparte ESE costo
// real entre las unidades generadas del destino, y solo actualiza el costo
// vigente del destino si no tenía ya stock propio (para no pisar un costo
// vigente que venga de sus propias compras).
export async function POST(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion || sesion.rol !== "ADMIN") return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const { producto_origen_id, producto_destino_id, cantidad_origen, unidades_generadas, motivo } = await req.json();
  const cantOrigen = Number(cantidad_origen);
  const unidGeneradas = Number(unidades_generadas);
  if (!cantOrigen || cantOrigen <= 0) return NextResponse.json({ error: "La cantidad a desglosar debe ser mayor a 0." }, { status: 400 });
  if (!unidGeneradas || unidGeneradas <= 0) return NextResponse.json({ error: "Las unidades generadas deben ser mayor a 0." }, { status: 400 });
  if (producto_origen_id === producto_destino_id) {
    return NextResponse.json({ error: "El producto de origen y el de destino no pueden ser el mismo." }, { status: 400 });
  }
  const motivoLimpio = String(motivo ?? "").trim() || "Desglose";

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  const tx = await db.transaction("write");
  try {
    const destinoRes = await tx.execute({ sql: "SELECT margen_porcentaje FROM productos WHERE id = ?", args: [producto_destino_id] });
    if (!destinoRes.rows[0]) {
      await tx.rollback();
      return NextResponse.json({ error: "El producto de destino no existe." }, { status: 400 });
    }
    const margenDestino = Number(destinoRes.rows[0].margen_porcentaje ?? 0);

    const origenRes = await tx.execute({ sql: "SELECT costo_actual_usd FROM productos WHERE id = ?", args: [producto_origen_id] });
    if (!origenRes.rows[0]) {
      await tx.rollback();
      return NextResponse.json({ error: "El producto de origen no existe." }, { status: 400 });
    }
    const costoActualOrigen = Number(origenRes.rows[0].costo_actual_usd ?? 0);

    await tx.execute({ sql: "UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?", args: [cantOrigen, producto_origen_id] });

    // Consume por FIFO, igual que una salida manual/venta - lo que rinde
    // esto es el costo REAL de lo que se está partiendo.
    let restante = cantOrigen;
    let costoTotalOrigen = 0;
    while (restante > 0.0001) {
      const lote = await tx.execute({
        sql: `SELECT id, cantidad_restante, costo_unitario_usd FROM lotes_producto WHERE producto_id = ? AND cantidad_restante > 0
              ORDER BY creado_at ASC, rowid ASC LIMIT 1`,
        args: [producto_origen_id],
      });
      const fila = lote.rows[0];
      if (!fila) break;
      const disponible = Number(fila.cantidad_restante);
      const costoLote = Number(fila.costo_unitario_usd);
      const consumido = Math.min(restante, disponible);
      await tx.execute({ sql: "UPDATE lotes_producto SET cantidad_restante = cantidad_restante - ? WHERE id = ?", args: [consumido, fila.id] });
      costoTotalOrigen += consumido * costoLote;
      restante -= consumido;
    }
    if (Math.abs(costoTotalOrigen) < 0.0000001) costoTotalOrigen = costoActualOrigen * cantOrigen;
    const costoUnitarioDestino = costoTotalOrigen / unidGeneradas;

    const stockVigenteDestino = await tx.execute({
      sql: "SELECT COUNT(*) as n FROM lotes_producto WHERE producto_id = ? AND cantidad_restante > 0",
      args: [producto_destino_id],
    });
    const teniaStockVigenteDestino = Number(stockVigenteDestino.rows[0]?.n ?? 0) > 0;

    await tx.execute({
      sql: `INSERT INTO lotes_producto (id, producto_id, costo_unitario_usd, margen_porcentaje, cantidad_inicial, cantidad_restante, factura_compra_id)
            VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, NULL)`,
      args: [producto_destino_id, costoUnitarioDestino, margenDestino, unidGeneradas, unidGeneradas],
    });

    if (!teniaStockVigenteDestino) {
      await tx.execute({
        sql: "UPDATE productos SET costo_actual_usd = ?, margen_porcentaje = ? WHERE id = ?",
        args: [costoUnitarioDestino, margenDestino, producto_destino_id],
      });
    }

    await tx.execute({
      sql: "UPDATE productos SET stock_actual = stock_actual + ?, activo = 1 WHERE id = ?",
      args: [unidGeneradas, producto_destino_id],
    });

    const referencia = crypto.randomUUID();
    const fecha = ahoraVenezuela();
    await tx.execute({
      sql: `INSERT INTO movimientos_inventario (id, producto_id, tipo, cantidad, motivo, referencia, created_at)
            VALUES (lower(hex(randomblob(16))), ?, 'SALIDA', ?, ?, ?, ?)`,
      args: [producto_origen_id, cantOrigen, `Desglose: ${motivoLimpio}`, referencia, fecha],
    });
    await tx.execute({
      sql: `INSERT INTO movimientos_inventario (id, producto_id, tipo, cantidad, motivo, referencia, created_at)
            VALUES (lower(hex(randomblob(16))), ?, 'ENTRADA', ?, ?, ?, ?)`,
      args: [producto_destino_id, unidGeneradas, `Desglose: ${motivoLimpio}`, referencia, fecha],
    });

    await tx.commit();
    return NextResponse.json({ ok: true });
  } catch (e) {
    try {
      await tx.rollback();
    } catch {
      // La conexión ya pudo haberse cerrado sola al fallar.
    }
    return NextResponse.json({ error: `No se pudo desglosar: ${String(e)}` }, { status: 500 });
  } finally {
    tx.close();
  }
}
