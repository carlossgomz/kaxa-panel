"use client";

import { useEffect, useState } from "react";
import { temaGuardado, guardarTema } from "@/lib/tema";

// Disponible para cualquier rol (cajero incluido) — es una preferencia de
// pantalla del dispositivo, no una configuración del negocio, mismo
// criterio que la categoría "Tema" en Configuracion.tsx del escritorio.
export default function BotonTema({ className = "" }: { className?: string }) {
  const [tema, setTema] = useState<"claro" | "oscuro">("claro");

  useEffect(() => {
    setTema(temaGuardado());
  }, []);

  function alternar() {
    const nuevo = tema === "oscuro" ? "claro" : "oscuro";
    setTema(nuevo);
    guardarTema(nuevo);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-kaxa-900 dark:text-kaxa-100 hover:bg-kaxa-50 dark:hover:bg-kaxa-900/30 ${className}`}
    >
      <span className="text-base leading-none">{tema === "oscuro" ? "☀️" : "🌙"}</span>
      {tema === "oscuro" ? "Tema claro" : "Tema oscuro"}
    </button>
  );
}
