import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        severity: {
          trace: "#94a3b8",
          debug: "#64748b",
          info: "#3b82f6",
          warn: "#f59e0b",
          error: "#ef4444",
          fatal: "#b91c1c",
          unspecified: "#cbd5e1",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
