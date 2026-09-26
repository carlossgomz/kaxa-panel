"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Cliente = {
  id: string;
  nombre: string;
  cedula: string;
  telefono: string | null;
  direccion: string | null;
  cliente_app_id: string | null;
  credito_autorizado: number;
  es_empleado: number;
};

export default function ClientesClient({ clientesIniciales }: { clientesIniciales: Cliente[] }) {
  const [clientes, setClientes] = useState(clientesIniciales);
  const [busqueda, setBusqueda] = useState("");

  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Búsqueda con debounce, igual que Clientes.tsx del escritorio.
  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(busqueda.trim())}`);
      const datos = await res.json();
      setClientes(datos.clientes ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [busqueda]);

  async function guardarCliente(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    if (!nombre.trim() || !cedula.trim()) {
      setMensaje("Nombre y cédula son obligatorios.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, cedula, telefono, direccion }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setMensaje(datos.error ?? "No se pudo crear el cliente.");
        return;
      }
      setClientes((prev) =>
        [...prev, { id: datos.id, nombre: datos.nombre, cedula: datos.cedula, telefono: telefono || null, direccion: direccion || null, cliente_app_id: null, credito_autorizado: 0, es_empleado: 0 }].sort((a, b) =>
          a.nombre.localeCompare(b.nombre)
        )
      );
      setNombre("");
      setCedula("");
      setTelefono("");
      setDireccion("");
    } catch {
      setMensaje("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Clientes</h1>
      <p className="text-sm text-gray-500 mb-4">Todos tus clientes, tengan o no deuda pendiente.</p>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
        <h2 className="font-semibold mb-2">Nuevo cliente</h2>
        <form onSubmit={guardarCliente} className="flex flex-col gap-2">
          <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Cédula" value={cedula} onChange={(e) => setCedula(e.target.value)} />
          <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Dirección (opcional)" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          {mensaje && <p className="text-red-600 text-sm">{mensaje}</p>}
          <button disabled={guardando} className="rounded-lg bg-kaxa-600 text-white font-medium py-2.5 disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </form>
      </div>

      <input
        className="w-full rounded-lg border border-gray-300 px-3 py-2 mb-3"
        placeholder="Buscar por nombre o cédula"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="flex flex-col gap-2">
        {clientes.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Sin clientes todavía.</p>}
        {clientes.map((c) => (
          <Link
            key={c.id}
            href={`/panel/clientes/${c.id}`}
            className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 flex items-center justify-between transition-transform active:scale-[0.98]"
          >
            <div>
              <p className="font-medium">{c.nombre}</p>
              <p className="text-xs text-gray-400">{c.cedula}</p>
            </div>
            <div className="flex gap-1">
              {c.cliente_app_id && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">📱 App</span>}
              {!!c.es_empleado && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">👤 Empleado</span>}
              {!!c.credito_autorizado && <span className="text-xs px-2 py-0.5 rounded-full bg-kaxa-50 text-kaxa-700">Crédito</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
