"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SIN_CATEGORIA = "__SIN_CATEGORIA__";

export default function InventarioFiltro({
  q,
  problemas,
  categoria,
  categorias,
}: {
  q: string;
  problemas: boolean;
  categoria: string;
  categorias: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(q);
  const [soloProblemas, setSoloProblemas] = useState(problemas);
  const [categoriaFiltro, setCategoriaFiltro] = useState(categoria);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (texto) params.set("q", texto);
      if (soloProblemas) params.set("problemas", "1");
      if (categoriaFiltro) params.set("categoria", categoriaFiltro);
      // Cualquier cambio de filtro vuelve a la página 1 — quedarse en una
      // página que puede ni existir con el filtro nuevo confunde más que
      // ayuda (mismo criterio que el escritorio).
      router.replace(`/panel/inventario?${params.toString()}`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, soloProblemas, categoriaFiltro]);

  return (
    <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4 flex flex-col gap-2">
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar por nombre o código"
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <select
        value={categoriaFiltro}
        onChange={(e) => setCategoriaFiltro(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">Todas las categorías</option>
        <option value={SIN_CATEGORIA}>Sin categoría</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={soloProblemas} onChange={(e) => setSoloProblemas(e.target.checked)} />
        Solo crítico (1 unidad) o agotado
      </label>
    </div>
  );
}
