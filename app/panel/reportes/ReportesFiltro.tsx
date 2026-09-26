"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Mismo patrón que FacturasFiltro.tsx: filtra solo, sin botón "Buscar",
// con un debounce de 350ms para no mandar una consulta por cada tecla.
export default function ReportesFiltro({ desde, hasta }: { desde: string; hasta: string }) {
  const router = useRouter();
  const [valores, setValores] = useState({ desde, hasta });

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams({ desde: valores.desde, hasta: valores.hasta });
      router.replace(`/panel/reportes?${params.toString()}`);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores]);

  return (
    <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4 flex gap-2">
      <input
        type="date"
        value={valores.desde}
        onChange={(e) => setValores((v) => ({ ...v, desde: e.target.value }))}
        className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm"
      />
      <input
        type="date"
        value={valores.hasta}
        onChange={(e) => setValores((v) => ({ ...v, hasta: e.target.value }))}
        className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm"
      />
    </div>
  );
}
