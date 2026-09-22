import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import Header from "@/components/Header";

// Shell compartido por toda la sección /panel — header + pestañas fijas
// arriba, una sola vez acá en vez de repetidas en cada page.tsx. Los datos
// de negocio/rol ya viven en la cookie de sesión (ver Sesion en
// lib/auth.ts), así que este layout no necesita pegarle a Turso para
// nada — solo lee la cookie, gratis.
export default function PanelLayout({ children }: { children: ReactNode }) {
  const sesion = obtenerSesion();
  if (!sesion) redirect("/login");

  return (
    <div className="min-h-screen bg-cream">
      <Header negocio={sesion.negocio} rol={sesion.rol} />
      <main className="max-w-md mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
