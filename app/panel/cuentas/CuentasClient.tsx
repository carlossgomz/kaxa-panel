"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CuentaVinculada = { cuentaId: string; email: string; nombre: string; rol: string };

export default function CuentasClient({
  vinculadas,
  cuentaIdPropia,
}: {
  vinculadas: CuentaVinculada[];
  cuentaIdPropia: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"ADMIN" | "CAJERO">("CAJERO");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function vincular(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setCargando(true);
    try {
      const res = await fetch("/api/cuentas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, rol }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setError(datos.error ?? "No se pudo vincular la cuenta.");
        return;
      }
      setMensaje(`${email} quedó vinculado como ${rol === "ADMIN" ? "administrador" : "cajero"}.`);
      setEmail("");
      router.refresh();
    } catch {
      setError("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  async function desvincular(cuentaId: string, nombreCuenta: string) {
    if (!confirm(`¿Quitarle el acceso a ${nombreCuenta}?`)) return;
    const res = await fetch("/api/cuentas", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cuentaId }),
    });
    const datos = await res.json();
    if (!res.ok) {
      setError(datos.error ?? "No se pudo quitar el acceso.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Cuentas</h1>
      <p className="text-sm text-gray-500 mb-6">
        Quién puede entrar al panel de este negocio. Cada persona se registra sola en{" "}
        <span className="font-medium">/registro</span> con su propio email — acá la vinculás para darle acceso.
      </p>

      <form onSubmit={vincular} className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-6 flex flex-col gap-3">
        <p className="text-sm font-medium">Vincular una cuenta</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email con el que se registró"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          required
        />
        <select value={rol} onChange={(e) => setRol(e.target.value as "ADMIN" | "CAJERO")} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="CAJERO">Cajero — solo Venta, Facturas, Cuentas por cobrar</option>
          <option value="ADMIN">Administrador — acceso completo</option>
        </select>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {mensaje && <p className="text-green-600 text-sm">{mensaje}</p>}
        <button
          type="submit"
          disabled={cargando}
          className="rounded-lg bg-kaxa-600 text-white font-medium py-2.5 text-sm transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {cargando ? "Vinculando…" : "Vincular"}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {vinculadas.map((c) => (
          <div key={c.cuentaId} className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{c.nombre}</p>
              <p className="text-xs text-gray-400 truncate">
                {c.email} · {c.rol === "ADMIN" ? "administrador" : "cajero"}
                {c.cuentaId === cuentaIdPropia && " · vos"}
              </p>
            </div>
            {c.cuentaId !== cuentaIdPropia && (
              <button onClick={() => desvincular(c.cuentaId, c.nombre)} className="text-xs text-red-500 shrink-0 ml-2">
                quitar
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
