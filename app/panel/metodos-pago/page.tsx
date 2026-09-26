import { exigirAdmin } from "@/lib/contexto";
import MetodosPagoClient from "./MetodosPagoClient";

export default async function MetodosPagoPage() {
  const { db } = await exigirAdmin();
  try {
    const res = await db.execute("SELECT id, nombre, moneda, activo, es_sistema FROM metodos_pago ORDER BY created_at");
    const metodos = res.rows.map((r) => ({
      id: String(r.id),
      nombre: String(r.nombre),
      moneda: String(r.moneda),
      activo: Number(r.activo),
      es_sistema: Number(r.es_sistema),
    }));
    return <MetodosPagoClient metodosIniciales={metodos} soportado />;
  } catch {
    // Day Express corre la build especial de pos-minimarket, que nunca
    // tuvo tabla metodos_pago ni esta pantalla en su escritorio — se avisa
    // en vez de tumbar la página (mismo criterio que Personalización en
    // Configuración).
    return <MetodosPagoClient metodosIniciales={[]} soportado={false} />;
  }
}
