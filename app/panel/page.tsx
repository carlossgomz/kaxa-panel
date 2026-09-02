import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { buscarNegocio } from "@/lib/directorio";
import { clienteTurso } from "@/lib/turso";

async function totalPeriodo(db: ReturnType<typeof clienteTurso>, condicionFecha: string) {
  const r = await db.execute(
    `SELECT COALESCE(SUM(total_bs), 0) as total FROM ventas WHERE ${condicionFecha}`
  );
  return Number(r.rows[0]?.total ?? 0);
}

export default async function PanelPage() {
  const sesion = obtenerSesion();
  if (!sesion) redirect("/login");

  const negocio = await buscarNegocio(sesion.slug);
  if (!negocio) redirect("/login");

  const db = clienteTurso(negocio.turso_url, negocio.turso_token);

  const [config, hoyBs, semanaBs, mesBs] = await Promise.all([
    db.execute("SELECT tasa_cambio_dia, nombre_negocio FROM config WHERE id = 1"),
    totalPeriodo(db, "date(fecha_hora) = date('now')"),
    totalPeriodo(db, "date(fecha_hora) >= date('now', '-6 days')"),
    totalPeriodo(db, "strftime('%Y-%m', fecha_hora) = strftime('%Y-%m', 'now')")
  ]);

  const tasa = Number(config.rows[0]?.tasa_cambio_dia ?? 1) || 1;
  const nombreNegocio = (config.rows[0]?.nombre_negocio as string) ?? negocio.negocio;

  const tarjetas = [
    { titulo: "Hoy", bs: hoyBs },
    { titulo: "Últimos 7 días", bs: semanaBs },
    { titulo: "Este mes", bs: mesBs }
  ];

  return (
    <main className="min-h-screen px-4 py-8 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-kaxa-400 to-kaxa-900 flex items-center justify-center text-white font-bold text-sm">
          K
        </div>
        <span className="font-semibold">Kaxa · Panel</span>
      </div>
      <h1 className="text-xl font-semibold mt-4 mb-6">{nombreNegocio}</h1>

      <div className="flex flex-col gap-3">
        {tarjetas.map((t) => (
          <div key={t.titulo} className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-5">
            <p className="text-sm text-gray-500">{t.titulo}</p>
            <p className="text-2xl font-semibold mt-1">Bs {t.bs.toFixed(2)}</p>
            <p className="text-sm text-kaxa-600 font-medium">USD {(t.bs / tasa).toFixed(2)}</p>
          </div>
        ))}
      </div>

      <form action="/api/logout" method="post" className="mt-8">
        <button className="text-sm text-gray-500 underline">cerrar sesión</button>
      </form>
    </main>
  );
}
