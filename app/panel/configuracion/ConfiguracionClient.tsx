"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Seccion = { key: string; label: string; descripcion: string };

export default function ConfiguracionClient({
  nombreNegocio,
  tasaHoy,
  seccionesOcultas,
  seccionesPersonalizables,
}: {
  nombreNegocio: string;
  tasaHoy: number;
  seccionesOcultas: string[];
  seccionesPersonalizables: Seccion[];
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreNegocio);
  const [tasa, setTasa] = useState(String(tasaHoy));
  const [ocultas, setOcultas] = useState(seccionesOcultas);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function guardar(cambios: Record<string, unknown>, etiqueta: string) {
    setMensaje(null);
    setGuardando(etiqueta);
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      const datos = await res.json();
      if (!res.ok) {
        setMensaje(datos.error ?? "No se pudo guardar.");
        return;
      }
      router.refresh();
    } catch {
      setMensaje("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
    } finally {
      setGuardando(null);
    }
  }

  function alternarSeccion(key: string, mostrar: boolean) {
    const nuevas = mostrar ? ocultas.filter((k) => k !== key) : [...ocultas, key];
    setOcultas(nuevas);
    guardar({ secciones_ocultas: nuevas }, key);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Configuración</h1>
      <p className="text-sm text-gray-500 mb-4">Datos del negocio — el logo se cambia desde el ícono arriba a la izquierda.</p>

      {mensaje && <p className="text-red-600 text-sm mb-3">{mensaje}</p>}

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
        <h2 className="font-semibold mb-3">Negocio</h2>
        <label className="block text-sm font-medium mb-1">Nombre del negocio</label>
        <div className="flex gap-2 mb-3">
          <input className="flex-1 rounded-lg border border-gray-300 px-3 py-2" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <button
            onClick={() => nombre.trim() && guardar({ nombre_negocio: nombre }, "nombre")}
            disabled={guardando === "nombre"}
            className="rounded-lg bg-kaxa-600 text-white font-medium px-4 disabled:opacity-60"
          >
            {guardando === "nombre" ? "…" : "Guardar"}
          </button>
        </div>

        <label className="block text-sm font-medium mb-1">Tasa del día (Bs/$)</label>
        <p className="text-xs text-gray-400 mb-2">
          Cambia la tasa para todo el negocio — si el programa de escritorio está corriendo en la tienda, este mismo
          cambio se refleja automáticamente en la app de delivery.
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
            value={tasa}
            onChange={(e) => setTasa(e.target.value)}
          />
          <button
            onClick={() => Number(tasa) > 0 && guardar({ tasa_cambio_dia: Number(tasa) }, "tasa")}
            disabled={guardando === "tasa"}
            className="rounded-lg bg-kaxa-600 text-white font-medium px-4 disabled:opacity-60"
          >
            {guardando === "tasa" ? "…" : "Guardar"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
        <h2 className="font-semibold mb-1">Personalización</h2>
        <p className="text-xs text-gray-400 mb-3">Ocultá lo que tu negocio no usa, en el programa de escritorio y acá.</p>
        <div className="flex flex-col gap-3">
          {seccionesPersonalizables.map((s) => (
            <label key={s.key} className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={!ocultas.includes(s.key)}
                onChange={(e) => alternarSeccion(s.key, e.target.checked)}
                disabled={guardando === s.key}
              />
              <span>
                <span className="block text-sm font-medium">{s.label}</span>
                <span className="block text-xs text-gray-400">{s.descripcion}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
