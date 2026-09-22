"use client";

import { useRouter } from "next/navigation";

export default function CajaFecha({ fecha }: { fecha: string }) {
  const router = useRouter();
  return (
    <div className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-4">
      <input
        type="date"
        defaultValue={fecha}
        onChange={(e) => router.replace(`/panel/caja?fecha=${e.target.value}`)}
        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-center [&::-webkit-date-and-time-value]:text-center"
      />
    </div>
  );
}
