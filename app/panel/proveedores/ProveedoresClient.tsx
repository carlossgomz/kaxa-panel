"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { normalizarTexto } from "@/lib/busqueda";

type Proveedor = { id: string; nombre: string; rif: string; direccion: string | null; telefono: string | null };

export default function ProveedoresClient({ proveedoresIniciales }: { proveedoresIniciales: Proveedor[] }) {
  const [proveedores] = useState(proveedoresIniciales);
  const [busqueda, setBusqueda] = useState("");

  const [nombre, setNombre] = useState("");
  const [rif, setRif] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [lista, setLista] = useState(proveedoresIniciales);

  useEffect(() => {
    const term = normalizarTexto(busqueda.trim());
    if (!term) {
      setLista(proveedores);
      return;
    }
    setLista(proveedores.filter((p) => normalizarTexto(p.nombre).includes(term) || p.rif.toLowerCase().includes(busqueda.trim().toLowerCase())));
  }, [busqueda, proveedores]);

  async function guardarProveedor(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    if (!nombre.trim() || !rif.trim()) {
      setMensaje("Nombre y RIF son obligatorios.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/proveedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, rif, direccion, telefono }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setMensaje(datos.error ?? "No se pudo crear el proveedor.");
        return;
      }
      window.location.reload();
    } catch {
      setMensaje("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Proveedores</h1>
      <p className="text-sm text-gray-500 mb-4">Todos tus proveedores, tengan o no facturas pendientes.</p>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
        <h2 className="font-semibold mb-2">Nuevo proveedor</h2>
        <form onSubmit={guardarProveedor} className="flex flex-col gap-2">
          <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="RIF" value={rif} onChange={(e) => setRif(e.target.value)} />
          <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Dirección (opcional)" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          {mensaje && <p className="text-red-600 text-sm">{mensaje}</p>}
          <button disabled={guardando} className="rounded-lg bg-kaxa-600 text-white font-medium py-2.5 disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </form>
      </div>

      <input
        className="w-full rounded-lg border border-gray-300 px-3 py-2 mb-3"
        placeholder="Buscar por nombre o RIF"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="flex flex-col gap-2">
        {lista.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Sin proveedores todavía.</p>}
        {lista.map((p) => (
          <Link
            key={p.id}
            href={`/panel/proveedores/${p.id}`}
            className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 flex items-center justify-between transition-transform active:scale-[0.98]"
          >
            <div>
              <p className="font-medium">{p.nombre}</p>
              <p className="text-xs text-gray-400">{p.rif}</p>
            </div>
            <span className="text-kaxa-400 text-sm">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
