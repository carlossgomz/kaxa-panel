"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegistroPage() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const res = await fetch("/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, password }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setError(datos.error ?? "No se pudo crear la cuenta.");
        return;
      }
      setListo(true);
    } catch {
      setError("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  if (listo) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-kaxa-100 p-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-kaxa-50 flex items-center justify-center text-2xl mb-3">✅</div>
          <h1 className="text-lg font-semibold mb-2">Cuenta creada</h1>
          <p className="text-sm text-gray-500 mb-6">
            Ahora pedile a quien administra el negocio en Kaxa que te vincule desde Cuentas, dentro del panel, con este
            email: <span className="font-medium">{email}</span>
          </p>
          <Link href="/login" className="text-sm text-kaxa-600 font-medium">
            Ir a iniciar sesión →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={enviar} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-kaxa-100 p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-kaxa-400 to-kaxa-900 flex items-center justify-center text-white font-bold">
            K
          </div>
          <span className="font-semibold text-lg">Kaxa Panel</span>
        </div>
        <p className="text-sm text-gray-500 mb-6">Creá tu cuenta — después te vinculan al negocio.</p>

        <label className="block text-sm font-medium mb-1">Tu nombre</label>
        <input
          className="w-full mb-4 rounded-lg border border-gray-300 px-3 py-2"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />

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
          className="w-full mb-1 rounded-lg border border-gray-300 px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <p className="text-xs text-gray-400 mb-5">Al menos 6 caracteres.</p>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-lg bg-kaxa-600 text-white font-medium py-2.5 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {cargando ? "Creando…" : "Crear cuenta"}
        </button>

        <p className="text-center text-sm text-gray-400 mt-4">
          ¿Ya tenés cuenta? <Link href="/login" className="text-kaxa-600 font-medium">Iniciar sesión</Link>
        </p>
      </form>
    </main>
  );
}
