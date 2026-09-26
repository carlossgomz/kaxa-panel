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
  const { db, negocio } = await exigirAdmin();
  // Columnas presentes en TODAS las ediciones (incluida la build especial de
  // Day Express, que no tiene secciones_ocultas — ver abajo).
  const res = await db.execute(
    "SELECT nombre_negocio, tasa_cambio_dia, logo_base64, rif_negocio, direccion_negocio, telefono_negocio FROM config WHERE id = 1"
  );
  const fila = res.rows[0];

  // secciones_ocultas no existe en la build de Day Express (no tiene la
  // categoría "Personalización" en su Configuracion de escritorio, porque
  // directamente no tiene esa pantalla) — aunque su negocio esté marcado
  // como "avanzado" en el directorio para poder usar Kaxa Móvil. Se separa
  // en su propia consulta para que si esa columna no existe, solo se pierda
  // esta sección en vez de tumbar toda la página (pasó justo eso: Day
  // Express veía un error 500 al abrir Configuración).
  let ocultas: string[] = [];
  let soportaPersonalizacion = true;
  try {
    const resOcultas = await db.execute("SELECT secciones_ocultas FROM config WHERE id = 1");
    ocultas = JSON.parse(String(resOcultas.rows[0]?.secciones_ocultas ?? "[]"));
  } catch {
    soportaPersonalizacion = false;
  }

  return (
    <ConfiguracionClient
      nombreNegocio={String(fila?.nombre_negocio ?? "")}
      tasaHoy={Number(fila?.tasa_cambio_dia ?? 1)}
      seccionesOcultas={ocultas}
      seccionesPersonalizables={SECCIONES_PERSONALIZABLES}
      soportaPersonalizacion={soportaPersonalizacion}
      logo={fila?.logo_base64 ? String(fila.logo_base64) : null}
      rifNegocio={fila?.rif_negocio ? String(fila.rif_negocio) : ""}
      direccionNegocio={fila?.direccion_negocio ? String(fila.direccion_negocio) : ""}
      telefonoNegocio={fila?.telefono_negocio ? String(fila.telefono_negocio) : ""}
      plan={negocio.edicion}
    />
  );
}
