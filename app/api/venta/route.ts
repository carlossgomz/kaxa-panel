import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";

function ahoraVenezuela(): string {
  const ahora = new Date(Date.now() - 4 * 3600 * 1000);
  return ahora.toISOString().slice(0, 19).replace("T", " ");
}

function uuid(): string {
  return crypto.randomUUID();
}

type ItemVenta = { producto_id: string; cantidad: number; precio_unit_bs: number };
type PagoVenta = { metodo: string; monto_bs: number; referencia?: string | null };

// Réplica exacta de confirmar_venta_interna en src-tauri/src/comandos.rs:
// mismo cálculo de número de ticket (contador de config + MAX ya
// existente, el mayor de los dos), mismo consumo de stock por FIFO contra
// lotes_producto, mismo criterio de "vender igual aunque falte stock"
// (nunca baja de 0, la diferencia queda marcada en stock_insuficiente /
// stock_disponible_al_vender para que un admin la revise). Idempotente
// por el id que manda el cliente — un reintento por conexión cortada no
// duplica la venta.
export async function POST(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const body = await req.json();
  const {
    id,
    fecha_hora,
    cliente_nombre,
    cliente_cedula,
    cliente_direccion,
    canal,
    repartidor_id,
    tasa_cambio_dia,
    subtotal_bs,
    total_bs,
    estado,
    monto_pendiente_usd,
    items,
    pagos,
  }: {
    id: string;
    fecha_hora: string;
    cliente_nombre: string | null;
    cliente_cedula: string | null;
    cliente_direccion: string | null;
    canal?: string | null;
    repartidor_id?: string | null;
    tasa_cambio_dia: number;
    subtotal_bs: number;
    total_bs: number;
    estado: string;
    monto_pendiente_usd: number | null;
    items: ItemVenta[];
    pagos: PagoVenta[];
  } = body;

  if (!id || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Agrega al menos un producto antes de cobrar." }, { status: 400 });
  }
  for (const item of items) {
    if (!item.producto_id || !(item.cantidad > 0)) {
      return NextResponse.json({ error: "Una línea del carrito tiene cantidad inválida." }, { status: 400 });
    }
  }
  if (estado === "CREDITO_PENDIENTE" && !cliente_cedula) {
    return NextResponse.json({ error: "Para dejar un saldo a crédito, selecciona primero al cliente." }, { status: 400 });
  }

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);

  // Idempotencia: si esta venta (mismo id) ya se guardó en un intento
  // anterior, se devuelve el ticket que ya quedó en vez de duplicarla.
  const yaExiste = await db.execute({ sql: "SELECT numero_ticket FROM ventas WHERE id = ?", args: [id] });
  if (yaExiste.rows[0]) {
    return NextResponse.json({ numero_ticket: String(yaExiste.rows[0].numero_ticket) });
  }

  const tx = await db.transaction("write");
  try {
    // Venta a crédito: el cliente tiene que existir y quedar con crédito
    // autorizado — igual que Venta.tsx del escritorio, que lo pregunta y
    // lo autoriza sobre la marcha si hacía falta (acá ya se preguntó del
    // lado del cliente antes de mandar la venta).
    if (estado === "CREDITO_PENDIENTE" && cliente_cedula) {
      const clienteRes = await tx.execute({ sql: "SELECT id, credito_autorizado FROM clientes WHERE cedula = ?", args: [cliente_cedula] });
      const cliente = clienteRes.rows[0];
      if (!cliente) {
        await tx.rollback();
        return NextResponse.json({ error: "Ese cliente no existe — no se puede dejar a crédito." }, { status: 400 });
      }
      if (!cliente.credito_autorizado) {
        await tx.execute({ sql: "UPDATE clientes SET credito_autorizado = 1 WHERE id = ?", args: [cliente.id] });
      }
    }

    const configRes = await tx.execute("SELECT prefijo_caja, proximo_numero_ticket FROM config WHERE id = 1");
    const configFila = configRes.rows[0];
    if (!configFila) {
      await tx.rollback();
      return NextResponse.json({ error: "No se encontró la configuración." }, { status: 500 });
    }
    const prefijo = String(configFila.prefijo_caja);
    const numeroConfig = Number(configFila.proximo_numero_ticket);

    // El contador puede haber quedado atrasado — se toma el mayor entre
    // el contador y el máximo ya existente en ventas con este prefijo,
    // para no repetir nunca un número ya usado.
    const maxRes = await tx.execute({
      sql: `SELECT MAX(CAST(SUBSTR(numero_ticket, LENGTH(?) + 2) AS INTEGER)) as maximo
            FROM ventas WHERE numero_ticket LIKE ? || '-%'`,
      args: [prefijo, prefijo],
    });
    const maxExistente = Number(maxRes.rows[0]?.maximo ?? 0);
    const numero = Math.max(numeroConfig, maxExistente + 1);
    const numeroTicket = `${prefijo}-${String(numero).padStart(6, "0")}`;

    await tx.execute({
      sql: `INSERT INTO ventas (id, numero_ticket, fecha_hora, cliente_nombre, cliente_cedula, cliente_direccion, vendedor_id, vendedor_nombre, tasa_cambio_dia, subtotal_bs, iva_bs, total_bs, estado, monto_pendiente_usd, canal, pedido_delivery_id, repartidor_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, NULL, ?)`,
      args: [
        id,
        numeroTicket,
        fecha_hora ?? ahoraVenezuela(),
        cliente_nombre || null,
        cliente_cedula || null,
        cliente_direccion || null,
        sesion.usuarioId,
        sesion.usuarioNombre,
        tasa_cambio_dia,
        subtotal_bs,
        total_bs,
        estado,
        monto_pendiente_usd ?? null,
        canal === "DELIVERY" ? "DELIVERY" : "TIENDA",
        canal === "DELIVERY" ? repartidor_id || null : null,
      ],
    });

    const fecha = fecha_hora ?? ahoraVenezuela();
    for (const item of items) {
      const subtotalLinea = item.precio_unit_bs * item.cantidad;

      const stockRes = await tx.execute({ sql: "SELECT stock_actual FROM productos WHERE id = ?", args: [item.producto_id] });
      const filaStock = stockRes.rows[0];
      if (!filaStock) {
        await tx.rollback();
        return NextResponse.json({ error: "Un producto del carrito ya no existe." }, { status: 400 });
      }
      const stockAntes = Number(filaStock.stock_actual);
      const stockInsuficiente = item.cantidad > stockAntes;

      await tx.execute({
        sql: `INSERT INTO venta_items (id, venta_id, producto_id, cantidad, precio_unit_bs, subtotal_bs, stock_insuficiente, stock_disponible_al_vender)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [uuid(), id, item.producto_id, item.cantidad, item.precio_unit_bs, subtotalLinea, stockInsuficiente ? 1 : 0, stockInsuficiente ? stockAntes : null],
      });

      await tx.execute({
        sql: "UPDATE productos SET stock_actual = MAX(0, stock_actual - ?) WHERE id = ?",
        args: [item.cantidad, item.producto_id],
      });

      // Consumo FIFO del stock contra lotes_producto — mismo criterio que
      // consumir_stock_fifo en comandos.rs.
      let restante = item.cantidad;
      while (restante > 0.0001) {
        const loteRes = await tx.execute({
          sql: `SELECT id, cantidad_restante FROM lotes_producto
                WHERE producto_id = ? AND cantidad_restante > 0
                ORDER BY creado_at ASC, rowid ASC LIMIT 1`,
          args: [item.producto_id],
        });
        const lote = loteRes.rows[0];
        if (!lote) break;
        const disponible = Number(lote.cantidad_restante);
        const consumido = Math.min(restante, disponible);
        await tx.execute({
          sql: "UPDATE lotes_producto SET cantidad_restante = cantidad_restante - ? WHERE id = ?",
          args: [consumido, lote.id],
        });
        restante -= consumido;
      }

      await tx.execute({
        sql: `INSERT INTO movimientos_inventario (id, producto_id, tipo, cantidad, motivo, referencia, created_at)
              VALUES (?, ?, 'SALIDA', ?, 'Venta en caja', ?, ?)`,
        args: [uuid(), item.producto_id, item.cantidad, id, fecha],
      });
    }

    for (const pago of pagos ?? []) {
      await tx.execute({
        sql: `INSERT INTO pagos (id, venta_id, metodo, monto_bs, referencia)
              VALUES (?, ?, ?, ?, ?)`,
        args: [uuid(), id, pago.metodo, pago.monto_bs, pago.referencia || null],
      });
    }

    await tx.execute({ sql: "UPDATE config SET proximo_numero_ticket = ? WHERE id = 1", args: [numero + 1] });

    await tx.commit();
    return NextResponse.json({ numero_ticket: numeroTicket });
  } catch (e) {
    try {
      await tx.rollback();
    } catch {
      // La conexión ya pudo haberse cerrado sola al fallar.
    }
    return NextResponse.json({ error: `No se pudo registrar la venta: ${String(e)}` }, { status: 500 });
  } finally {
    tx.close();
  }
}
