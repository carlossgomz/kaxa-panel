"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CuentaVinculada = { cuentaId: string; email: string; nombre: string; rol: string };
type Invitacion = { token: string; email: string; rol: string; expiraAt: string };

function etiquetaRol(rol: string) {
  return rol === "ADMIN" ? "administrador" : "cajero";
}

export default function CuentasClient({
  vinculadas,
  invitaciones,
  cuentaIdPropia,
}: {
  vinculadas: CuentaVinculada[];
  invitaciones: Invitacion[];
  cuentaIdPropia: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"ADMIN" | "CAJERO">("CAJERO");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [linkGenerado, setLinkGenerado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function copiarLink(link: string) {
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  async function invitar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setLinkGenerado(null);
    setCargando(true);
    try {
      const res = await fetch("/api/invitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, rol }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setError(datos.error ?? "No se pudo invitar a esa cuenta.");
        return;
      }
      if (datos.vinculadoDirecto) {
        setMensaje(`${email} ya tenía cuenta — quedó vinculado como ${etiquetaRol(datos.rol)}.`);
      } else {
        setLinkGenerado(`${window.location.origin}/registro?invite=${datos.token}`);
      }
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

  async function revocarInvitacion(token: string) {
    if (!confirm("¿Anular este link de invitación?")) return;
    const res = await fetch("/api/invitaciones", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      setError("No se pudo anular el link.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Cuentas</h1>
      <p className="text-sm text-gray-500 mb-6">
        Quién puede entrar al panel de este negocio. Si el email ya tiene cuenta, queda vinculado al toque; si no, te
        doy un link para que se registre y quede vinculado solo.
      </p>

      <form onSubmit={invitar} className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 mb-6 flex flex-col gap-3">
        <p className="text-sm font-medium">Invitar</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email de la persona"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          required
        />
        <select value={rol} onChange={(e) => setRol(e.target.value as "ADMIN" | "CAJERO")} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="CAJERO">Cajero — solo Venta, Facturas, Cuentas por cobrar</option>
          <option value="ADMIN">Administrador — acceso completo</option>
        </select>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {mensaje && <p className="text-green-600 text-sm">{mensaje}</p>}
        {linkGenerado && (
          <div className="flex items-center gap-2 bg-kaxa-50 rounded-lg px-3 py-2">
            <p className="text-xs text-kaxa-700 truncate flex-1">{linkGenerado}</p>
            <button type="button" onClick={() => copiarLink(linkGenerado)} className="text-xs font-medium text-kaxa-700 shrink-0">
              {copiado ? "copiado ✓" : "copiar"}
            </button>
          </div>
        )}
        <button
          type="submit"
          disabled={cargando}
          className="rounded-lg bg-kaxa-600 text-white font-medium py-2.5 text-sm transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {cargando ? "Generando…" : "Generar link"}
        </button>
        <p className="text-xs text-gray-400">El link vale por 7 días y se gasta al usarse una vez.</p>
      </form>

      {invitaciones.length > 0 && (
        <div className="flex flex-col gap-2 mb-6">
          <p className="text-xs text-gray-400 px-1">Links pendientes de usar</p>
          {invitaciones.map((inv) => (
            <div key={inv.token} className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{inv.email}</p>
                <p className="text-xs text-gray-400">
                  {etiquetaRol(inv.rol)} · vence {new Date(inv.expiraAt).toLocaleDateString("es-VE")}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => copiarLink(`${window.location.origin}/registro?invite=${inv.token}`)}
                  className="text-xs text-kaxa-600 font-medium"
                >
                  copiar
                </button>
                <button onClick={() => revocarInvitacion(inv.token)} className="text-xs text-red-500">
                  anular
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {vinculadas.map((c) => (
          <div key={c.cuentaId} className="bg-white rounded-2xl border border-kaxa-100 shadow-sm p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{c.nombre}</p>
              <p className="text-xs text-gray-400 truncate">
                {c.email} · {etiquetaRol(c.rol)}
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
