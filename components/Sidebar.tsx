"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Versión de escritorio de la navegación: un panel fijo a la izquierda,
// siempre visible, en vez del botón de hamburguesa de Header.tsx (ese es
// solo para móvil, oculto acá vía md:hidden). Mismo listado de secciones,
// nomás mostrado como programa de PC en vez de app de celular.
export default function Sidebar({ negocio, rol }: { negocio: string; rol: string }) {
  const pathname = usePathname();

  const tabs = [
    { href: "/panel", label: "Inicio", icono: "🏠" },
    { href: "/panel/venta", label: "Venta", icono: "🛒" },
    { href: "/panel/cobrar", label: "Cobrar", icono: "💵" },
    ...(rol === "ADMIN" ? [{ href: "/panel/pagar", label: "Pagar", icono: "📦" }] : []),
    { href: "/panel/facturas", label: "Facturas", icono: "🧾" },
    { href: "/panel/inventario", label: "Stock", icono: "📊" },
    { href: "/panel/caja", label: "Caja", icono: "🏦" },
    ...(rol === "ADMIN" ? [{ href: "/panel/cuentas", label: "Cuentas", icono: "👥" }] : []),
  ];

  return (
    <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 bg-white border-r border-kaxa-100">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-kaxa-100">
        <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-kaxa-400 to-kaxa-900 flex items-center justify-center text-white font-bold text-sm">
          K
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{negocio}</p>
          <p className="text-[11px] text-gray-400 leading-tight">Kaxa Panel</p>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
        {tabs.map((t) => {
          const activo = pathname === t.href || (t.href !== "/panel" && pathname.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                activo ? "bg-kaxa-600 text-white" : "text-kaxa-900 hover:bg-kaxa-50"
              }`}
            >
              <span className="text-base leading-none">{t.icono}</span>
              {t.label}
            </Link>
          );
        })}
      </nav>

      <form action="/api/logout" method="post" className="p-3 border-t border-kaxa-100">
        <button
          type="submit"
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-400 hover:bg-kaxa-50 hover:text-red-600"
        >
          <span className="text-base leading-none">⏻</span>
          Cerrar sesión
        </button>
      </form>
    </aside>
  );
}
