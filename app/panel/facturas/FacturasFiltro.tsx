"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Filtra mientras se escribe/cambia la fecha, sin botón "Buscar" — un
// debounce de 350ms evita mandar una consulta por cada letra tecleada
// (la misma idea que el debounce de Compras/Inventario en el escritorio).
export default function FacturasFiltro({ desde, hasta, q }: { desde: string; hasta: string; q: string }) {
  const router = useRouter();
  const [valores, setValores] = useState({ desde, hasta, q });

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (valores.desde) params.set("desde", valores.desde);
      if (valores.hasta) params.set("hasta", valores.hasta);
      if (valores.q) params.set("q", valores.q);
      router.replace(`/panel/facturas?${params.toString()}`);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores]);

  return (
    <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4 flex flex-col gap-2">
      <div className="flex gap-2">
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
      <input
        value={valores.q}
        onChange={(e) => setValores((v) => ({ ...v, q: e.target.value }))}
        placeholder="N° de ticket, cliente o cédula"
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
