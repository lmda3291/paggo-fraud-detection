import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        paggo: {
          accent:        '#9B4A1E',
          'accent-hover':'#7A3A16',
          'accent-light':'#C4622A',
          bg:            '#0A0A0A',
          'bg-card':     '#141414',
          'bg-elevated': '#1C1C1C',
          border:        '#2A2A2A',
        },
      },
    },
  },
  plugins: [],
};
export default config;
