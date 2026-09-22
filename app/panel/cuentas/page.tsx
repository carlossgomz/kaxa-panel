import { exigirAdmin } from "@/lib/contexto";
import { cuentasVinculadas } from "@/lib/cuentas";
import CuentasClient from "./CuentasClient";

export default async function CuentasPage() {
  const { sesion } = await exigirAdmin();
  const vinculadas = await cuentasVinculadas(sesion.slug);

  return <CuentasClient vinculadas={vinculadas} cuentaIdPropia={sesion.usuarioId} />;
}
