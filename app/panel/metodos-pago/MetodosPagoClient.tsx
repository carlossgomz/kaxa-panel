"use client";

import { useState } from "react";

type MetodoPago = { id: string; nombre: string; moneda: string; activo: number; es_sistema: number };

export default function MetodosPagoClient({
  metodosIniciales,
  soportado,
}: {
  metodosIniciales: MetodoPago[];
  soportado: boolean;
}) {
  const [metodos, setMetodos] = useState(metodosIniciales);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [monedaNueva, setMonedaNueva] = useState<"BS" | "USD">("BS");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function recargar() {
    const res = await fetch("/api/metodos-pago");
    const datos = await res.json();
    if (datos.soportado) setMetodos(datos.metodos);
  }

  async function alternar(m: MetodoPago) {
    setMensaje(null);
    const res = await fetch("/api/metodos-pago", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, activo: m.activo ? 0 : 1 }),
    });
    const datos = await res.json();
    if (!res.ok) {
      setMensaje(datos.error ?? "No se pudo actualizar.");
      return;
    }
    setMetodos((prev) => prev.map((x) => (x.id === m.id ? { ...x, activo: m.activo ? 0 : 1 } : x)));
  }

  async function agregar() {
    setMensaje(null);
    if (!nombreNuevo.trim()) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/metodos-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreNuevo, moneda: monedaNueva }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setMensaje(datos.error ?? "No se pudo agregar.");
        return;
      }
      setNombreNuevo("");
      await recargar();
    } finally {
      setGuardando(false);
    }
  }

  if (!soportado) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-1">Métodos de pago</h1>
        <div className="bg-white dark:bg-[#141b18] rounded-2xl border border-kaxa-100 dark:border-[#2a332e] shadow-sm p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Esta tienda usa el listado fijo de métodos de pago (Efectivo, Punto de venta, Biopago,
            Pago móvil, Divisas, Transferencia) y no se puede personalizar desde acá.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Métodos de pago</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Desactiva los que tu tienda no usa — dejan de aparecer para elegir en ventas, abonos y
        pagos, pero las ventas viejas que ya los usaron se siguen viendo bien. Agrega uno nuevo si
        te falta.
      </p>

      {mensaje && <p className="text-red-600 dark:text-red-400 text-sm mb-3">{mensaje}</p>}

      <div className="bg-white dark:bg-[#141b18] rounded-2xl border border-kaxa-100 dark:border-[#2a332e] shadow-sm p-4 mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400">
              <th className="pb-2">Método</th>
              <th className="pb-2">Moneda</th>
              <th className="pb-2">Activo</th>
            </tr>
          </thead>
          <tbody>
            {metodos.map((m) => (
              <tr key={m.id} className="border-t border-kaxa-100 dark:border-[#2a332e]">
                <td className="py-2">{m.nombre.split("_").join(" ")}</td>
                <td className="py-2">{m.moneda === "USD" ? "$" : "Bs"}</td>
                <td className="py-2">
                  <input type="checkbox" checked={m.activo === 1} onChange={() => alternar(m)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white dark:bg-[#141b18] rounded-2xl border border-kaxa-100 dark:border-[#2a332e] shadow-sm p-4">
        <h2 className="font-semibold mb-3">Agregar método nuevo</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 dark:border-[#2a332e] dark:bg-[#0d1210] dark:text-gray-100 px-3 py-2"
            placeholder="Nombre (ej. ZELLE)"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
          />
          <select
            className="rounded-lg border border-gray-300 dark:border-[#2a332e] dark:bg-[#0d1210] dark:text-gray-100 px-3 py-2"
            value={monedaNueva}
            onChange={(e) => setMonedaNueva(e.target.value as "BS" | "USD")}
          >
            <option value="BS">Bs</option>
            <option value="USD">$</option>
          </select>
          <button
            onClick={agregar}
            disabled={guardando || !nombreNuevo.trim()}
            className="rounded-lg bg-kaxa-600 text-white font-medium px-4 disabled:opacity-60"
          >
            {guardando ? "…" : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}
