import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/contexto";
import ProveedorFichaClient from "./ProveedorFichaClient";

export default async function ProveedorFichaPage({ params }: { params: { id: string } }) {
  const { db } = await exigirAdmin();

  const proveedorRes = await db.execute({
    sql: "SELECT id, nombre, rif, direccion, telefono FROM proveedores WHERE id = ?",
    args: [params.id],
  });
  const fila = proveedorRes.rows[0];
  if (!fila) notFound();

  const [saldoRes, historialRes] = await Promise.all([
    db.execute({
      sql: "SELECT COALESCE(SUM(monto_total_usd - monto_pagado_usd), 0) as total FROM facturas_compra WHERE proveedor_id = ? AND estado != 'PAGADA'",
      args: [params.id],
    }),
    db.execute({
      sql: `SELECT id, numero_factura, fecha, moneda, monto_total_usd, monto_pagado_usd, tasa_cambio_dia, estado
            FROM facturas_compra WHERE proveedor_id = ? ORDER BY fecha DESC LIMIT 50`,
      args: [params.id],
    }),
  ]);

  const proveedor = {
    id: String(fila.id),
    nombre: String(fila.nombre),
    rif: String(fila.rif),
    direccion: fila.direccion == null ? null : String(fila.direccion),
    telefono: fila.telefono == null ? null : String(fila.telefono),
  };

  const historial = historialRes.rows.map((r) => ({
    id: String(r.id),
    numero_factura: String(r.numero_factura),
    fecha: String(r.fecha),
    monto_total_usd: Number(r.monto_total_usd),
    monto_pagado_usd: Number(r.monto_pagado_usd),
    tasa_cambio_dia: Number(r.tasa_cambio_dia),
    estado: String(r.estado),
  }));

  return <ProveedorFichaClient proveedor={proveedor} saldoPendienteUsd={Number(saldoRes.rows[0]?.total ?? 0)} historial={historial} />;
}
