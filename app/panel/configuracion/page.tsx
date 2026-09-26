import { exigirAdmin } from "@/lib/contexto";
import ConfiguracionClient from "./ConfiguracionClient";

// Mismas 3 secciones ocultables que SECCIONES_PERSONALIZABLES en
// src/personalizacion.ts del escritorio - agregar una nueva ahí también
// implica agregarla acá a mano (no hay forma de leerla dinámicamente
// desde el frontend web sin duplicar el archivo entero).
const SECCIONES_PERSONALIZABLES = [
  { key: "venta.consumo_interno", label: "Consumo interno del día", descripcion: "La sección para registrar mermas, uso propio o muestras, en Venta." },
  { key: "venta.avances_efectivo", label: "Avances de efectivo del día", descripcion: "La sección para registrar avances y capital externo, en Venta." },
  { key: "delivery", label: "Delivery", descripcion: "Repartidores, canal delivery en Venta/Facturas, y la integración con la app de delivery." },
];

export default async function ConfiguracionPage() {
  const { db } = await exigirAdmin();
  const res = await db.execute("SELECT nombre_negocio, tasa_cambio_dia, secciones_ocultas FROM config WHERE id = 1");
  const fila = res.rows[0];

  let ocultas: string[] = [];
  try {
    ocultas = JSON.parse(String(fila?.secciones_ocultas ?? "[]"));
  } catch {
    ocultas = [];
  }

  return (
    <ConfiguracionClient
      nombreNegocio={String(fila?.nombre_negocio ?? "")}
      tasaHoy={Number(fila?.tasa_cambio_dia ?? 1)}
      seccionesOcultas={ocultas}
      seccionesPersonalizables={SECCIONES_PERSONALIZABLES}
    />
  );
}
