import type { ReactNode } from "react";
import { obtenerContexto } from "@/lib/contexto";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

// Shell compartido por toda la sección /panel. En móvil (por debajo de
// md) se ve como app: Header con hamburguesa arriba, contenido angosto
// centrado — igual que siempre. En escritorio (md y más ancho) se ve como
// programa de PC: Sidebar fijo a la izquierda siempre visible (Header se
// oculta solo) y el contenido se estira usando el ancho disponible en vez
// de quedar centrado en una columna angosta.
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const { sesion, db } = await obtenerContexto();
  // Mismo config.logo_base64 que usa el programa de escritorio de este
  // negocio (ver comentario en app/api/negocio/logo/route.ts) — se lee
  // acá, una sola vez por navegación, para no repetirlo en Header y
  // Sidebar por separado.
  const logoRes = await db.execute("SELECT logo_base64 FROM config WHERE id = 1");
  const logo = (logoRes.rows[0]?.logo_base64 as string | null) ?? null;

  return (
    <div className="min-h-screen bg-cream md:flex">
      <Sidebar negocio={sesion.negocio} rol={sesion.rol} logo={logo} />
      <div className="flex-1 min-w-0">
        <Header negocio={sesion.negocio} rol={sesion.rol} logo={logo} />
        <main className="max-w-md mx-auto px-4 py-6 md:max-w-5xl md:mx-0 md:px-10 md:py-8">{children}</main>
      </div>
    </div>
  );
}
