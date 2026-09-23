"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { comprimirImagen } from "@/lib/imagen";

// Logo del negocio (config.logo_base64, la misma columna que ya lee el
// programa de escritorio) — si el ADMIN lo toca, deja elegir una foto y
// la sube; se comprime en el navegador antes de mandarla (ver
// lib/imagen.ts). Un CAJERO lo ve pero no lo puede tocar (ni el botón
// aparece como tocable).
export default function LogoNegocio({ logo, rol, tamano = "w-8 h-8" }: { logo: string | null; rol: string; tamano?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubiendo(true);
    try {
      const dataUrl = await comprimirImagen(file);
      const res = await fetch("/api/negocio/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_base64: dataUrl }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const datos = await res.json();
        alert(datos.error ?? "No se pudo cambiar el logo.");
      }
    } catch {
      alert("No se pudo procesar esa imagen.");
    } finally {
      setSubiendo(false);
    }
  }

  const imagen = logo ? (
    <img src={logo} alt="Logo del negocio" className={`${tamano} shrink-0 rounded-lg object-cover border border-kaxa-100`} />
  ) : (
    <div className={`${tamano} shrink-0 rounded-lg bg-gradient-to-br from-kaxa-400 to-kaxa-900 flex items-center justify-center text-white font-bold text-sm`}>
      K
    </div>
  );

  if (rol !== "ADMIN") return imagen;

  return (
    <button type="button" onClick={() => inputRef.current?.click()} className="relative shrink-0" title="Cambiar logo del negocio">
      {imagen}
      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border border-kaxa-200 shadow-sm flex items-center justify-center text-[9px] leading-none">
        {subiendo ? "…" : "✎"}
      </span>
      <input ref={inputRef} type="file" accept="image/*" onChange={subir} className="hidden" />
    </button>
  );
}
