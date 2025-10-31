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
      },
      animation: {
        'pulse-slow': 'pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': {
            opacity: 1,
            boxShadow: '0 0 15px 0 rgba(0, 242, 234, 0.5)'
          },
          '50%': {
            opacity: 0.8,
            boxShadow: '0 0 25px 5px rgba(0, 242, 234, 0.5)'
          },
        }
      }
    },
  },
  plugins: [],
}