/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Mismo verde-azulado de la marca Kaxa (ícono del programa, PDF de
        // presentación) — así el panel se siente parte del mismo producto.
        kaxa: {
          50: "#EAF6F1",
          100: "#CFEBE0",
          400: "#16A37C",
          600: "#0F6E56",
          900: "#083F31"
        },
        ink: "#101A16",
        cream: "#F4F7F5"
      },
      fontFamily: {
        sans: ["-apple-system", "Segoe UI", "Helvetica", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};
