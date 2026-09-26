import { obtenerContexto } from "@/lib/contexto";
import ClientesClient from "./ClientesClient";

export default async function ClientesPage() {
  const { db } = await obtenerContexto();
  const res = await db.execute(
    "SELECT id, nombre, cedula, telefono, direccion, cliente_app_id, credito_autorizado, es_empleado FROM clientes ORDER BY nombre"
  );
  const clientes = res.rows.map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre),
    cedula: String(r.cedula),
    telefono: r.telefono == null ? null : String(r.telefono),
    direccion: r.direccion == null ? null : String(r.direccion),
    cliente_app_id: r.cliente_app_id == null ? null : String(r.cliente_app_id),
    credito_autorizado: Number(r.credito_autorizado),
    es_empleado: Number(r.es_empleado),
  }));

  return <ClientesClient clientesIniciales={clientes} />;
}
