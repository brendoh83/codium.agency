/** @type {import('tailwindcss').Config} */
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
          600: "#A9705A",
          500: "#C08A74",
          100: "#F4E5DC",
        },
        ok: "#1F9D55",
        warn: "#D69E2E",
        danger: "#C0392B",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(19,41,74,0.06), 0 1px 3px 0 rgba(19,41,74,0.08)",
      },
    },
  },
  plugins: [],
};
