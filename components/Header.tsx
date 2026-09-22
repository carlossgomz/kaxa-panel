"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Encabezado + navegación por pestañas, fijos arriba — así el panel se
// siente una app de verdad (Kaxa Móvil) y no una serie de páginas
// sueltas. Todo en un solo componente para que el sticky del header y el
// de las pestañas queden pegados sin un salto entre los dos.
export default function Header({ negocio, rol }: { negocio: string; rol: string }) {
  const pathname = usePathname();

  const tabs = [
    { href: "/panel/venta", label: "Venta", icono: "🛒" },
    { href: "/panel", label: "Inicio", icono: "🏠" },
    { href: "/panel/cobrar", label: "Cobrar", icono: "💵" },
    ...(rol === "ADMIN" ? [{ href: "/panel/pagar", label: "Pagar", icono: "📦" }] : []),
    { href: "/panel/facturas", label: "Facturas", icono: "🧾" },
    { href: "/panel/inventario", label: "Stock", icono: "📊" },
    { href: "/panel/caja", label: "Caja", icono: "🏦" },
  ];

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-kaxa-100">
      <div className="max-w-md mx-auto px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-kaxa-400 to-kaxa-900 flex items-center justify-center text-white font-bold text-sm">
            K
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{negocio}</p>
            <p className="text-[11px] text-gray-400 leading-tight">Kaxa Móvil</p>
          </div>
        </div>
        <form action="/api/logout" method="post">
          <button
            type="submit"
            aria-label="Cerrar sesión"
            className="shrink-0 text-gray-400 active:text-gray-600 text-lg leading-none p-2 -m-2"
          >
            ⏻
          </button>
        </form>
      </div>

      <nav className="max-w-md mx-auto flex overflow-x-auto gap-1 px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const activo = pathname === t.href || (t.href !== "/panel" && pathname.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shrink-0 transition-colors ${
                activo ? "bg-kaxa-600 text-white" : "bg-kaxa-50 text-kaxa-700 active:bg-kaxa-100"
              }`}
            >
              <span className="text-sm leading-none">{t.icono}</span>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
