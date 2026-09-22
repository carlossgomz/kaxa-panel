import { obtenerContexto } from "@/lib/contexto";
import VentaClient from "./VentaClient";

export default async function VentaPage() {
  const { db } = await obtenerContexto();
  const config = await db.execute("SELECT tasa_cambio_dia FROM config WHERE id = 1");
  const tasa = Number(config.rows[0]?.tasa_cambio_dia ?? 1) || 1;

  return <VentaClient tasaHoy={tasa} />;
}
