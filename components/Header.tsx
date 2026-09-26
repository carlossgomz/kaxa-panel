"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoNegocio from "./LogoNegocio";

// Encabezado fijo arriba con un botón de hamburguesa que despliega las
// secciones en un menú lateral — reemplaza la barra de pestañas horizontal
// de antes para no comerse tanta pantalla en el celular, todo el panel
// queda un poco más de app y un poco menos de "pestañas de navegador".
// Solo para móvil (md:hidden) — en pantallas de escritorio la navegación
// vive en Sidebar.tsx, siempre visible a la izquierda.
export default function Header({ negocio, rol, logo }: { negocio: string; rol: string; logo: string | null }) {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Cerrar el menú solo al cambiar de página, no al abrirlo.
  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  const tabs = [
    { href: "/panel", label: "Inicio", icono: "🏠" },
    { href: "/panel/venta", label: "Venta", icono: "🛒" },
    { href: "/panel/cobrar", label: "Cobrar", icono: "💵" },
    ...(rol === "ADMIN" ? [{ href: "/panel/pagar", label: "Pagar", icono: "📦" }] : []),
    ...(rol === "ADMIN" ? [{ href: "/panel/compras", label: "Compras", icono: "📥" }] : []),
    { href: "/panel/facturas", label: "Facturas", icono: "🧾" },
    { href: "/panel/inventario", label: "Stock", icono: "📊" },
    { href: "/panel/caja", label: "Caja", icono: "🏦" },
    ...(rol === "ADMIN" ? [{ href: "/panel/cuentas", label: "Cuentas", icono: "👥" }] : []),
  ];

  return (
    <>
      <header className="md:hidden sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-kaxa-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setMenuAbierto(true)}
              aria-label="Abrir menú"
              className="shrink-0 w-9 h-9 -ml-2 flex items-center justify-center text-gray-500 active:text-kaxa-700 active:bg-kaxa-50 rounded-lg"
            >
              <span className="text-xl leading-none">☰</span>
            </button>
            <LogoNegocio logo={logo} rol={rol} />
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
      </header>

      {menuAbierto && (
        <div className="fixed inset-0 z-30">
          <button
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
            className="absolute inset-0 bg-black/40"
          />
          <nav className="absolute left-0 top-0 bottom-0 w-64 max-w-[80%] bg-white shadow-xl flex flex-col p-3 pt-4 overflow-y-auto">
            <div className="flex items-center gap-2 px-2 mb-3">
              <LogoNegocio logo={logo} rol={rol} />
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight truncate">{negocio}</p>
                <p className="text-[11px] text-gray-400 leading-tight">Kaxa Móvil</p>
              </div>
            </div>
            {tabs.map((t) => {
              const activo = pathname === t.href || (t.href !== "/panel" && pathname.startsWith(t.href));
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                    activo ? "bg-kaxa-600 text-white" : "text-kaxa-900 active:bg-kaxa-50"
                  }`}
                >
                  <span className="text-lg leading-none">{t.icono}</span>
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
