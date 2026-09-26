"use client";

import { useEffect, useState } from "react";

type ProductoResultado = {
  id: string;
  codigo_barra: string;
  nombre: string;
  costo_actual_usd: number;
  margen_porcentaje: number | null;
  stock_actual: number;
  unidades_por_paquete: number;
};

type Movimiento = {
  id: string;
  producto_id: string;
  producto_nombre: string;
  tipo: string;
  cantidad: number;
  motivo: string | null;
  created_at: string;
};

export default function MovimientosClient({ movimientosIniciales }: { movimientosIniciales: Movimiento[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<ProductoResultado[]>([]);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoResultado | null>(null);

  const [tipo, setTipo] = useState<"ENTRADA" | "SALIDA">("ENTRADA");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [movimientos, setMovimientos] = useState(movimientosIniciales);
  const [totales, setTotales] = useState<{ entradas: number; salidas: number } | null>(null);

  useEffect(() => {
    const term = busqueda.trim();
    if (term.length < 2) {
      setResultados([]);
      setMostrarDropdown(false);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/buscar-productos-compra?q=${encodeURIComponent(term)}`);
      const datos = await res.json();
      setResultados(datos.productos ?? []);
      setMostrarDropdown(true);
    }, 200);
    return () => clearTimeout(t);
  }, [busqueda]);

  async function cargarMovimientos(productoId?: string) {
    const url = productoId ? `/api/movimientos?producto_id=${productoId}` : "/api/movimientos";
    const res = await fetch(url);
    const datos = await res.json();
    setMovimientos(datos.movimientos ?? []);
    setTotales(datos.totales ?? null);
  }

  function seleccionarProducto(p: ProductoResultado) {
    setProductoSeleccionado(p);
    setBusqueda("");
    setResultados([]);
    setMostrarDropdown(false);
    setCantidad("");
    setMotivo("");
    setMensaje(null);
    cargarMovimientos(p.id);
  }

  function verTodos() {
    setProductoSeleccionado(null);
    cargarMovimientos();
  }

  async function registrar() {
    if (!productoSeleccionado) return;
    setMensaje(null);
    const cant = Number(cantidad);
    if (!cant || cant <= 0) {
      setMensaje("La cantidad debe ser mayor a 0.");
      return;
    }
    if (!motivo.trim()) {
      setMensaje("Indica un motivo para el movimiento.");
      return;
    }
    if (!window.confirm(`¿Registrar ${tipo === "ENTRADA" ? "una entrada" : "una salida"} de ${cant} de "${productoSeleccionado.nombre}"?`)) {
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ producto_id: productoSeleccionado.id, tipo, cantidad: cant, motivo }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setMensaje(datos.error ?? "No se pudo registrar el movimiento.");
        return;
      }
      setProductoSeleccionado((prev) =>
        prev ? { ...prev, stock_actual: prev.stock_actual + (tipo === "ENTRADA" ? cant : -cant) } : prev
      );
      await cargarMovimientos(productoSeleccionado.id);
      setCantidad("");
      setMotivo("");
    } catch {
      setMensaje("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const motivosComunes = ["Merma", "Producto vencido", "Producto dañado", "Donación / obsequio", "Corrección de conteo físico", "Devolución de cliente", "Uso interno"];

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Movimientos</h1>
      <p className="text-sm text-gray-500 mb-4">Ajustes manuales de stock — mermas, donaciones, conteos físicos.</p>

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
        <label className="block text-sm font-medium mb-1">Producto</label>
        <div className="relative">
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="Buscar por nombre o código"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onFocus={() => resultados.length > 0 && setMostrarDropdown(true)}
            onBlur={() => setTimeout(() => setMostrarDropdown(false), 150)}
          />
          {mostrarDropdown && resultados.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button type="button" className="w-full text-left px-3 py-2 text-sm active:bg-kaxa-50" onMouseDown={() => seleccionarProducto(p)}>
                    <span className="font-medium">{p.nombre}</span>
                    <span className="block text-xs text-gray-400">stock {p.stock_actual}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {productoSeleccionado && (
          <button type="button" className="text-sm text-kaxa-600 font-medium mt-2" onClick={verTodos}>
            ver movimientos de todos los productos
          </button>
        )}
      </div>

      {productoSeleccionado && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
              <p className="text-xs text-gray-500">{productoSeleccionado.nombre}</p>
              <p className="text-lg font-semibold mt-1">Stock: {productoSeleccionado.stock_actual}</p>
            </div>
            <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
              <p className="text-xs text-gray-500">Entradas / salidas totales</p>
              <p className="text-lg font-semibold mt-1">
                +{totales?.entradas ?? 0} / -{totales?.salidas ?? 0}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
            <h2 className="font-semibold mb-3">Registrar entrada / salida</h2>
            <select className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2" value={tipo} onChange={(e) => setTipo(e.target.value as "ENTRADA" | "SALIDA")}>
              <option value="ENTRADA">Entrada</option>
              <option value="SALIDA">Salida</option>
            </select>
            <input
              type="number"
              inputMode="decimal"
              className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Cantidad"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
            <input
              className="w-full mb-2 rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Motivo (merma, donación, conteo físico...)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              list="motivos-movimiento"
            />
            <datalist id="motivos-movimiento">
              {motivosComunes.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {mensaje && <p className="text-red-600 text-sm mb-3">{mensaje}</p>}
            <button onClick={registrar} disabled={guardando} className="w-full rounded-lg bg-kaxa-600 text-white font-medium py-2.5 disabled:opacity-60">
              {guardando ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </>
      )}

      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
        <h2 className="font-semibold mb-2">{productoSeleccionado ? `Historial — ${productoSeleccionado.nombre}` : "Movimientos recientes"}</h2>
        {movimientos.length === 0 && <p className="text-sm text-gray-400 py-2">Sin movimientos todavía.</p>}
        <div className="flex flex-col gap-2">
          {movimientos.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
              <div>
                <p className="font-medium">{m.producto_nombre}</p>
                <p className="text-xs text-gray-400">
                  {new Date(m.created_at.replace(" ", "T")).toLocaleString("es-VE")} · {m.motivo ?? "—"}
                </p>
              </div>
              <p className={`font-semibold ${m.tipo === "SALIDA" ? "text-red-500" : "text-green-600"}`}>
                {m.tipo === "SALIDA" ? "-" : "+"}
                {m.cantidad}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
