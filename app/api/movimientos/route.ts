import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";

function ahoraVenezuela(): string {
  const ahora = new Date(Date.now() - 4 * 3600 * 1000);
  return ahora.toISOString().slice(0, 19).replace("T", " ");
}

export async function GET(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion || sesion.rol !== "ADMIN") return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const productoId = req.nextUrl.searchParams.get("producto_id");
  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  const base = `SELECT m.id, m.producto_id, p.nombre as producto_nombre, m.tipo, m.cantidad, m.motivo, m.created_at
                FROM movimientos_inventario m JOIN productos p ON p.id = m.producto_id`;

  const res = productoId
    ? await db.execute({ sql: `${base} WHERE m.producto_id = ? ORDER BY m.created_at DESC LIMIT 100`, args: [productoId] })
    : await db.execute(`${base} ORDER BY m.created_at DESC LIMIT 50`);

  const movimientos = res.rows.map((r) => ({
    id: String(r.id),
    producto_id: String(r.producto_id),
    producto_nombre: String(r.producto_nombre),
    tipo: String(r.tipo),
    cantidad: Number(r.cantidad),
    motivo: r.motivo == null ? null : String(r.motivo),
    created_at: String(r.created_at),
  }));

  let totales: { entradas: number; salidas: number } | null = null;
  if (productoId) {
    const totalesRes = await db.execute({
      sql: "SELECT tipo, SUM(cantidad) as total FROM movimientos_inventario WHERE producto_id = ? GROUP BY tipo",
      args: [productoId],
    });
    let entradas = 0;
    let salidas = 0;
    for (const r of totalesRes.rows) {
      if (r.tipo === "ENTRADA") entradas = Number(r.total);
      if (r.tipo === "SALIDA") salidas = Number(r.total);
    }
    totales = { entradas, salidas };
  }

  return NextResponse.json({ movimientos, totales });
}

// Entrada o salida manual de stock (mermas, donaciones, corrección de
// conteo físico, etc.) - réplica de ajustar_stock_interna en
// src-tauri/src/comandos.rs, pero sin la cola de reintento offline (acá
// no aplica: si la petición HTTP falla, simplemente no se guardó nada).
export async function POST(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion || sesion.rol !== "ADMIN") return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const { producto_id, tipo, cantidad, motivo } = await req.json();
  if (!producto_id || (tipo !== "ENTRADA" && tipo !== "SALIDA")) {
    return NextResponse.json({ error: "Faltan datos o el tipo de movimiento no es válido." }, { status: 400 });
  }
  const cant = Number(cantidad);
  if (!cant || cant <= 0) return NextResponse.json({ error: "La cantidad debe ser mayor a 0." }, { status: 400 });
  const motivoLimpio = String(motivo ?? "").trim();
  if (!motivoLimpio) return NextResponse.json({ error: "Indica un motivo para el movimiento." }, { status: 400 });

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  const tx = await db.transaction("write");
  try {
    const existe = await tx.execute({ sql: "SELECT stock_actual FROM productos WHERE id = ?", args: [producto_id] });
    if (!existe.rows[0]) {
      await tx.rollback();
      return NextResponse.json({ error: "El producto no existe." }, { status: 400 });
    }

    const delta = tipo === "ENTRADA" ? cant : -cant;
    await tx.execute({ sql: "UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?", args: [delta, producto_id] });

    // Igual que consumir_stock_fifo/crear_lote_con_costo_actual en el
    // escritorio: una salida descuenta de los lotes más viejos primero
    // (FIFO); una entrada crea un lote nuevo al costo actual del producto.
    if (tipo === "SALIDA") {
      let restante = cant;
      while (restante > 0.0001) {
        const lote = await tx.execute({
          sql: `SELECT id, cantidad_restante FROM lotes_producto WHERE producto_id = ? AND cantidad_restante > 0
                ORDER BY creado_at ASC, rowid ASC LIMIT 1`,
          args: [producto_id],
        });
        const fila = lote.rows[0];
        if (!fila) break;
        const disponible = Number(fila.cantidad_restante);
        const consumido = Math.min(restante, disponible);
        await tx.execute({
          sql: "UPDATE lotes_producto SET cantidad_restante = cantidad_restante - ? WHERE id = ?",
          args: [consumido, fila.id],
        });
        restante -= consumido;
      }
    } else {
      const productoRes = await tx.execute({ sql: "SELECT costo_actual_usd, margen_porcentaje FROM productos WHERE id = ?", args: [producto_id] });
      const p = productoRes.rows[0];
      await tx.execute({
        sql: `INSERT INTO lotes_producto (id, producto_id, costo_unitario_usd, margen_porcentaje, cantidad_inicial, cantidad_restante, factura_compra_id)
              VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, NULL)`,
        args: [producto_id, Number(p?.costo_actual_usd ?? 0), Number(p?.margen_porcentaje ?? 0), cant, cant],
      });
    }

    await tx.execute({
      sql: `INSERT INTO movimientos_inventario (id, producto_id, tipo, cantidad, motivo, referencia, created_at)
            VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, NULL, ?)`,
      args: [producto_id, tipo, cant, motivoLimpio, ahoraVenezuela()],
    });

    await tx.commit();
    return NextResponse.json({ ok: true });
  } catch (e) {
    try {
      await tx.rollback();
    } catch {
      // La conexión ya pudo haberse cerrado sola al fallar.
    }
    return NextResponse.json({ error: `No se pudo registrar el movimiento: ${String(e)}` }, { status: 500 });
  } finally {
    tx.close();
  }
}
