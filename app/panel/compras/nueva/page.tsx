import { exigirAdmin } from "@/lib/contexto";
import CompraForm from "./CompraForm";

export default async function NuevaCompraPage() {
  const { db } = await exigirAdmin();

  const [config, proveedoresRes] = await Promise.all([
    db.execute("SELECT tasa_cambio_dia FROM config WHERE id = 1"),
    db.execute("SELECT id, nombre FROM proveedores WHERE activo = 1 ORDER BY nombre"),
  ]);

  const tasa = Number(config.rows[0]?.tasa_cambio_dia ?? 1) || 1;
  const proveedores = proveedoresRes.rows.map((r) => ({ id: String(r.id), nombre: String(r.nombre) }));

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Nueva factura de compra</h1>
      <p className="text-sm text-gray-500 mb-6">Copia los datos tal cual salen en la factura del proveedor.</p>
      <CompraForm proveedoresIniciales={proveedores} tasaHoy={tasa} />
    </div>
  );
}
