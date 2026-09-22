"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type NegocioOpcion = { slug: string; negocio: string };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [opciones, setOpciones] = useState<NegocioOpcion[] | null>(null);

  async function intentar(slug?: string) {
    setError(null);
    setCargando(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, slug })
      });
      const datos = await res.json();
      if (!res.ok) {
        setError(datos.error ?? "No se pudo iniciar sesión.");
        return;
      }
      if (datos.elegirNegocio) {
        setOpciones(datos.elegirNegocio);
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

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    intentar();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-kaxa-100 p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-kaxa-400 to-kaxa-900 flex items-center justify-center text-white font-bold">
            K
          </div>
          <span className="font-semibold text-lg">Kaxa Panel</span>
        </div>
        <p className="text-sm text-gray-500 mb-6">Gestiona tu negocio desde cualquier lugar.</p>

        {opciones ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium mb-1">Tu cuenta entra a varios negocios — ¿a cuál?</p>
            {opciones.map((o) => (
              <button
                key={o.slug}
                onClick={() => intentar(o.slug)}
                disabled={cargando}
                className="text-left rounded-lg border border-gray-300 px-3 py-2.5 text-sm active:bg-kaxa-50 disabled:opacity-60"
              >
                {o.negocio}
              </button>
            ))}
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
            <button onClick={() => setOpciones(null)} className="text-xs text-gray-400 mt-2 text-left">
              volver
            </button>
          </div>
        ) : (
          <form onSubmit={enviar}>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              className="w-full mb-4 rounded-lg border border-gray-300 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

            <p className="text-center text-sm text-gray-400 mt-4">
              ¿No tenés cuenta? <Link href="/registro" className="text-kaxa-600 font-medium">Registrate</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
