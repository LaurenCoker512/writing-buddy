import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F6EFE2",
        surface: "#FBF5EA",
        "surface-2": "#F1E8D6",
        paper: "#FBF5EA",
        border: "#E3D6BD",
        "border-soft": "#ECE0C9",
        "text-primary": "#221E1A",
        "text-soft": "#4B4339",
        "text-muted": "#9A8E7E",
        "text-muted-2": "#C5B8A3",
        accent: {
          DEFAULT: "#B86A47",
          soft: "#E9C9B7",
          deep: "#964F2F",
          hover: "#964F2F",
        },
        "accent-ai": {
          DEFAULT: "#7B9D7E",
          soft: "#DDE9DC",
          deep: "#557959",
          light: "#DDE9DC",
        },
        gold: "#C99B5E",
        danger: "#B0573E",
      },
      fontFamily: {
        heading: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        hand: ["var(--font-hand)", "cursive"],
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
