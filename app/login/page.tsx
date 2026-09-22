"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, usuario, password })
      });
      const datos = await res.json();
      if (!res.ok) {
        setError(datos.error ?? "No se pudo iniciar sesión.");
        return;
      }
      router.push("/panel");
      router.refresh();
    } catch {
      setError("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={enviar} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-kaxa-100 p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-kaxa-400 to-kaxa-900 flex items-center justify-center text-white font-bold">
            K
          </div>
          <span className="font-semibold text-lg">Kaxa Móvil</span>
        </div>
        <p className="text-sm text-gray-500 mb-6">Gestiona tu negocio desde cualquier lugar.</p>

        <label className="block text-sm font-medium mb-1">Código de negocio</label>
        <input
          className="w-full mb-4 rounded-lg border border-gray-300 px-3 py-2"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="ej. minimarket-el-sol"
          required
        />

        <label className="block text-sm font-medium mb-1">Usuario</label>
        <input
          className="w-full mb-4 rounded-lg border border-gray-300 px-3 py-2"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="el mismo de tu programa Kaxa"
          required
        />

        <label className="block text-sm font-medium mb-1">Contraseña</label>
        <input
          type="password"
          className="w-full mb-5 rounded-lg border border-gray-300 px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-lg bg-kaxa-600 text-white font-medium py-2.5 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {cargando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
