"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EPS, METODOS_PAGO, monedaDeMetodo } from "@/lib/dinero";

type ProductoResultado = { id: string; codigo_barra: string; nombre: string; stock_actual: number; precio_unit_bs: number };
type LineaCarrito = { producto_id: string; codigo_barra: string; nombre: string; cantidad: number; precio_unit_bs: number; stock_actual: number };
type ClienteResultado = { id: string; nombre: string; cedula: string; direccion: string | null; credito_autorizado: boolean };
type LineaPago = { metodo: string; monto_bs: number; referencia?: string };
type Repartidor = { id: string; nombre: string };

function generarId() {
  return crypto.randomUUID();
}

// Producto placeholder "DELIVERY" que ya existe en la base de Day Express
// (mismo id que PRODUCTO_DELIVERY_ID en pos-minimarket/src/screens/Venta.tsx)
// — solo se usa cuando el negocio tiene recargoDeliveryUsd > 0, que hoy es
// únicamente Day Express (configurado en la tabla negocios del directorio,
// no acá), así que este id nunca se manda para otro cliente.
const PRODUCTO_DELIVERY_ID = "f195fbac-103d-48fa-a27a-28371fba7745";

export default function VentaClient({
  tasaHoy,
  repartidores,
  mostrarDelivery,
  recargoDeliveryUsd,
}: {
  tasaHoy: number;
  repartidores: Repartidor[];
  mostrarDelivery: boolean;
  recargoDeliveryUsd: number;
}) {
  const router = useRouter();

  // --- Delivery (genérico, igual que Venta.tsx de pos-avanzado — sin
  // ningún recargo automático, eso es una personalización propia de Day
  // Express que NO va acá, esto se vende tal cual a clientes de Avanzado).
  // El recargo en sí (recargoDeliveryUsd) viene del directorio, configurado
  // por negocio — en 0 para todos menos Day Express.
  const [esDelivery, setEsDelivery] = useState(false);
  const [repartidorId, setRepartidorId] = useState<string | null>(null);

  // --- Búsqueda y carrito ---
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<ProductoResultado[]>([]);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = busqueda.trim();
    if (term.length < 2) {
      setResultados([]);
      setMostrarDropdown(false);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/buscar-productos?q=${encodeURIComponent(term)}`);
      const datos = await res.json();
      setResultados(datos.productos ?? []);
      setMostrarDropdown(true);
    }, 200);
    return () => clearTimeout(t);
  }, [busqueda]);

  function agregarAlCarrito(p: ProductoResultado) {
    setCarrito((prev) => {
      const existente = prev.find((l) => l.producto_id === p.id);
      if (existente) {
        return prev.map((l) => (l.producto_id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l));
      }
      return [
        ...prev,
        { producto_id: p.id, codigo_barra: p.codigo_barra, nombre: p.nombre, cantidad: 1, precio_unit_bs: p.precio_unit_bs, stock_actual: p.stock_actual },
      ];
    });
    setBusqueda("");
    setResultados([]);
    setMostrarDropdown(false);
    inputBusquedaRef.current?.focus();
  }

  function cambiarCantidad(producto_id: string, cantidad: number) {
    setCarrito((prev) => prev.map((l) => (l.producto_id === producto_id ? { ...l, cantidad: Math.max(0, cantidad) } : l)));
  }

  function quitarLinea(producto_id: string) {
    setCarrito((prev) => prev.filter((l) => l.producto_id !== producto_id));
  }

  // --- Cliente (opcional — solo hace falta para dejar algo a crédito) ---
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteBusqueda, setClienteBusqueda] = useState("");
  const [clienteResultados, setClienteResultados] = useState<ClienteResultado[]>([]);
  const [cliente, setCliente] = useState<ClienteResultado | null>(null);

  useEffect(() => {
    const term = clienteBusqueda.trim();
    if (term.length < 2) {
      setClienteResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/buscar-clientes?q=${encodeURIComponent(term)}`);
      const datos = await res.json();
      setClienteResultados(datos.clientes ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [clienteBusqueda]);

  function seleccionarCliente(c: ClienteResultado) {
    setCliente(c);
    setBuscandoCliente(false);
    setClienteBusqueda("");
    setClienteResultados([]);
  }

  // --- Pagos ---
  const [pagos, setPagos] = useState<LineaPago[]>([]);
  const [montoNuevo, setMontoNuevo] = useState("");
  const [metodoNuevo, setMetodoNuevo] = useState<string>("EFECTIVO");
  const [refNueva, setRefNueva] = useState("");
  const [mostrarDividir, setMostrarDividir] = useState(false);

  const subtotalCarrito = carrito.reduce((acc, l) => acc + l.cantidad * l.precio_unit_bs, 0);
  // Mismo criterio que recargoDeliveryBs en Venta.tsx del escritorio: por
  // producto entregado (sumando las cantidades del carrito), no por línea.
  const totalUnidadesCarrito = carrito.reduce((acc, l) => acc + l.cantidad, 0);
  const recargoDeliveryBs = esDelivery && recargoDeliveryUsd > 0 ? totalUnidadesCarrito * recargoDeliveryUsd * tasaHoy : 0;
  const subtotal = subtotalCarrito + recargoDeliveryBs;
  const total = subtotal;
  const totalPagado = pagos.reduce((acc, p) => acc + p.monto_bs, 0);
  const restante = Number((total - totalPagado).toFixed(2));

  function agregarPago() {
    const montoEscrito = Number(montoNuevo);
    if (!montoEscrito || montoEscrito <= 0) return;
    const monto_bs = monedaDeMetodo(metodoNuevo) === "USD" ? montoEscrito * tasaHoy : montoEscrito;
    setPagos((prev) => [...prev, { metodo: metodoNuevo, monto_bs, referencia: refNueva || undefined }]);
    setMontoNuevo("");
    setRefNueva("");
  }

  function quitarPago(idx: number) {
    setPagos((prev) => prev.filter((_, i) => i !== idx));
  }

  function cobrarCompletoCon(metodo: string) {
    if (restante <= 0.009) return;
    setPagos((prev) => [...prev, { metodo, monto_bs: restante }]);
  }

  // --- Confirmar venta ---
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ticketConfirmado, setTicketConfirmado] = useState<string | null>(null);
  const idVentaRef = useRef<string | null>(null);

  function nuevaVenta() {
    setCarrito([]);
    setPagos([]);
    setCliente(null);
    setEsDelivery(false);
    setRepartidorId(null);
    setMensaje(null);
    setTicketConfirmado(null);
    idVentaRef.current = null;
    router.refresh();
  }

  async function confirmarVenta() {
    if (guardando) return;
    setMensaje(null);

    if (carrito.length === 0) {
      setMensaje("Agrega al menos un producto antes de cobrar.");
      return;
    }
    if (restante < -0.01) {
      setMensaje(`Los pagos superan el total por Bs ${Math.abs(restante).toFixed(2)}. Ajusta los montos.`);
      return;
    }

    const esCredito = restante > EPS;
    if (esCredito) {
      if (!cliente) {
        setMensaje(`Falta cubrir Bs ${restante.toFixed(2)}. Para dejarlo a crédito, primero busca y selecciona al cliente.`);
        return;
      }
      if (!cliente.credito_autorizado) {
        const autorizar = confirm(`${cliente.nombre} no tiene crédito autorizado. ¿Autorizarlo ahora y continuar con esta venta a crédito?`);
        if (!autorizar) {
          setMensaje(`Venta no confirmada — ${cliente.nombre} no tiene crédito autorizado.`);
          return;
        }
      }
    }

    const pagosReales = [...pagos];
    if (esCredito) pagosReales.push({ metodo: "CREDITO", monto_bs: restante });

    // Línea automática del recargo de delivery — se agrega sola al
    // confirmar, igual que ejecutarVentaConfirmada() en Venta.tsx del
    // escritorio, sin que el cajero tenga que buscarla a mano.
    const items = carrito.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad, precio_unit_bs: l.precio_unit_bs }));
    if (recargoDeliveryBs > 0) {
      items.push({ producto_id: PRODUCTO_DELIVERY_ID, cantidad: totalUnidadesCarrito, precio_unit_bs: recargoDeliveryUsd * tasaHoy });
    }

    if (!idVentaRef.current) idVentaRef.current = generarId();
    setGuardando(true);
    try {
      const res = await fetch("/api/venta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: idVentaRef.current,
          fecha_hora: null,
          cliente_nombre: cliente?.nombre || null,
          cliente_cedula: cliente?.cedula || null,
          cliente_direccion: cliente?.direccion || null,
          canal: esDelivery ? "DELIVERY" : "TIENDA",
          repartidor_id: esDelivery ? repartidorId : null,
          tasa_cambio_dia: tasaHoy,
          subtotal_bs: subtotal,
          total_bs: total,
          estado: esCredito ? "CREDITO_PENDIENTE" : "COMPLETADA",
          monto_pendiente_usd: esCredito ? restante / tasaHoy : null,
          items,
          pagos: pagosReales,
        }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setMensaje(datos.error ?? "No se pudo registrar la venta.");
        setGuardando(false);
        return;
      }
      setTicketConfirmado(datos.numero_ticket);
    } catch {
      setMensaje("No se pudo conectar. Revisa tu internet e intenta de nuevo — podés volver a tocar \"Confirmar venta\", no se va a duplicar.");
    } finally {
      setGuardando(false);
    }
  }

  if (ticketConfirmado) {
    return (
      <div className="flex flex-col items-center text-center py-10">
        <div className="w-16 h-16 rounded-full bg-kaxa-50 flex items-center justify-center text-3xl mb-4">✅</div>
        <h1 className="text-xl font-semibold mb-1">Venta registrada</h1>
        <p className="text-sm text-gray-500 mb-6">Ticket {ticketConfirmado}</p>
        <button
          onClick={nuevaVenta}
          className="rounded-lg bg-kaxa-600 text-white font-medium py-2.5 px-6 transition-transform active:scale-[0.98]"
        >
          Nueva venta
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Venta</h1>
      <p className="text-sm text-gray-500 mb-4">Tasa del día: {tasaHoy.toFixed(2)} Bs/$</p>

      {/* Buscador de producto */}
      <div className="relative mb-4">
        <input
          ref={inputBusquedaRef}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onFocus={() => resultados.length > 0 && setMostrarDropdown(true)}
          onBlur={() => setTimeout(() => setMostrarDropdown(false), 150)}
          placeholder="Buscar producto por nombre o código"
          className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
        />
        {mostrarDropdown && resultados.length > 0 && (
          <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-kaxa-100 rounded-xl shadow-lg overflow-hidden">
            {resultados.map((p) => (
              <li key={p.id}>
                <button
                  onMouseDown={() => agregarAlCarrito(p)}
                  className="w-full text-left px-3 py-2.5 flex items-center justify-between active:bg-kaxa-50 border-b border-kaxa-50 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.nombre}</p>
                    <p className="text-xs text-gray-400">stock {p.stock_actual}</p>
                  </div>
                  <p className="text-sm font-semibold text-kaxa-700 shrink-0 ml-2">Bs {p.precio_unit_bs.toFixed(2)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Carrito */}
      <div className="flex flex-col gap-2 mb-4">
        {carrito.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Buscá un producto para empezar.</p>}
        {carrito.map((l) => (
          <div key={l.producto_id} className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium truncate pr-2">{l.nombre}</p>
              <button onClick={() => quitarLinea(l.producto_id)} className="text-red-500 text-xs shrink-0">
                quitar
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => cambiarCantidad(l.producto_id, l.cantidad - 1)}
                  className="w-8 h-8 rounded-lg bg-kaxa-50 text-kaxa-700 font-semibold active:bg-kaxa-100"
                >
                  −
                </button>
                <input
                  type="number"
                  step="0.001"
                  value={l.cantidad}
                  onChange={(e) => cambiarCantidad(l.producto_id, Number(e.target.value) || 0)}
                  className="w-14 text-center rounded-lg border border-gray-300 py-1 text-sm"
                />
                <button
                  onClick={() => cambiarCantidad(l.producto_id, l.cantidad + 1)}
                  className="w-8 h-8 rounded-lg bg-kaxa-50 text-kaxa-700 font-semibold active:bg-kaxa-100"
                >
                  +
                </button>
              </div>
              <p className="text-sm font-semibold">Bs {(l.cantidad * l.precio_unit_bs).toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Cliente */}
      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
        {cliente ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{cliente.nombre}</p>
              <p className="text-xs text-gray-400">
                {cliente.cedula} {cliente.credito_autorizado ? "· crédito ✓" : ""}
              </p>
            </div>
            <button onClick={() => setCliente(null)} className="text-xs text-red-500">
              quitar
            </button>
          </div>
        ) : buscandoCliente ? (
          <div className="relative">
            <input
              autoFocus
              value={clienteBusqueda}
              onChange={(e) => setClienteBusqueda(e.target.value)}
              placeholder="Cédula o nombre del cliente"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            {clienteResultados.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {clienteResultados.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => seleccionarCliente(c)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-kaxa-50 active:bg-kaxa-100 text-sm"
                    >
                      {c.nombre} — {c.cedula} {c.credito_autorizado ? "(crédito ✓)" : ""}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => setBuscandoCliente(false)} className="text-xs text-gray-400 mt-2">
              cancelar
            </button>
          </div>
        ) : (
          <button onClick={() => setBuscandoCliente(true)} className="text-sm text-kaxa-600 flex items-center gap-1">
            👤 Consumidor final <span className="text-gray-400 font-normal">· tocar para buscar cliente</span>
          </button>
        )}
      </div>

      {/* Delivery (si el negocio no la desactivó desde Configuración) */}
      {mostrarDelivery && (
        <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={esDelivery}
              onChange={(e) => {
                setEsDelivery(e.target.checked);
                if (!e.target.checked) setRepartidorId(null);
              }}
            />
            🛵 Es delivery
          </label>
          {esDelivery && (
            <select
              value={repartidorId ?? ""}
              onChange={(e) => setRepartidorId(e.target.value || null)}
              className="w-full mt-3 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Repartidor (opcional, se puede asignar después)…</option>
              {repartidores.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Pagos */}
      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
        {recargoDeliveryBs > 0 && (
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2 pb-2 border-b border-kaxa-50">
            <span>
              Recargo de delivery ({totalUnidadesCarrito} × ${recargoDeliveryUsd.toFixed(2)})
            </span>
            <span className="font-medium">Bs {recargoDeliveryBs.toFixed(2)}</span>
          </div>
        )}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-xl font-semibold">Bs {total.toFixed(2)}</p>
        </div>

        {pagos.map((p, i) => (
          <div key={i} className="flex items-center justify-between text-sm py-1.5 border-t border-kaxa-50">
            <span>{p.metodo.split("_").join(" ")}</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">Bs {p.monto_bs.toFixed(2)}</span>
              <button onClick={() => quitarPago(i)} className="text-red-500 text-xs">
                quitar
              </button>
            </div>
          </div>
        ))}

        {restante > 0.009 && (
          <>
            <p className="text-xs text-gray-400 mt-2 mb-2">Cobrar completo con:</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {METODOS_PAGO.map((m) => (
                <button
                  key={m}
                  onClick={() => cobrarCompletoCon(m)}
                  className="rounded-full bg-kaxa-50 text-kaxa-700 text-xs font-medium px-3 py-1.5 active:bg-kaxa-100"
                >
                  {m.split("_").join(" ")}
                </button>
              ))}
            </div>
          </>
        )}

        <button onClick={() => setMostrarDividir((v) => !v)} className="text-xs text-kaxa-600 mt-1">
          {mostrarDividir ? "ocultar pago manual" : "+ dividir / agregar pago manual"}
        </button>

        {mostrarDividir && (
          <div className="mt-3 pt-3 border-t border-kaxa-100 flex flex-col gap-2">
            <select value={metodoNuevo} onChange={(e) => setMetodoNuevo(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {METODOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m.split("_").join(" ")}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={montoNuevo}
              onChange={(e) => setMontoNuevo(e.target.value)}
              placeholder={monedaDeMetodo(metodoNuevo) === "USD" ? "Monto en $" : "Monto en Bs"}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={refNueva}
              onChange={(e) => setRefNueva(e.target.value)}
              placeholder="Referencia (opcional)"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button onClick={agregarPago} className="rounded-lg bg-kaxa-50 text-kaxa-700 font-medium py-2 text-sm active:bg-kaxa-100">
              Agregar pago
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-kaxa-100">
          <p className="text-sm text-gray-500">{restante > 0.009 ? "Falta" : restante < -0.009 ? "Sobra" : "Pagado"}</p>
          <p className={`text-sm font-semibold ${restante > 0.009 ? "text-red-600" : "text-green-600"}`}>Bs {Math.abs(restante).toFixed(2)}</p>
        </div>
      </div>

      {mensaje && <p className="text-red-600 text-sm mb-3">{mensaje}</p>}

      <button
        onClick={confirmarVenta}
        disabled={guardando || carrito.length === 0}
        className="w-full rounded-lg bg-kaxa-600 text-white font-semibold py-3.5 text-base transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {guardando ? "Guardando…" : "✓ Confirmar venta"}
      </button>
    </div>
  );
}
