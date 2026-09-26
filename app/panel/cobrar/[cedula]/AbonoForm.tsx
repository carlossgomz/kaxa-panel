"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { METODOS_PAGO, monedaDeMetodo, EPS } from "@/lib/dinero";

export default function AbonoForm({
  clienteCedula,
  clienteNombre,
  totalPendienteUsd,
  tasaHoy,
}: {
  clienteCedula: string;
  clienteNombre: string;
  totalPendienteUsd: number;
  tasaHoy: number;
}) {
  const router = useRouter();
  const [monto, setMonto] = useState("");
  const [tasa, setTasa] = useState(String(tasaHoy));
  const [metodo, setMetodo] = useState<string>("EFECTIVO");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);

  const monedaMetodo = monedaDeMetodo(metodo);
  const montoNum = Number(monto || "0");
  const tasaNum = Number(tasa || "0");
  const usdEquivalente = monedaMetodo === "USD" ? montoNum : tasaNum > 0 ? montoNum / tasaNum : 0;

  async function confirmar() {
    setMensaje(null);
    if (!montoNum || montoNum <= 0) {
      setMensaje("El monto debe ser mayor a 0.");
      return;
    }
    if (!tasaNum || tasaNum <= 0) {
      setMensaje("La tasa del día debe ser mayor a 0.");
      return;
    }
    if (usdEquivalente > totalPendienteUsd + EPS) {
      setMensaje(
        `Ese monto equivale a USD ${usdEquivalente.toFixed(2)}, pero la deuda total es de solo USD ${totalPendienteUsd.toFixed(2)}.`
      );
      return;
    }

    const montoTexto = monedaMetodo === "USD" ? `$${montoNum.toFixed(2)}` : `Bs ${montoNum.toFixed(2)}`;
    if (!window.confirm(`¿Registrar el abono de ${montoTexto} a ${clienteNombre}?`)) {
      return;
    }

    setGuardando(true);
    try {
      const res = await fetch("/api/abono", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_cedula: clienteCedula,
          monto_usd: usdEquivalente,
          tasa_cambio_dia: tasaNum,
          metodo,
        }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setMensaje(datos.error ?? "No se pudo registrar el abono.");
        return;
      }
      setMonto("");
      // No usamos router.refresh(): si este abono saldó toda la deuda del
      // cliente, la consulta de esta misma página ya no lo encuentra entre
      // los que tienen CREDITO_PENDIENTE y dispara notFound() (error 404) -
      // el pago quedaba guardado bien, pero sin ninguna confirmación
      // visible. En vez de eso, mostramos el éxito acá mismo y volvemos a
      // la lista general (que ya no depende de que este cliente en
      // particular siga teniendo deuda).
      setExito(true);
      setTimeout(() => {
        router.push("/panel/cobrar");
        router.refresh();
      }, 1400);
    } catch {
      setMensaje("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  if (exito) {
    return (
      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-5 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl">
          ✓
        </div>
        <h2 className="font-semibold mb-1">Abono registrado con éxito</h2>
        <p className="text-sm text-gray-500">Volviendo a la lista de cuentas por cobrar…</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-5">
      <h2 className="font-semibold mb-1">Registrar abono</h2>
      <p className="text-xs text-gray-400 mb-4">
        Se reparte solo entre las ventas pendientes, de la más vieja a la más nueva.
      </p>

      <label className="block text-sm font-medium mb-1">Método de pago</label>
      <select
        className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2"
        value={metodo}
        onChange={(e) => setMetodo(e.target.value)}
      >
        {METODOS_PAGO.map((m) => (
          <option key={m} value={m}>
            {m.split("_").join(" ")}
          </option>
        ))}
      </select>

      <label className="block text-sm font-medium mb-1">Monto ({monedaMetodo === "USD" ? "$" : "Bs"})</label>
      <input
        type="number"
        step="0.01"
        inputMode="decimal"
        className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
        placeholder="0.00"
      />

      {monedaMetodo === "BS" && (
        <>
          <label className="block text-sm font-medium mb-1">Tasa del día (Bs/$)</label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2"
            value={tasa}
            onChange={(e) => setTasa(e.target.value)}
          />
        </>
      )}

      {montoNum > 0 && (
        <p className="text-xs text-gray-500 mb-3">Equivale a USD {usdEquivalente.toFixed(2)}</p>
      )}

      {mensaje && <p className="text-red-600 text-sm mb-3">{mensaje}</p>}

      <button
        onClick={confirmar}
        disabled={guardando}
        className="w-full rounded-lg bg-kaxa-600 text-white font-medium py-2.5 transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {guardando ? "Guardando…" : "Confirmar abono"}
      </button>
    </div>
  );
}
