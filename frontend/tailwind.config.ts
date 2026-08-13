import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        pot: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          900: "#052e16"
        }
      },
      backgroundImage: {
        "pot-gradient": "linear-gradient(135deg, #16a34a 0%, #15803d 55%, #052e16 100%)",
        "pot-dark": "linear-gradient(135deg, #0f172a 0%, #052e16 100%)"
      },
      boxShadow: {
        card: "0 8px 24px -8px rgba(15, 23, 42, 0.12)",
        glow: "0 12px 32px -8px rgba(22, 163, 74, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
