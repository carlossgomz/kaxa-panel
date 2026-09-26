"use client";

import { useEffect, useState } from "react";
import { METODOS_PAGO, monedaDeMetodo as monedaDeMetodoFijo } from "@/lib/dinero";

export type MetodoPago = { nombre: string; moneda: "BS" | "USD" };

// Listado de reserva para negocios sin tabla metodos_pago (la build
// especial de Day Express) — mismo listado y misma regla que
// monedaDeMetodo en lib/dinero.ts.
const METODOS_FIJOS: MetodoPago[] = METODOS_PAGO.map((nombre) => ({
  nombre,
  moneda: monedaDeMetodoFijo(nombre),
}));

// Métodos de pago ACTIVOS para elegir al cobrar/pagar/abonar. Lee la tabla
// dinámica metodos_pago cuando el negocio la tiene (igual que Kaxa
// Avanzado de escritorio, vía useMetodosPagoActivos en metodosPago.ts) —
// si no la tiene, usa el listado fijo de siempre en vez de romper.
export function useMetodosPagoActivos() {
  const [metodos, setMetodos] = useState<MetodoPago[]>(METODOS_FIJOS);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/metodos-pago")
      .then((r) => r.json())
      .then((datos: { soportado: boolean; metodos: { nombre: string; moneda: string; activo: number }[] }) => {
        if (cancelado || !datos.soportado) return;
        setMetodos(
          datos.metodos
            .filter((m) => m.activo === 1)
            .map((m) => ({ nombre: m.nombre, moneda: m.moneda === "USD" ? "USD" : "BS" }))
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  function monedaDeMetodo(nombre: string): "BS" | "USD" {
    return metodos.find((m) => m.nombre === nombre)?.moneda ?? monedaDeMetodoFijo(nombre);
  }

  return { metodos, monedaDeMetodo, cargando };
}
