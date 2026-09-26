// Logo del negocio (config.logo_base64, la misma columna que ya lee el
// programa de escritorio) — solo para mostrar. El logo se cambia desde
// Configuración > Negocio, no tocando el ícono del encabezado (para que no
// se cambie por accidente); ver ConfiguracionClient.tsx.
export default function LogoNegocio({ logo, tamano = "w-8 h-8" }: { logo: string | null; tamano?: string }) {
  return logo ? (
    <img src={logo} alt="Logo del negocio" className={`${tamano} shrink-0 rounded-lg object-contain bg-white border border-kaxa-100 p-0.5`} />
  ) : (
    <div className={`${tamano} shrink-0 rounded-lg bg-gradient-to-br from-kaxa-400 to-kaxa-900 flex items-center justify-center text-white font-bold text-sm`}>
      K
    </div>
  );
}
