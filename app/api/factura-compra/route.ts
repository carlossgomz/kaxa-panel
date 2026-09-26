import { NextRequest, NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";

function ahoraVenezuela(): string {
  const ahora = new Date(Date.now() - 4 * 3600 * 1000);
  return ahora.toISOString().slice(0, 19).replace("T", " ");
}

type ItemFacturaCompra = {
  producto_id: string;
  es_nuevo: boolean;
  codigo_barra: string;
  codigo_proveedor: string | null;
  nombre: string;
  categoria_nombre: string | null;
  cajas: number;
  unidad_suelta: number;
  unidades_por_paquete: number;
  cantidad_total: number;
  costo_unitario_usd: number;
  margen_aplicado: number;
  precio_venta_bs: number;
  aplica_iva: boolean;
  tasa_iva_aplicada: number;
  aplica_descuento: boolean;
  descuento_aplicado: number;
  costo_vigente_usd: number;
  margen_vigente: number;
  precio_venta_vigente_bs: number;
};

// Guarda una factura de compra completa: cabecera, productos nuevos si
// hace falta, líneas, actualización de costo/margen/precio/stock de cada
// producto y su movimiento de inventario — réplica exacta de
// guardar_factura_compra + insertar_items_factura_interna en
// src-tauri/src/comandos.rs, todo en una sola transacción atómica.
export async function POST(req: NextRequest) {
  const sesion = obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  if (sesion.rol !== "ADMIN") return NextResponse.json({ error: "Solo un administrador puede registrar compras." }, { status: 403 });

  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const body = await req.json();
  const proveedor_id = String(body.proveedor_id || "");
  const numero_factura = String(body.numero_factura || "").trim();
  const moneda = body.moneda === "VES" ? "VES" : "USD";
  const tasa_cambio_dia = Number(body.tasa_cambio_dia);
  const items = (body.items || []) as ItemFacturaCompra[];

  if (!proveedor_id) return NextResponse.json({ error: "Selecciona un proveedor." }, { status: 400 });
  if (!numero_factura) return NextResponse.json({ error: "Falta el número de factura." }, { status: 400 });
  if (!tasa_cambio_dia || tasa_cambio_dia <= 0) {
    return NextResponse.json({ error: "La tasa del día de esta compra debe ser mayor a 0." }, { status: 400 });
  }
  if (items.length === 0) return NextResponse.json({ error: "Agrega al menos un producto a la factura." }, { status: 400 });
  for (const item of items) {
    if (item.cantidad_total <= 0) {
      return NextResponse.json({ error: `"${item.nombre}" tiene una cantidad inválida.` }, { status: 400 });
    }
  }

  const montoTotalUsd = items.reduce((acc, item) => acc + item.costo_unitario_usd * item.cantidad_total, 0);

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);
  const tx = await db.transaction("write");
  try {
    const facturaId = crypto.randomUUID();
    const fecha = ahoraVenezuela();

    await tx.execute({
      sql: `INSERT INTO facturas_compra (id, proveedor_id, numero_factura, fecha, moneda, tasa_cambio_dia, monto_total_usd)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [facturaId, proveedor_id, numero_factura, fecha, moneda, tasa_cambio_dia, montoTotalUsd],
    });

    for (const item of items) {
      if (item.es_nuevo) {
        let categoriaId: string | null = null;
        const nombreCategoria = item.categoria_nombre?.trim();
        if (nombreCategoria) {
          const existente = await tx.execute({
            sql: "SELECT id FROM categorias WHERE nombre = ?",
            args: [nombreCategoria],
          });
          if (existente.rows[0]) {
            categoriaId = String(existente.rows[0].id);
          } else {
            categoriaId = crypto.randomUUID();
            await tx.execute({
              sql: "INSERT INTO categorias (id, nombre) VALUES (?, ?)",
              args: [categoriaId, nombreCategoria],
            });
          }
        }

        await tx.execute({
          sql: `INSERT INTO productos (id, codigo_barra, codigo_proveedor, nombre, categoria_id, costo_actual_usd, margen_porcentaje, precio_venta_bs, stock_actual, unidades_por_paquete)
                VALUES (?, ?, ?, ?, ?, 0, ?, 0, 0, ?)`,
          args: [item.producto_id, item.codigo_barra, item.codigo_proveedor, item.nombre, categoriaId, item.margen_aplicado, item.unidades_por_paquete],
        });
      }

      await tx.execute({
        sql: `INSERT INTO items_factura_compra (id, factura_compra_id, producto_id, cantidad, costo_unitario_usd, margen_aplicado, precio_venta_calculado, cajas, unidad_suelta, unidades_por_paquete, aplica_iva, tasa_iva_aplicada, aplica_descuento, descuento_aplicado)
              VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          facturaId,
          item.producto_id,
          item.cantidad_total,
          item.costo_unitario_usd,
          item.margen_aplicado,
          item.precio_venta_bs,
          item.cajas,
          item.unidad_suelta,
          item.unidades_por_paquete,
          item.aplica_iva,
          item.tasa_iva_aplicada,
          item.aplica_descuento,
          item.descuento_aplicado,
        ],
      });

      await tx.execute({
        sql: `UPDATE productos
              SET costo_actual_usd = ?, margen_porcentaje = ?, precio_venta_bs = ?,
                  stock_actual = stock_actual + ?, unidades_por_paquete = ?, codigo_proveedor = ?, activo = 1
              WHERE id = ?`,
        args: [
          item.costo_vigente_usd,
          item.margen_vigente,
          item.precio_venta_vigente_bs,
          item.cantidad_total,
          item.unidades_por_paquete,
          item.codigo_proveedor,
          item.producto_id,
        ],
      });

      await tx.execute({
        sql: `INSERT INTO lotes_producto (id, producto_id, costo_unitario_usd, margen_porcentaje, cantidad_inicial, cantidad_restante, factura_compra_id)
              VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?)`,
        args: [item.producto_id, item.costo_unitario_usd, item.margen_aplicado, item.cantidad_total, item.cantidad_total, facturaId],
      });

      await tx.execute({
        sql: `INSERT INTO movimientos_inventario (id, producto_id, tipo, cantidad, motivo, referencia, created_at)
              VALUES (lower(hex(randomblob(16))), ?, 'ENTRADA', ?, 'Compra a proveedor', ?, ?)`,
        args: [item.producto_id, item.cantidad_total, facturaId, fecha],
      });

      const codigoProveedor = item.codigo_proveedor?.trim();
      if (codigoProveedor) {
        await tx.execute({
          sql: `INSERT INTO codigos_proveedor_producto (id, producto_id, proveedor_id, codigo)
                VALUES (lower(hex(randomblob(16))), ?, ?, ?)
                ON CONFLICT(proveedor_id, codigo) DO UPDATE SET producto_id = excluded.producto_id`,
          args: [item.producto_id, proveedor_id, codigoProveedor],
        });
      }
    }

    await tx.commit();
    return NextResponse.json({ ok: true, factura_id: facturaId, monto_total_usd: montoTotalUsd });
  } catch (e) {
    try {
      await tx.rollback();
    } catch {
      // La conexión ya pudo haberse cerrado sola al fallar.
    }
    return NextResponse.json({ error: `No se pudo guardar la factura: ${String(e)}` }, { status: 500 });
  } finally {
    tx.close();
  }
}
