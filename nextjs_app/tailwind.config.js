/** @type {import('tailwindcss').Config} */
module.exports = {
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
      },
    },
  },
  safelist: [
    {
      pattern: /bg-(orange|red|cyan)-[0-9]+/,
    },
    {
      pattern: /border-(orange|red|blue)-[0-9]+/
    },
    {
      pattern: /text-(orange|red|blue|cyan)-[0-9]+/
    }
  ],
  plugins: [],
};
