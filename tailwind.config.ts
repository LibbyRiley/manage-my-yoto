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
        yoto: {
          blue: "#00b4d8",
          purple: "#7b2d8e",
          green: "#2dc653",
          orange: "#ff6b35",
          pink: "#ff69b4",
        },
      },
    },
  },
  plugins: [],
};

export default config;
