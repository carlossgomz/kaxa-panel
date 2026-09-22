import { obtenerContexto } from "@/lib/contexto";
import VentaClient from "./VentaClient";

export default async function VentaPage() {
  const { db } = await obtenerContexto();
  const [config, repartidoresRes] = await Promise.all([
    db.execute("SELECT tasa_cambio_dia, secciones_ocultas FROM config WHERE id = 1"),
    db.execute("SELECT id, nombre FROM repartidores WHERE activo = 1 ORDER BY nombre"),
  ]);
  const tasa = Number(config.rows[0]?.tasa_cambio_dia ?? 1) || 1;

  // Igual que seccionOculta() en src/personalizacion.ts del escritorio —
  // cada negocio puede haber desactivado la sección de delivery desde
  // Configuración si no la usa. No es exclusivo de Day Express: viene de
  // pos-avanzado, la edición que se vende a clientes.
  let deliveryOculto = false;
  try {
    const ocultas: string[] = JSON.parse(String(config.rows[0]?.secciones_ocultas || "[]"));
    deliveryOculto = ocultas.includes("delivery");
  } catch {
    deliveryOculto = false;
  }

  const repartidores = repartidoresRes.rows.map((r) => ({ id: String(r.id), nombre: String(r.nombre) }));

  return <VentaClient tasaHoy={tasa} repartidores={repartidores} mostrarDelivery={!deliveryOculto} />;
}
