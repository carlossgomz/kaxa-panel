import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Kaxa Móvil",
  description: "Gestiona tu negocio desde cualquier lugar"
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
