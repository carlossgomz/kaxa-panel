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
