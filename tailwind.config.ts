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
        background: "#FAF7F2",
        surface: "#FFF9F4",
        "text-primary": "#1C1A17",
        "text-muted": "#8C8580",
        accent: {
          DEFAULT: "#C4704A",
          hover: "#B05E38",
        },
        "accent-ai": {
          DEFAULT: "#7A9E7E",
          light: "#EAF2EB",
        },
      },
      fontFamily: {
        heading: ["var(--font-lora)", "Georgia", "serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
