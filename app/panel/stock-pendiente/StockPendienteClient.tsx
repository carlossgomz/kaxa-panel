"use client";

import { useState } from "react";

type Item = {
  id: string;
  numero_ticket: string;
  fecha_hora: string;
  vendedor_nombre: string | null;
  producto_nombre: string;
  cantidad_vendida: string;
  stock_disponible: string;
  nota_cajero: string | null;
};

export default function StockPendienteClient({ itemsIniciales }: { itemsIniciales: Item[] }) {
  const [items, setItems] = useState(itemsIniciales);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function resolver(item: Item) {
    if (!window.confirm(`¿Ya corregiste el inventario real de "${item.producto_nombre}"? Esto cierra el caso y deja de avisar.`)) {
      return;
    }
    setMensaje(null);
    setGuardando(item.id);
    try {
      const res = await fetch(`/api/stock-pendiente/${item.id}`, { method: "PATCH" });
      if (!res.ok) {
        const datos = await res.json();
        setMensaje(datos.error ?? "No se pudo cerrar el caso.");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      setMensaje("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Stock por revisar</h1>
      <p className="text-sm text-gray-500 mb-4">
        Se cobraron con más cantidad de un producto de la que había en stock. Corrige el inventario real (a mano, o
        desde Movimientos) y después marcá cada una como resuelta.
      </p>

      {mensaje && <p className="text-red-600 text-sm mb-3">{mensaje}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No queda ninguna por revisar ✅</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium">{item.producto_nombre}</p>
                <p className="text-xs text-gray-400">{item.numero_ticket}</p>
              </div>
              <p className="text-xs text-gray-400 mb-2">
                {new Date(item.fecha_hora.replace(" ", "T")).toLocaleString("es-VE")}
                {item.vendedor_nombre ? ` · ${item.vendedor_nombre}` : ""}
              </p>
              <p className="text-sm mb-2">
                Vendió <strong>{item.cantidad_vendida}</strong> / había <strong>{item.stock_disponible}</strong>
              </p>
              {item.nota_cajero?.trim() ? (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2 mb-3">📝 {item.nota_cajero}</p>
              ) : (
                <p className="text-xs text-gray-400 mb-3">(sin nota del cajero)</p>
              )}
              <button
                onClick={() => resolver(item)}
                disabled={guardando === item.id}
                className="w-full rounded-lg bg-kaxa-600 text-white font-medium py-2 text-sm disabled:opacity-60"
              >
                {guardando === item.id ? "…" : "Marcar resuelto"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
