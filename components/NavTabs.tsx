"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Barra de navegación fija abajo, pensada para el pulgar en el celular.
// "Pagar" solo se muestra a ADMIN — igual que CuentasPorPagar en el
// programa de escritorio, que ni siquiera se monta para un cajero.
export default function NavTabs({ rol }: { rol: string }) {
  const pathname = usePathname();

  const tabs = [
    { href: "/panel", label: "Inicio", icono: "🏠" },
    { href: "/panel/cobrar", label: "Cobrar", icono: "💵" },
    ...(rol === "ADMIN" ? [{ href: "/panel/pagar", label: "Pagar", icono: "📦" }] : []),
    { href: "/panel/facturas", label: "Facturas", icono: "🧾" },
    { href: "/panel/inventario", label: "Stock", icono: "📊" },
    { href: "/panel/caja", label: "Caja", icono: "🏦" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-kaxa-100 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto flex overflow-x-auto gap-1 px-2 py-2">
        {tabs.map((t) => {
          const activo = pathname === t.href || (t.href !== "/panel" && pathname.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 px-2 text-xs font-medium shrink-0 min-w-[3.5rem] ${
                activo ? "text-kaxa-700 bg-kaxa-50" : "text-gray-400"
              }`}
            >
              <span className="text-lg leading-none">{t.icono}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
