import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/contexto";
import NavTabs from "@/components/NavTabs";
import PagarProveedorClient from "./PagarProveedorClient";

export default async function ProveedorPagarPage({ params }: { params: { id: string } }) {
  const { sesion, db } = await exigirAdmin();

  const [config, proveedorRes, facturasRes] = await Promise.all([
    db.execute("SELECT tasa_cambio_dia FROM config WHERE id = 1"),
    db.execute({ sql: "SELECT nombre FROM proveedores WHERE id = ?", args: [params.id] }),
    db.execute({
      sql: `SELECT id, numero_factura, fecha, monto_total_usd, monto_pagado_usd, estado
            FROM facturas_compra WHERE proveedor_id = ? AND estado != 'PAGADA'
            ORDER BY fecha`,
      args: [params.id],
    }),
  ]);

  const filaProveedor = proveedorRes.rows[0];
  if (!filaProveedor) notFound();

  const tasa = Number(config.rows[0]?.tasa_cambio_dia ?? 1) || 1;
  const facturas = facturasRes.rows.map((r) => ({
    id: String(r.id),
    numero_factura: String(r.numero_factura),
    fecha: String(r.fecha),
    monto_total_usd: Number(r.monto_total_usd),
    monto_pagado_usd: Number(r.monto_pagado_usd),
    estado: String(r.estado),
  }));

  return (
    <main className="min-h-screen px-4 py-8 pb-28 max-w-md mx-auto">
      <PagarProveedorClient proveedorNombre={String(filaProveedor.nombre)} facturas={facturas} tasaHoy={tasa} />
      <NavTabs rol={sesion.rol} />
    </main>
  );
}
