import { exigirAdmin } from "@/lib/contexto";
import ProveedoresClient from "./ProveedoresClient";

export default async function ProveedoresPage() {
  const { db } = await exigirAdmin();
  const res = await db.execute("SELECT id, nombre, rif, direccion, telefono FROM proveedores ORDER BY nombre");
  const proveedores = res.rows.map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre),
    rif: String(r.rif),
    direccion: r.direccion == null ? null : String(r.direccion),
    telefono: r.telefono == null ? null : String(r.telefono),
  }));

  return <ProveedoresClient proveedoresIniciales={proveedores} />;
}
