import "./globals.css";
import type { ReactNode } from "react";

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
      <body className="bg-cream text-ink font-sans min-h-screen">{children}</body>
    </html>
  );
}
