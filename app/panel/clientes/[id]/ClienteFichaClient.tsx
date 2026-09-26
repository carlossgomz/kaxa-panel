"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

type Venta = { id: string; numero_ticket: string; fecha_hora: string; total_bs: number; estado: string };

export default function ClienteFichaClient({
  cliente,
  saldoPendienteUsd,
  historial,
}: {
  cliente: Cliente;
  saldoPendienteUsd: number;
  historial: Venta[];
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(cliente.nombre);
  const [cedula, setCedula] = useState(cliente.cedula);
  const [telefono, setTelefono] = useState(cliente.telefono ?? "");
  const [direccion, setDireccion] = useState(cliente.direccion ?? "");
  const [credito, setCredito] = useState(!!cliente.credito_autorizado);
  const [empleado, setEmpleado] = useState(!!cliente.es_empleado);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function guardar(cambios: Record<string, unknown>) {
    setMensaje(null);
    setGuardando(true);
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
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
      setGuardando(false);
    }
  }

  return (
    <div>
      <Link href="/panel/clientes" className="text-sm text-kaxa-600 mb-4 inline-block">
        ← Clientes
      </Link>
      <h1 className="text-xl font-semibold mb-1">
        {cliente.nombre} {cliente.cliente_app_id && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 align-middle">📱 App</span>}
      </h1>
      <p className="text-sm text-gray-500 mb-4">{cliente.cedula}</p>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-5 mb-4">
        <p className="text-sm text-gray-500">Saldo pendiente</p>
        <p className={`text-2xl font-semibold mt-1 ${saldoPendienteUsd > 0 ? "text-amber-600" : ""}`}>USD {saldoPendienteUsd.toFixed(2)}</p>
      </div>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
        <h2 className="font-semibold mb-3">Datos</h2>
        <label className="block text-sm font-medium mb-1">Nombre</label>
        <input
          className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={() => nombre.trim() && nombre !== cliente.nombre && guardar({ nombre })}
        />
        <label className="block text-sm font-medium mb-1">Cédula</label>
        <input
          className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2"
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          onBlur={() => cedula.trim() && cedula !== cliente.cedula && guardar({ cedula })}
        />
        <label className="block text-sm font-medium mb-1">Teléfono</label>
        <input
          className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2"
          placeholder="Sin teléfono registrado"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          onBlur={() => telefono !== (cliente.telefono ?? "") && guardar({ telefono })}
        />
        <label className="block text-sm font-medium mb-1">Dirección</label>
        <input
          className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2"
          placeholder="Sin dirección registrada"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          onBlur={() => direccion !== (cliente.direccion ?? "") && guardar({ direccion })}
        />
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={credito}
              onChange={(e) => {
                setCredito(e.target.checked);
                guardar({ credito_autorizado: e.target.checked ? 1 : 0 });
              }}
            />
            Crédito autorizado
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={empleado}
              onChange={(e) => {
                setEmpleado(e.target.checked);
                guardar({ es_empleado: e.target.checked ? 1 : 0 });
              }}
            />
            Es empleado (habilita &quot;Descuento de nómina&quot; al abonar)
          </label>
        </div>
        {guardando && <p className="text-xs text-gray-400 mt-2">Guardando…</p>}
        {mensaje && <p className="text-red-600 text-sm mt-2">{mensaje}</p>}
      </div>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
        <h2 className="font-semibold mb-2">Historial de compras</h2>
        {historial.length === 0 && <p className="text-sm text-gray-400 py-2">Sin compras registradas todavía.</p>}
        <div className="flex flex-col gap-2">
          {historial.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
              <div>
                <p className="font-medium">{v.numero_ticket}</p>
                <p className="text-xs text-gray-400">{new Date(v.fecha_hora.replace(" ", "T")).toLocaleDateString("es-VE")}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">Bs {v.total_bs.toFixed(2)}</p>
                <p className="text-xs text-gray-400">{v.estado}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
