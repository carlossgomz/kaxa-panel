"use client";

import { useRouter } from "next/navigation";

export default function CajaFecha({ fecha }: { fecha: string }) {
  const router = useRouter();
  return (
    <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4 flex justify-center">
      <input
        type="date"
        defaultValue={fecha}
        onChange={(e) => router.replace(`/panel/caja?fecha=${e.target.value}`)}
        className="w-full max-w-[220px] rounded-lg border border-gray-300 px-4 py-2 text-sm"
      />
    </div>
  );
}
