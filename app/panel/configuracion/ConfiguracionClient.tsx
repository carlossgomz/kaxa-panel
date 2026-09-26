"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { comprimirImagen } from "@/lib/imagen";

type Seccion = { key: string; label: string; descripcion: string };

export default function ConfiguracionClient({
  nombreNegocio,
  tasaHoy,
  seccionesOcultas,
  seccionesPersonalizables,
  logo,
  rifNegocio,
  direccionNegocio,
  telefonoNegocio,
  plan,
}: {
  nombreNegocio: string;
  tasaHoy: number;
  seccionesOcultas: string[];
  seccionesPersonalizables: Seccion[];
  logo: string | null;
  rifNegocio: string;
  direccionNegocio: string;
  telefonoNegocio: string;
  plan: string;
}) {
  const router = useRouter();
  const inputLogoRef = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState(nombreNegocio);
  const [tasa, setTasa] = useState(String(tasaHoy));
  const [rif, setRif] = useState(rifNegocio);
  const [direccion, setDireccion] = useState(direccionNegocio);
  const [telefono, setTelefono] = useState(telefonoNegocio);
  const [ocultas, setOcultas] = useState(seccionesOcultas);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
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

  async function subirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMensaje(null);
    setSubiendoLogo(true);
    try {
      const dataUrl = await comprimirImagen(file);
      const res = await fetch("/api/negocio/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_base64: dataUrl }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const datos = await res.json();
        setMensaje(datos.error ?? "No se pudo cambiar el logo.");
      }
    } catch {
      setMensaje("No se pudo procesar esa imagen.");
    } finally {
      setSubiendoLogo(false);
    }
  }

  async function quitarLogo() {
    setMensaje(null);
    setSubiendoLogo(true);
    try {
      const res = await fetch("/api/negocio/logo", { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const datos = await res.json();
        setMensaje(datos.error ?? "No se pudo quitar el logo.");
      }
    } catch {
      setMensaje("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
    } finally {
      setSubiendoLogo(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Configuración</h1>
      <p className="text-sm text-gray-500 mb-4">Datos del negocio y personalización de Kaxa Móvil.</p>

      {mensaje && <p className="text-red-600 text-sm mb-3">{mensaje}</p>}

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
        <h2 className="font-semibold mb-3">Negocio</h2>

        <label className="block text-sm font-medium mb-1">Foto de perfil / logo</label>
        <div className="flex items-center gap-3 mb-4">
          {logo ? (
            <img src={logo} alt="Logo del negocio" className="w-14 h-14 rounded-lg object-contain bg-white border border-kaxa-100 p-0.5" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-kaxa-400 to-kaxa-900 flex items-center justify-center text-white font-bold">
              K
            </div>
          )}
          <div className="flex gap-3 text-sm">
            <button
              type="button"
              onClick={() => inputLogoRef.current?.click()}
              disabled={subiendoLogo}
              className="font-medium text-kaxa-700 disabled:opacity-60"
            >
              {subiendoLogo ? "…" : "Cambiar foto"}
            </button>
            {logo && (
              <button type="button" onClick={quitarLogo} disabled={subiendoLogo} className="text-gray-400 disabled:opacity-60">
                quitar
              </button>
            )}
          </div>
          <input ref={inputLogoRef} type="file" accept="image/*" onChange={subirLogo} className="hidden" />
        </div>

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

        <label className="block text-sm font-medium mb-1">RIF</label>
        <div className="flex gap-2 mb-3">
          <input
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
            value={rif}
            onChange={(e) => setRif(e.target.value)}
            placeholder="J-12345678-9"
          />
          <button
            onClick={() => guardar({ rif_negocio: rif }, "rif")}
            disabled={guardando === "rif"}
            className="rounded-lg bg-kaxa-600 text-white font-medium px-4 disabled:opacity-60"
          >
            {guardando === "rif" ? "…" : "Guardar"}
          </button>
        </div>

        <label className="block text-sm font-medium mb-1">Dirección</label>
        <div className="flex gap-2 mb-3">
          <input
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
          <button
            onClick={() => guardar({ direccion_negocio: direccion }, "direccion")}
            disabled={guardando === "direccion"}
            className="rounded-lg bg-kaxa-600 text-white font-medium px-4 disabled:opacity-60"
          >
            {guardando === "direccion" ? "…" : "Guardar"}
          </button>
        </div>

        <label className="block text-sm font-medium mb-1">Teléfono</label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
          <button
            onClick={() => guardar({ telefono_negocio: telefono }, "telefono")}
            disabled={guardando === "telefono"}
            className="rounded-lg bg-kaxa-600 text-white font-medium px-4 disabled:opacity-60"
          >
            {guardando === "telefono" ? "…" : "Guardar"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
        <h2 className="font-semibold mb-1">Tasa del día</h2>
        <label className="block text-sm font-medium mb-1 mt-2">Tasa del día (Bs/$)</label>
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

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
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

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
        <h2 className="font-semibold mb-2">Acerca de</h2>
        <p className="text-sm">
          Kaxa Móvil
          <br />
          Plan: {plan.charAt(0).toUpperCase() + plan.slice(1)}
        </p>
      </div>
    </div>
  );
}
