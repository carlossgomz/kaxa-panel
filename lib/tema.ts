// Tema claro/oscuro — se guarda en localStorage (por dispositivo, no por
// cuenta), mismo criterio que el programa de escritorio (ver TEMA_KEY en
// App.tsx): no tiene sentido que cambie de tema al cerrar sesión o al
// entrar desde otro negocio en el mismo teléfono.
export const TEMA_KEY = "kaxa-panel-tema";

export function temaGuardado(): "claro" | "oscuro" {
  if (typeof window === "undefined") return "claro";
  return localStorage.getItem(TEMA_KEY) === "oscuro" ? "oscuro" : "claro";
}

export function aplicarTema(tema: "claro" | "oscuro") {
  document.documentElement.classList.toggle("dark", tema === "oscuro");
}

export function guardarTema(tema: "claro" | "oscuro") {
  localStorage.setItem(TEMA_KEY, tema);
  aplicarTema(tema);
}

// Se inyecta como texto plano en un <script> antes de hidratar (ver
// app/layout.tsx) — aplica la clase "dark" al <html> ANTES del primer
// pintado, para no mostrar un flash de tema claro en cada carga cuando el
// dispositivo ya eligió oscuro.
export const SCRIPT_TEMA_INICIAL = `
(function () {
  try {
    if (localStorage.getItem("${TEMA_KEY}") === "oscuro") {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;
