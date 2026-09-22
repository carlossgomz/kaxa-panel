import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

// Shell compartido por toda la sección /panel. En móvil (por debajo de
// md) se ve como app: Header con hamburguesa arriba, contenido angosto
// centrado — igual que siempre. En escritorio (md y más ancho) se ve como
// programa de PC: Sidebar fijo a la izquierda siempre visible (Header se
// oculta solo) y el contenido se estira usando el ancho disponible en vez
// de quedar centrado en una columna angosta. Los datos de negocio/rol ya
// viven en la cookie de sesión (ver Sesion en lib/auth.ts), así que este
// layout no necesita pegarle a Turso para nada — solo lee la cookie,
// gratis.
export default function PanelLayout({ children }: { children: ReactNode }) {
  const sesion = obtenerSesion();
  if (!sesion) redirect("/login");

  return (
    <div className="min-h-screen bg-cream md:flex">
      <Sidebar negocio={sesion.negocio} rol={sesion.rol} />
      <div className="flex-1 min-w-0">
        <Header negocio={sesion.negocio} rol={sesion.rol} />
        <main className="max-w-md mx-auto px-4 py-6 md:max-w-5xl md:mx-0 md:px-10 md:py-8">{children}</main>
      </div>
    </div>
  );
}
