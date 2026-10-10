/** @type {import('tailwindcss').Config} */
const suave = "cubic-bezier(0.22, 1, 0.36, 1)";
const gaveta = "cubic-bezier(0.32, 0.72, 0, 1)";

module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0B1B31",
          900: "#13294A",
          700: "#2B4368",
        },
        copper: {
          700: "#8E5A47",
          600: "#A9705A",
          500: "#C08A74",
          100: "#F4E5DC",
        },
        paper: "#FAF8F6",
        line: "#E7DFD8",
        muted: { DEFAULT: "#847A70", ink: "#6B6158" },
        ok: "#1F9D55",
        warn: "#D69E2E",
        danger: "#C0392B",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        // Variáveis definidas só em app/c/layout.tsx (página pública do cliente).
        texto: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(19,41,74,0.06), 0 1px 3px 0 rgba(19,41,74,0.08)",
        sheet: "0 -12px 40px -12px rgba(11,27,49,0.28)",
        dialog: "0 24px 60px -20px rgba(11,27,49,0.45)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "sheet-in": { from: { transform: "translateY(100%)" }, to: { transform: "none" } },
        "sheet-out": { from: { transform: "none" }, to: { transform: "translateY(100%)" } },
        "modal-in": {
          from: { opacity: "0", transform: "translateY(12px) scale(0.98)" },
          to: { opacity: "1", transform: "none" },
        },
        "modal-out": {
          from: { opacity: "1", transform: "none" },
          to: { opacity: "0", transform: "translateY(12px) scale(0.98)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "60%": { opacity: "1", transform: "scale(1.06)" },
          "100%": { opacity: "1", transform: "none" },
        },
        draw: { from: { strokeDashoffset: "1" }, to: { strokeDashoffset: "0" } },
        shimmer: { from: { backgroundPosition: "100% 0" }, to: { backgroundPosition: "-100% 0" } },
      },
      animation: {
        "fade-up": `fade-up 700ms ${suave} backwards`,
        "fade-in": "fade-in 260ms ease-out both",
        "fade-out": "fade-out 240ms ease-in both",
        "sheet-in": `sheet-in 460ms ${gaveta} both`,
        "sheet-out": "sheet-out 240ms cubic-bezier(0.4, 0, 1, 1) both",
        "modal-in": `modal-in 320ms ${suave} both`,
        "modal-out": "modal-out 200ms ease-in both",
        pop: `pop 480ms ${suave} both`,
        draw: `draw 520ms ${suave} both`,
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
