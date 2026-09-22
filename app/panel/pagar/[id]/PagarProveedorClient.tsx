"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { METODOS_PAGO, monedaDeMetodo, EPS } from "@/lib/dinero";

type FacturaPendiente = {
  id: string;
  numero_factura: string;
  fecha: string;
  monto_total_usd: number;
  monto_pagado_usd: number;
  estado: string;
};

function diasTranscurridos(fecha: string): number {
  const inicio = new Date(fecha.replace(" ", "T")).getTime();
  return Math.max(0, Math.floor((Date.now() - inicio) / 86_400_000));
}

function colorVencimiento(dias: number): string {
  if (dias > 30) return "text-red-600";
  if (dias > 15) return "text-amber-600";
  return "text-gray-400";
}

function FilaFactura({ factura, tasaHoy }: { factura: FacturaPendiente; tasaHoy: number }) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [monto, setMonto] = useState("");
  const [tasa, setTasa] = useState(String(tasaHoy));
  const [metodo, setMetodo] = useState<string>("EFECTIVO");
  const [referencia, setReferencia] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const saldoUsd = factura.monto_total_usd - factura.monto_pagado_usd;
  const dias = diasTranscurridos(factura.fecha);
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
    if (usdEquivalente > saldoUsd + EPS) {
      setMensaje(`Ese monto equivale a USD ${usdEquivalente.toFixed(2)}, pero el saldo es de solo USD ${saldoUsd.toFixed(2)}.`);
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/pago-proveedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factura_compra_id: factura.id,
          monto_usd: usdEquivalente,
          tasa_cambio_dia: tasaNum,
          monto_bs: usdEquivalente * tasaNum,
          metodo,
          referencia: referencia.trim() || null,
        }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setMensaje(datos.error ?? "No se pudo registrar el pago.");
        return;
      }
      setMonto("");
      setReferencia("");
      setAbierta(false);
      router.refresh();
    } catch {
      setMensaje("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
      <button className="w-full text-left" onClick={() => setAbierta((v) => !v)}>
        <div className="flex items-center justify-between">
          <p className="font-medium">{factura.numero_factura}</p>
          <p className={`text-xs ${colorVencimiento(dias)}`}>{dias === 0 ? "hoy" : `hace ${dias} días`}</p>
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-gray-400">
            {factura.estado === "PARCIAL" ? `Pagado USD ${factura.monto_pagado_usd.toFixed(2)} de ${factura.monto_total_usd.toFixed(2)}` : "Sin abonos"}
          </p>
          <p className="text-sm font-semibold text-kaxa-700">Saldo USD {saldoUsd.toFixed(2)}</p>
        </div>
      </button>

      {abierta && (
        <div className="mt-4 pt-4 border-t border-kaxa-100">
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

          <label className="block text-sm font-medium mb-1">Referencia (opcional)</label>
          <input
            className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
          />

          {montoNum > 0 && <p className="text-xs text-gray-500 mb-3">Equivale a USD {usdEquivalente.toFixed(2)}</p>}
          {mensaje && <p className="text-red-600 text-sm mb-3">{mensaje}</p>}

          <button
            onClick={confirmar}
            disabled={guardando}
            className="w-full rounded-lg bg-kaxa-600 text-white font-medium py-2.5 disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Confirmar pago"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function PagarProveedorClient({
  proveedorNombre,
  facturas,
  tasaHoy,
}: {
  proveedorNombre: string;
  facturas: FacturaPendiente[];
  tasaHoy: number;
}) {
  const totalUsd = facturas.reduce((acc, f) => acc + (f.monto_total_usd - f.monto_pagado_usd), 0);

  return (
    <>
      <Link href="/panel/pagar" className="text-sm text-kaxa-600 mb-4 inline-block">
        ← Cuentas por pagar
      </Link>
      <h1 className="text-xl font-semibold mb-1">{proveedorNombre}</h1>
      <p className="text-sm text-gray-500 mb-6">Saldo total: USD {totalUsd.toFixed(2)}</p>

      <div className="flex flex-col gap-2">
        {facturas.map((f) => (
          <FilaFactura key={f.id} factura={f} tasaHoy={tasaHoy} />
        ))}
      </div>
    </>
  );
}
