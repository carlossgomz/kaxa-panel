// Réplica de las funciones puras de src/precios.ts del escritorio que
// necesita el panel para mostrar stock/precios — solo lectura acá, así
// que no hace falta portar nada de lo que escribe (ajustes de costo, etc.).

export function formatearStock(stock: number): string {
  return String(Math.round(stock * 1000) / 1000);
}

export type EstadoStock = "agotado" | "critico" | "bajo" | "ok";

export function estadoStock(p: { stock_actual: number; stock_minimo: number }): EstadoStock {
  if (p.stock_actual <= 0) return "agotado";
  if (p.stock_actual === 1) return "critico";
  if (p.stock_actual <= p.stock_minimo) return "bajo";
  return "ok";
}

export function precioVentaUsd(p: { costo_actual_usd: number; margen_porcentaje: number | null }): number {
  const margen = Math.min(Math.max(p.margen_porcentaje ?? 0, 0), 99.99);
  return p.costo_actual_usd / (1 - margen / 100);
}

export function precioVentaBsHoy(p: { costo_actual_usd: number; margen_porcentaje: number | null }, tasaCambioDia: number): number {
  const usdRedondeado = Math.round(precioVentaUsd(p) * 100) / 100;
  return usdRedondeado * tasaCambioDia;
}

// --- Compras: réplica exacta de las funciones de Compras.tsx del
// escritorio (unidadesTotales, costoUnitarioIngresado, costoUsdDeLinea,
// costoVigenteDeLinea) - acá como funciones puras parametrizadas en vez de
// closures sobre el estado del componente, para poder compartirlas entre
// la previsualización en el cliente y el guardado en el servidor.

export function unidadesTotalesCompra(cajas: number, unidadesPorPaquete: number, unidadSuelta: number): number {
  return cajas * unidadesPorPaquete + unidadSuelta;
}

export function costoUnitarioIngresado(cajas: number, unidadesPorPaquete: number, precioPaqueteIngresado: number): number {
  return cajas > 0 ? precioPaqueteIngresado / unidadesPorPaquete : precioPaqueteIngresado;
}

// El descuento se aplica sobre el costo base (igual que en la factura de
// papel), y el IVA después, sobre lo que queda con el descuento ya
// restado - mismo orden que costoUsdDeLinea en Compras.tsx.
export function costoUsdDeLineaCompra(params: {
  costoUnitarioIngresado: number;
  monedaVes: boolean;
  tasaFactura: number;
  aplicaDescuento: boolean;
  descuentoPct: number;
  aplicaIva: boolean;
  tasaIva: number;
}): number {
  const costoBase = params.monedaVes ? params.costoUnitarioIngresado / params.tasaFactura : params.costoUnitarioIngresado;
  const costoConDescuento = params.aplicaDescuento ? costoBase * (1 - params.descuentoPct / 100) : costoBase;
  return params.aplicaIva ? costoConDescuento * (1 + params.tasaIva / 100) : costoConDescuento;
}

// Costo que queda VIGENTE para el producto tras esta línea - el promedio
// ponderado entre el stock que ya tenía (a su costo anterior) y esta
// compra nueva. Si es un producto nuevo o no tenía stock, es igual al
// costo nuevo tal cual.
export function costoVigenteDeLineaCompra(params: {
  costoNuevoUsd: number;
  cantidadNueva: number;
  costoAnteriorUsd: number | null;
  stockAnteriorUnidades: number;
}): number {
  if (params.costoAnteriorUsd == null || params.stockAnteriorUnidades <= 0) return params.costoNuevoUsd;
  return (
    (params.stockAnteriorUnidades * params.costoAnteriorUsd + params.cantidadNueva * params.costoNuevoUsd) /
    (params.stockAnteriorUnidades + params.cantidadNueva)
  );
}

// Margen bruto sobre el precio de venta, topado en 99.99 para no dividir
// por cero o un número negativo si se escribe 100 o más por error.
export function precioBsDesdeCostoYMargen(costoUsd: number, margenPorcentaje: number, tasa: number): number {
  const margen = Math.min(Math.max(margenPorcentaje, 0), 99.99);
  return (costoUsd / (1 - margen / 100)) * tasa;
}
