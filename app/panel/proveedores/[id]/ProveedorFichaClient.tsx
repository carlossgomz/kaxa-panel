"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Proveedor = { id: string; nombre: string; rif: string; direccion: string | null; telefono: string | null };
type Factura = {
  id: string;
  numero_factura: string;
  fecha: string;
  monto_total_usd: number;
  monto_pagado_usd: number;
  tasa_cambio_dia: number;
  estado: string;
};

export default function ProveedorFichaClient({
  proveedor,
  saldoPendienteUsd,
  historial,
}: {
  proveedor: Proveedor;
  saldoPendienteUsd: number;
  historial: Factura[];
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(proveedor.nombre);
  const [rif, setRif] = useState(proveedor.rif);
  const [direccion, setDireccion] = useState(proveedor.direccion ?? "");
  const [telefono, setTelefono] = useState(proveedor.telefono ?? "");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function guardar() {
    setMensaje(null);
    if (!nombre.trim() || !rif.trim()) {
      setMensaje("El nombre y el RIF son obligatorios.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/proveedores/${proveedor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, rif, direccion, telefono }),
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
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!window.confirm(`¿Eliminar a "${proveedor.nombre}" del todo? No se puede deshacer.`)) return;
    setMensaje(null);
    const res = await fetch(`/api/proveedores/${proveedor.id}`, { method: "DELETE" });
    const datos = await res.json();
    if (!res.ok) {
      setMensaje(datos.error ?? "No se pudo eliminar.");
      return;
    }
    router.push("/panel/proveedores");
    router.refresh();
  }

  return (
    <div>
      <Link href="/panel/proveedores" className="text-sm text-kaxa-600 mb-4 inline-block">
        ← Proveedores
      </Link>
      <h1 className="text-xl font-semibold mb-1">{proveedor.nombre}</h1>
      <p className="text-sm text-gray-500 mb-4">{proveedor.rif}</p>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-5 mb-4">
        <p className="text-sm text-gray-500">Saldo pendiente</p>
        <p className={`text-2xl font-semibold mt-1 ${saldoPendienteUsd > 0 ? "text-amber-600" : ""}`}>USD {saldoPendienteUsd.toFixed(2)}</p>
      </div>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
        <h2 className="font-semibold mb-3">Datos</h2>
        <label className="block text-sm font-medium mb-1">Nombre</label>
        <input className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <label className="block text-sm font-medium mb-1">RIF</label>
        <input className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2" value={rif} onChange={(e) => setRif(e.target.value)} />
        <label className="block text-sm font-medium mb-1">Dirección</label>
        <input className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        <label className="block text-sm font-medium mb-1">Teléfono</label>
        <input className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        {mensaje && <p className="text-red-600 text-sm mb-3">{mensaje}</p>}
        <div className="flex gap-2">
          <button onClick={guardar} disabled={guardando} className="flex-1 rounded-lg bg-kaxa-600 text-white font-medium py-2.5 disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
          <button onClick={eliminar} className="text-red-500 text-sm px-3">
            eliminar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
        <h2 className="font-semibold mb-2">Historial de facturas</h2>
        {historial.length === 0 && <p className="text-sm text-gray-400 py-2">Sin facturas registradas todavía.</p>}
        <div className="flex flex-col gap-2">
          {historial.map((f) => (
            <div key={f.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
              <div>
                <p className="font-medium">{f.numero_factura}</p>
                <p className="text-xs text-gray-400">{new Date(f.fecha.replace(" ", "T")).toLocaleDateString("es-VE")}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">
                  USD {f.monto_total_usd.toFixed(2)} <span className="text-xs text-gray-400">(pagado {f.monto_pagado_usd.toFixed(2)})</span>
                </p>
                <p className="text-xs text-gray-400">{f.estado}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
