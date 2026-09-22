// Mismos criterios que src/precios.ts y src/screens/Cuentas.tsx del
// programa de escritorio — repetidos acá porque el panel es un proyecto
// Next.js aparte, sin acceso directo a ese código.

export const EPS = 0.01;

export const METODOS_PAGO = ["EFECTIVO", "PUNTO_VENTA", "BIOPAGO", "PAGO_MOVIL", "DIVISAS", "TRANSFERENCIA"] as const;

// DIVISAS es el único método que se cobra directo en dólares — todos los
// demás se escriben en bolívares y se convierten con la tasa del día.
export function monedaDeMetodo(metodo: string): "USD" | "BS" {
  return metodo === "DIVISAS" ? "USD" : "BS";
}

export function formatoUsd(n: number): string {
  return `USD ${n.toFixed(2)}`;
}

export function formatoBs(n: number): string {
  return `Bs ${n.toFixed(2)}`;
}
