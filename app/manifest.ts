import type { MetadataRoute } from "next";

// Manifest de PWA — lo único que hace falta para que el navegador ofrezca
// "Agregar a la pantalla de inicio" (o Chrome lo sugiera solo) y el panel
// quede como un ícono normal en el celular, sin la barra de direcciones ni
// los botones del navegador al abrirlo (display: "standalone"). Reusa el
// mismo ícono "K" que ya existe en app/icon.png (el de la pestaña del
// navegador) — cero assets nuevos, cero costo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kaxa Móvil",
    short_name: "Kaxa",
    description: "Gestiona tu negocio desde cualquier lugar",
    start_url: "/panel",
    display: "standalone",
    background_color: "#F4F7F5",
    theme_color: "#0F6E56",
    icons: [
      {
        src: "/icon.png",
        sizes: "128x128",
        type: "image/png",
      },
    ],
  };
}
