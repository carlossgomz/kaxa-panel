import { exigirAdmin } from "@/lib/contexto";
import { cuentasVinculadas, invitacionesPendientes } from "@/lib/cuentas";
import CuentasClient from "./CuentasClient";

export default async function CuentasPage() {
  const { sesion } = await exigirAdmin();
  const [vinculadas, invitaciones] = await Promise.all([
    cuentasVinculadas(sesion.slug),
    invitacionesPendientes(sesion.slug),
  ]);

  return <CuentasClient vinculadas={vinculadas} invitaciones={invitaciones} cuentaIdPropia={sesion.usuarioId} />;
}
