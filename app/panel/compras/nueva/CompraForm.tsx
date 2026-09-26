"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  costoUnitarioIngresado,
  costoUsdDeLineaCompra,
  costoVigenteDeLineaCompra,
  precioBsDesdeCostoYMargen,
  unidadesTotalesCompra,
} from "@/lib/precios";

type Proveedor = { id: string; nombre: string };

type ProductoResultado = {
  id: string;
  codigo_barra: string;
  codigo_proveedor: string | null;
  nombre: string;
  costo_actual_usd: number;
  margen_porcentaje: number | null;
  stock_actual: number;
  unidades_por_paquete: number;
};

type LineaBorrador = {
  producto_id: string;
  codigo_barra: string;
  codigoProveedor?: string;
  nombre: string;
  es_nuevo: boolean;
  categoria?: string;
  cajas: number;
  unidadSuelta: number;
  unidadesPorPaquete: number;
  precioPaqueteIngresado: number;
  margen_aplicado: number;
  aplicaIva: boolean;
  tasaIva: number;
  aplicaDescuento: boolean;
  descuentoPct: number;
  costoAnteriorUsd?: number;
  stockAnteriorUnidades?: number;
};

function calcularCostoUsdLinea(l: {
  cajas: number;
  unidadesPorPaquete: number;
  precioPaqueteIngresado: number;
  aplicaDescuento: boolean;
  descuentoPct: number;
  aplicaIva: boolean;
  tasaIva: number;
}, monedaVes: boolean, tasaFactura: number): number {
  const costoUnit = costoUnitarioIngresado(l.cajas, l.unidadesPorPaquete, l.precioPaqueteIngresado);
  return costoUsdDeLineaCompra({
    costoUnitarioIngresado: costoUnit,
    monedaVes,
    tasaFactura,
    aplicaDescuento: l.aplicaDescuento,
    descuentoPct: l.descuentoPct,
    aplicaIva: l.aplicaIva,
    tasaIva: l.tasaIva,
  });
}

export default function CompraForm({
  proveedoresIniciales,
  tasaHoy,
}: {
  proveedoresIniciales: Proveedor[];
  tasaHoy: number;
}) {
  const router = useRouter();

  // --- Proveedor ---
  const [proveedores, setProveedores] = useState(proveedoresIniciales);
  const [proveedorId, setProveedorId] = useState("");
  const [mostrarNuevoProveedor, setMostrarNuevoProveedor] = useState(false);
  const [nombreProv, setNombreProv] = useState("");
  const [rifProv, setRifProv] = useState("");
  const [guardandoProveedor, setGuardandoProveedor] = useState(false);
  const [errorProveedor, setErrorProveedor] = useState<string | null>(null);

  async function crearProveedor() {
    if (!nombreProv.trim() || !rifProv.trim()) {
      setErrorProveedor("El nombre y el RIF son obligatorios.");
      return;
    }
    setGuardandoProveedor(true);
    setErrorProveedor(null);
    try {
      const res = await fetch("/api/proveedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreProv, rif: rifProv }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setErrorProveedor(datos.error ?? "No se pudo crear el proveedor.");
        return;
      }
      setProveedores((prev) => [...prev, { id: datos.id, nombre: datos.nombre }].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setProveedorId(datos.id);
      setMostrarNuevoProveedor(false);
      setNombreProv("");
      setRifProv("");
    } catch {
      setErrorProveedor("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
    } finally {
      setGuardandoProveedor(false);
    }
  }

  // --- Cabecera de la factura ---
  const [numeroFactura, setNumeroFactura] = useState("");
  const [moneda, setMoneda] = useState<"USD" | "VES">("USD");
  const [tasaFactura, setTasaFactura] = useState(String(tasaHoy));
  const monedaVes = moneda === "VES";

  // --- Línea en construcción ---
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<ProductoResultado[]>([]);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoResultado | null>(null);
  const [creandoProductoNuevo, setCreandoProductoNuevo] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [categoriaNuevo, setCategoriaNuevo] = useState("");

  const [cajas, setCajas] = useState("0");
  const [unidadSuelta, setUnidadSuelta] = useState("0");
  const [unidadesPorPaquete, setUnidadesPorPaquete] = useState("1");
  const [precioPaquete, setPrecioPaquete] = useState("");
  const [margen, setMargen] = useState("30");
  const [aplicaIva, setAplicaIva] = useState(false);
  const [tasaIva, setTasaIva] = useState("16");
  const [aplicaDescuento, setAplicaDescuento] = useState(false);
  const [descuento, setDescuento] = useState("");

  const [lineas, setLineas] = useState<LineaBorrador[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);

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

  function seleccionarProducto(p: ProductoResultado) {
    setCreandoProductoNuevo(false);
    setProductoSeleccionado(p);
    setBusqueda(p.codigo_proveedor ?? p.codigo_barra);
    setMargen(p.margen_porcentaje != null ? String(p.margen_porcentaje) : "30");
    setUnidadesPorPaquete(String(p.unidades_por_paquete || 1));
    setResultados([]);
    setMostrarDropdown(false);
  }

  function empezarProductoNuevo() {
    setProductoSeleccionado(null);
    setResultados([]);
    setMostrarDropdown(false);
    setNombreNuevo("");
    setCategoriaNuevo("");
    setMargen("30");
    setUnidadesPorPaquete("1");
    setCreandoProductoNuevo(true);
  }

  const cajasNum = Number(cajas || "0");
  const unidadSueltaNum = Number(unidadSuelta || "0");
  const unidadesPorPaqueteNum = Number(unidadesPorPaquete || "1");
  const precioPaqueteNum = Number(precioPaquete || "0");
  const tasaIvaNum = Number(tasaIva || "0");
  const descuentoNum = Number(descuento || "0");
  const tasaFacturaNum = Number(tasaFactura || "0");

  const cantidadPreview = unidadesTotalesCompra(cajasNum, unidadesPorPaqueteNum, unidadSueltaNum);
  const costoUnitPreviewUsd =
    precioPaqueteNum > 0
      ? calcularCostoUsdLinea(
          { cajas: cajasNum, unidadesPorPaquete: unidadesPorPaqueteNum, precioPaqueteIngresado: precioPaqueteNum, aplicaDescuento, descuentoPct: descuentoNum, aplicaIva, tasaIva: tasaIvaNum },
          monedaVes,
          tasaFacturaNum
        )
      : 0;
  // Previsualización en la MISMA moneda de la factura (sin convertir a
  // USD) - igual que en Compras.tsx del escritorio, para comparar contra
  // la factura de papel del proveedor.
  const costoUnitIngresadoPreview = costoUnitarioIngresado(cajasNum, unidadesPorPaqueteNum, precioPaqueteNum);
  const costoConDescuentoPreview = aplicaDescuento ? costoUnitIngresadoPreview * (1 - descuentoNum / 100) : costoUnitIngresadoPreview;
  const costoUnitPreviewMoneda = aplicaIva ? costoConDescuentoPreview * (1 + tasaIvaNum / 100) : costoConDescuentoPreview;
  const totalLineaPreviewMoneda = cantidadPreview * costoUnitPreviewMoneda;

  function agregarLinea() {
    setMensaje(null);
    if (unidadesPorPaqueteNum <= 0) {
      setMensaje("Las unidades por caja deben ser mayor a 0.");
      return;
    }
    if (cantidadPreview <= 0) {
      setMensaje("Indica cuántas cajas o unidades sueltas compraste.");
      return;
    }
    if (!precioPaqueteNum || precioPaqueteNum <= 0) {
      setMensaje("El precio unitario debe ser mayor a 0.");
      return;
    }
    if (aplicaIva && (!tasaIvaNum || tasaIvaNum <= 0)) {
      setMensaje("Indica el % de IVA de este producto.");
      return;
    }
    if (aplicaDescuento && (!descuentoNum || descuentoNum <= 0 || descuentoNum >= 100)) {
      setMensaje("Indica el % de descuento de este producto (entre 0 y 100).");
      return;
    }

    const codigo = busqueda.trim();
    if (productoSeleccionado) {
      setLineas((prev) => [
        ...prev,
        {
          producto_id: productoSeleccionado.id,
          codigo_barra: productoSeleccionado.codigo_barra,
          codigoProveedor: codigo || undefined,
          nombre: productoSeleccionado.nombre,
          es_nuevo: false,
          cajas: cajasNum,
          unidadSuelta: unidadSueltaNum,
          unidadesPorPaquete: unidadesPorPaqueteNum,
          precioPaqueteIngresado: precioPaqueteNum,
          margen_aplicado: Number(margen || "0"),
          aplicaIva,
          tasaIva: aplicaIva ? tasaIvaNum : 0,
          aplicaDescuento,
          descuentoPct: aplicaDescuento ? descuentoNum : 0,
          costoAnteriorUsd: productoSeleccionado.costo_actual_usd,
          stockAnteriorUnidades: productoSeleccionado.stock_actual,
        },
      ]);
    } else {
      if (!nombreNuevo.trim()) {
        setMensaje("Para un producto nuevo necesitas el nombre.");
        return;
      }
      setLineas((prev) => [
        ...prev,
        {
          producto_id: crypto.randomUUID(),
          codigo_barra: `SINCOD-${crypto.randomUUID()}`,
          codigoProveedor: codigo || undefined,
          nombre: nombreNuevo.trim(),
          es_nuevo: true,
          categoria: categoriaNuevo || undefined,
          cajas: cajasNum,
          unidadSuelta: unidadSueltaNum,
          unidadesPorPaquete: unidadesPorPaqueteNum,
          precioPaqueteIngresado: precioPaqueteNum,
          margen_aplicado: Number(margen || "0"),
          aplicaIva,
          tasaIva: aplicaIva ? tasaIvaNum : 0,
          aplicaDescuento,
          descuentoPct: aplicaDescuento ? descuentoNum : 0,
        },
      ]);
    }

    setBusqueda("");
    setProductoSeleccionado(null);
    setNombreNuevo("");
    setCategoriaNuevo("");
    setCreandoProductoNuevo(false);
    setCajas("0");
    setUnidadSuelta("0");
    setUnidadesPorPaquete("1");
    setPrecioPaquete("");
    setMargen("30");
    setAplicaIva(false);
    setTasaIva("16");
    setAplicaDescuento(false);
    setDescuento("");
  }

  function quitarLinea(idx: number) {
    setLineas((prev) => prev.filter((_, i) => i !== idx));
  }

  const montoTotalUsd = lineas.reduce((acc, l) => {
    const costoUsd = calcularCostoUsdLinea(l, monedaVes, tasaFacturaNum);
    return acc + costoUsd * unidadesTotalesCompra(l.cajas, l.unidadesPorPaquete, l.unidadSuelta);
  }, 0);

  async function guardarFactura() {
    setMensaje(null);
    if (!proveedorId) {
      setMensaje("Selecciona o crea un proveedor primero.");
      return;
    }
    if (!numeroFactura.trim()) {
      setMensaje("Falta el número de factura.");
      return;
    }
    if (lineas.length === 0) {
      setMensaje("Agrega al menos un producto a la factura.");
      return;
    }
    if (!tasaFacturaNum || tasaFacturaNum <= 0) {
      setMensaje("La tasa del día de esta compra debe ser mayor a 0.");
      return;
    }

    const nombreProveedor = proveedores.find((p) => p.id === proveedorId)?.nombre ?? "el proveedor";
    if (
      !window.confirm(
        `¿Registrar la factura ${numeroFactura} de ${nombreProveedor} con ${lineas.length} producto${lineas.length === 1 ? "" : "s"} (USD ${montoTotalUsd.toFixed(2)})?`
      )
    ) {
      return;
    }

    setGuardando(true);
    try {
      const items = lineas.map((l) => {
        const costoUnitarioUsd = calcularCostoUsdLinea(l, monedaVes, tasaFacturaNum);
        const cantidadTotal = unidadesTotalesCompra(l.cajas, l.unidadesPorPaquete, l.unidadSuelta);
        const costoVigenteUsd = costoVigenteDeLineaCompra({
          costoNuevoUsd: costoUnitarioUsd,
          cantidadNueva: cantidadTotal,
          costoAnteriorUsd: l.costoAnteriorUsd ?? null,
          stockAnteriorUnidades: l.stockAnteriorUnidades ?? 0,
        });
        return {
          producto_id: l.producto_id,
          es_nuevo: l.es_nuevo,
          codigo_barra: l.codigo_barra,
          codigo_proveedor: l.codigoProveedor ?? null,
          nombre: l.nombre,
          categoria_nombre: l.categoria ?? null,
          cajas: l.cajas,
          unidad_suelta: l.unidadSuelta,
          unidades_por_paquete: l.unidadesPorPaquete,
          cantidad_total: cantidadTotal,
          costo_unitario_usd: costoUnitarioUsd,
          margen_aplicado: l.margen_aplicado,
          precio_venta_bs: precioBsDesdeCostoYMargen(costoUnitarioUsd, l.margen_aplicado, tasaFacturaNum),
          aplica_iva: l.aplicaIva,
          tasa_iva_aplicada: l.tasaIva,
          aplica_descuento: l.aplicaDescuento,
          descuento_aplicado: l.descuentoPct,
          costo_vigente_usd: costoVigenteUsd,
          margen_vigente: l.margen_aplicado,
          precio_venta_vigente_bs: precioBsDesdeCostoYMargen(costoVigenteUsd, l.margen_aplicado, tasaFacturaNum),
        };
      });

      const res = await fetch("/api/factura-compra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedor_id: proveedorId,
          numero_factura: numeroFactura.trim(),
          moneda,
          tasa_cambio_dia: tasaFacturaNum,
          items,
        }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setMensaje(datos.error ?? "No se pudo guardar la factura.");
        return;
      }
      setExito(true);
      setTimeout(() => {
        router.push("/panel/compras");
        router.refresh();
      }, 1400);
    } catch {
      setMensaje("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  if (exito) {
    return (
      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-5 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl">
          ✓
        </div>
        <h2 className="font-semibold mb-1">Factura registrada con éxito</h2>
        <p className="text-sm text-gray-500">El stock ya quedó actualizado. Volviendo a Compras…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* --- Proveedor --- */}
      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
        <label className="block text-sm font-medium mb-1">Proveedor</label>
        {!mostrarNuevoProveedor ? (
          <>
            <select
              className="w-full mb-2 rounded-lg border border-gray-300 px-3 py-2"
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
            >
              <option value="">Selecciona un proveedor…</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <button type="button" className="text-sm text-kaxa-600 font-medium" onClick={() => setMostrarNuevoProveedor(true)}>
              + Nuevo proveedor
            </button>
          </>
        ) : (
          <div className="border-t border-kaxa-100 pt-3 mt-1">
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input
              className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2"
              value={nombreProv}
              onChange={(e) => setNombreProv(e.target.value)}
            />
            <label className="block text-sm font-medium mb-1">RIF</label>
            <input className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2" value={rifProv} onChange={(e) => setRifProv(e.target.value)} />
            {errorProveedor && <p className="text-red-600 text-sm mb-3">{errorProveedor}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={crearProveedor}
                disabled={guardandoProveedor}
                className="flex-1 rounded-lg bg-kaxa-600 text-white font-medium py-2.5 disabled:opacity-60"
              >
                {guardandoProveedor ? "Guardando…" : "Crear proveedor"}
              </button>
              <button type="button" className="text-sm text-gray-400 px-3" onClick={() => setMostrarNuevoProveedor(false)}>
                cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- Cabecera de la factura --- */}
      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
        <label className="block text-sm font-medium mb-1">N.º de factura</label>
        <input
          className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2"
          value={numeroFactura}
          onChange={(e) => setNumeroFactura(e.target.value)}
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Moneda</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as "USD" | "VES")}
            >
              <option value="USD">USD</option>
              <option value="VES">Bs</option>
            </select>
          </div>
          {monedaVes && (
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Tasa (Bs/$)</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                value={tasaFactura}
                onChange={(e) => setTasaFactura(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* --- Agregar producto --- */}
      <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
        <h2 className="font-semibold mb-3">Agregar producto</h2>

        <label className="block text-sm font-medium mb-1">Buscar producto</label>
        <div className="relative mb-1">
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setProductoSeleccionado(null);
              setCreandoProductoNuevo(false);
            }}
            onFocus={() => resultados.length > 0 && setMostrarDropdown(true)}
            onBlur={() => setTimeout(() => setMostrarDropdown(false), 150)}
            placeholder="Nombre o código…"
          />
          {mostrarDropdown && resultados.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm active:bg-kaxa-50"
                    onMouseDown={() => seleccionarProducto(p)}
                  >
                    <span className="font-medium">{p.nombre}</span>
                    <span className="block text-xs text-gray-400">Stock: {p.stock_actual}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {productoSeleccionado && (
          <p className="text-xs text-green-700 mb-3">Producto existente: {productoSeleccionado.nombre} (stock actual: {productoSeleccionado.stock_actual})</p>
        )}

        {!productoSeleccionado && !creandoProductoNuevo && (
          <button type="button" className="text-sm text-kaxa-600 font-medium mb-3" onClick={empezarProductoNuevo}>
            + Crear producto nuevo
          </button>
        )}

        {creandoProductoNuevo && (
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Nombre del producto nuevo</label>
            <input
              className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
            />
            <label className="block text-sm font-medium mb-1">Categoría (opcional)</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={categoriaNuevo}
              onChange={(e) => setCategoriaNuevo(e.target.value)}
            />
          </div>
        )}

        {(productoSeleccionado || creandoProductoNuevo) && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1">Cajas</label>
                <input type="number" inputMode="decimal" className="w-full rounded-lg border border-gray-300 px-2 py-2" value={cajas} onChange={(e) => setCajas(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Und./caja</label>
                <input type="number" inputMode="decimal" className="w-full rounded-lg border border-gray-300 px-2 py-2" value={unidadesPorPaquete} onChange={(e) => setUnidadesPorPaquete(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Suelta</label>
                <input type="number" inputMode="decimal" className="w-full rounded-lg border border-gray-300 px-2 py-2" value={unidadSuelta} onChange={(e) => setUnidadSuelta(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Precio {cajasNum > 0 ? "de la caja" : "unitario"} ({moneda === "VES" ? "Bs" : "$"})
                </label>
                <input type="number" step="0.01" inputMode="decimal" className="w-full rounded-lg border border-gray-300 px-2 py-2" value={precioPaquete} onChange={(e) => setPrecioPaquete(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Margen %</label>
                <input type="number" inputMode="decimal" className="w-full rounded-lg border border-gray-300 px-2 py-2" value={margen} onChange={(e) => setMargen(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={aplicaIva} onChange={(e) => setAplicaIva(e.target.checked)} />
                Aplica IVA
              </label>
              {aplicaIva && (
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-20 rounded-lg border border-gray-300 px-2 py-1"
                  value={tasaIva}
                  onChange={(e) => setTasaIva(e.target.value)}
                />
              )}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={aplicaDescuento} onChange={(e) => setAplicaDescuento(e.target.checked)} />
                Descuento
              </label>
              {aplicaDescuento && (
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-20 rounded-lg border border-gray-300 px-2 py-1"
                  value={descuento}
                  onChange={(e) => setDescuento(e.target.value)}
                />
              )}
            </div>

            {precioPaqueteNum > 0 && (
              <div className="bg-kaxa-50 rounded-lg p-3 mb-3 text-sm text-kaxa-900">
                Se agregarán <strong>{cantidadPreview}</strong> unidades a costo de <strong>{costoUnitPreviewMoneda.toFixed(4)}</strong> {moneda} c/u
                {(aplicaDescuento || aplicaIva) && (
                  <>
                    {" ("}
                    {[aplicaDescuento ? `${descuentoNum}% descuento` : null, aplicaIva ? `${tasaIvaNum}% IVA` : null].filter(Boolean).join(" · ")}
                    {")"}
                  </>
                )}{" "}
                · Total de esta línea: <strong>{totalLineaPreviewMoneda.toFixed(2)} {moneda}</strong>
                <br />
                <span className="text-xs text-gray-500">Compara este total contra el de la factura de papel.</span>
              </div>
            )}

            {mensaje && <p className="text-red-600 text-sm mb-3">{mensaje}</p>}

            <button
              type="button"
              onClick={agregarLinea}
              className="w-full rounded-lg bg-kaxa-600 text-white font-medium py-2.5 transition-transform active:scale-[0.98]"
            >
              + Agregar línea
            </button>
          </>
        )}
      </div>

      {/* --- Líneas ya agregadas --- */}
      {lineas.length > 0 && (
        <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4">
          <h2 className="font-semibold mb-3">Productos en esta factura ({lineas.length})</h2>
          <div className="flex flex-col gap-2">
            {lineas.map((l, i) => {
              const costoUsd = calcularCostoUsdLinea(l, monedaVes, tasaFacturaNum);
              const cantidad = unidadesTotalesCompra(l.cajas, l.unidadesPorPaquete, l.unidadSuelta);
              return (
                <div key={i} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{l.nombre}</p>
                    <p className="text-xs text-gray-400">
                      {cantidad} unidades · USD {(costoUsd * cantidad).toFixed(2)}
                    </p>
                  </div>
                  <button type="button" className="text-red-500 text-sm px-2" onClick={() => quitarLinea(i)}>
                    quitar
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-sm font-semibold mt-3 pt-3 border-t border-gray-100">Total factura: USD {montoTotalUsd.toFixed(2)}</p>
        </div>
      )}

      {mensaje && lineas.length === 0 && !productoSeleccionado && !creandoProductoNuevo && (
        <p className="text-red-600 text-sm">{mensaje}</p>
      )}

      <button
        type="button"
        onClick={guardarFactura}
        disabled={guardando || lineas.length === 0}
        className="w-full rounded-lg bg-kaxa-600 text-white font-medium py-3 transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {guardando ? "Guardando…" : "Guardar factura"}
      </button>
    </div>
  );
}
