import Link from "next/link";
import { obtenerContexto } from "@/lib/contexto";
import { normalizarTexto, sqlSinAcentos } from "@/lib/busqueda";
import NavTabs from "@/components/NavTabs";

function hoyISO() {
  // America/Caracas, UTC-4 fijo.
  return new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
}

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  COMPLETADA: { texto: "Completada", clase: "bg-green-50 text-green-700" },
  CREDITO_PENDIENTE: { texto: "Crédito pendiente", clase: "bg-amber-50 text-amber-700" },
  CREDITO_PAGADO: { texto: "Crédito pagado", clase: "bg-green-50 text-green-700" },
};

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: { desde?: string; hasta?: string; q?: string };
}) {
  const { sesion, db } = await obtenerContexto();

  const desde = searchParams.desde || hoyISO();
  const hasta = searchParams.hasta || hoyISO();
  const termCrudo = (searchParams.q || "").trim();
  const term = termCrudo ? `%${termCrudo}%` : "%";
  const termSinAcentos = termCrudo ? `%${normalizarTexto(termCrudo)}%` : "%";

  // Misma consulta que Facturas.tsx del escritorio — una venta a crédito
  // ya pagada también aparece si el rango filtrado coincide con el día en
  // que se terminó de pagar, no solo el día en que se dio el crédito.
  const facturasRes = await db.execute({
    sql: `SELECT id, numero_ticket, fecha_hora, cliente_nombre, cliente_cedula, total_bs, estado
          FROM ventas
          WHERE (
            date(fecha_hora) BETWEEN ? AND ?
            OR (estado = 'CREDITO_PAGADO' AND date((SELECT MAX(created_at) FROM cobros_cliente WHERE venta_id = ventas.id)) BETWEEN ? AND ?)
          )
            AND (numero_ticket LIKE ? OR ${sqlSinAcentos("cliente_nombre")} LIKE ? OR cliente_cedula LIKE ?)
          ORDER BY fecha_hora DESC
          LIMIT 100`,
    args: [desde, hasta, desde, hasta, term, termSinAcentos, term],
  });

  const facturas = facturasRes.rows.map((r) => ({
    id: String(r.id),
    numero_ticket: String(r.numero_ticket),
    fecha_hora: String(r.fecha_hora),
    cliente_nombre: r.cliente_nombre ? String(r.cliente_nombre) : null,
    total_bs: Number(r.total_bs),
    estado: String(r.estado),
  }));

  return (
    <main className="min-h-screen px-4 py-8 pb-28 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-1">Facturas</h1>
      <p className="text-sm text-gray-500 mb-4">Buscar ventas por ticket, cliente o cédula.</p>

      <form className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <input type="date" name="desde" defaultValue={desde} className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm" />
          <input type="date" name="hasta" defaultValue={hasta} className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm" />
        </div>
        <input
          name="q"
          defaultValue={termCrudo}
          placeholder="N° de ticket, cliente o cédula"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-kaxa-600 text-white font-medium py-2 text-sm">
          Buscar
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {facturas.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Sin facturas en ese rango/búsqueda.</p>}
        {facturas.map((f) => {
          const estado = ESTADOS[f.estado] ?? { texto: f.estado, clase: "bg-gray-50 text-gray-600" };
          return (
            <Link
              key={f.id}
              href={`/panel/facturas/${f.id}`}
              className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{f.numero_ticket}</p>
                <p className="text-xs text-gray-400">
                  {f.cliente_nombre ?? "Consumidor final"} ·{" "}
                  {new Date(f.fecha_hora.replace(" ", "T")).toLocaleString("es-VE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">Bs {f.total_bs.toFixed(2)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${estado.clase}`}>{estado.texto}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <NavTabs rol={sesion.rol} />
    </main>
  );
}
