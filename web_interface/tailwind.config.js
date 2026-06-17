/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "#080C18",
        sidebar: "#0C1122",
        card: "#111827",
        border: "#1E2A40",
        primary: "var(--color-primary)",
        secondary: "#10B981",
        accent: "#06B6D4",
        warning: "#F59E0B",
        danger: "#EF4444",
        muted: "#64748B",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
