import "./globals.css";
import type { ReactNode } from "react";
import { SCRIPT_TEMA_INICIAL } from "@/lib/tema";

export const metadata = {
  title: "Kaxa Móvil",
  description: "Gestiona tu negocio desde cualquier lugar",
  manifest: "/manifest.webmanifest",
  // Safari en iOS no lee el manifest.json para "Agregar a inicio" - esto
  // es lo que de verdad hace falta ahí: pantalla completa (sin la barra
  // de Safari) y el nombre corto debajo del ícono en el celular.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kaxa"
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f6e56"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className="bg-cream dark:bg-[#0d1210] text-ink dark:text-gray-100 font-sans min-h-screen">{children}</body>
    </html>
  );
}
