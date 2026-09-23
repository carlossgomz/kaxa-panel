// Solo para el navegador (Header/Sidebar son "use client") — redimensiona
// el logo que suba el admin antes de mandarlo al servidor. El campo
// logo_base64 se lee en CADA carga de config, tanto acá como en las 4
// ediciones del programa de escritorio, así que conviene que sea chico:
// una foto de varios MB directo de un celular volvería más lenta a toda
// la app, no solo a esta pantalla.
export function comprimirImagen(file: File, ladoMax = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Ese archivo no es una imagen válida."));
      img.onload = () => {
        const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
        const ancho = Math.round(img.width * escala);
        const alto = Math.round(img.height * escala);
        const canvas = document.createElement("canvas");
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No se pudo procesar la imagen."));
        ctx.drawImage(img, 0, 0, ancho, alto);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = String(lector.result);
    };
    lector.readAsDataURL(file);
  });
}
