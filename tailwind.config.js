
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      colors: {
        'brand-cyan': '#00f2ea',
        'brand-dark': '#0a0f18',
        'brand-dark-blue': '#101827',
        'brand-light-blue': '#1c2942',
      },
      boxShadow: {
        'glow-cyan': '0 0 15px 0 rgba(0, 242, 234, 0.5)',
        'glow-cyan-light': '0 0 8px 0 rgba(0, 242, 234, 0.3)',
      }
    },
  },
  plugins: [],
}
