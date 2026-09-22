"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function InventarioFiltro({ q, problemas }: { q: string; problemas: boolean }) {
  const router = useRouter();
  const [texto, setTexto] = useState(q);
  const [soloProblemas, setSoloProblemas] = useState(problemas);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (texto) params.set("q", texto);
      if (soloProblemas) params.set("problemas", "1");
      router.replace(`/panel/inventario?${params.toString()}`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, soloProblemas]);

  return (
    <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4 flex flex-col gap-2">
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar por nombre o código"
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={soloProblemas} onChange={(e) => setSoloProblemas(e.target.checked)} />
        Solo crítico (1 unidad) o agotado
      </label>
    </div>
  );
}
