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
        'primary-blue': '#00A9FF',
        'accent-cyan': '#00F2EA',
        'background-dark': '#010409', // Darker background
        'background-light': '#0D1117', // Lighter panel background
        'border-color': 'rgba(137, 218, 255, 0.1)', // Subtle border color
        'text-primary': '#E6EDF3',
        'text-secondary': '#8B949E',
      },
      boxShadow: {
        'glow-blue': '0 0 20px 0 rgba(0, 169, 255, 0.5)',
        'glow-blue-light': '0 0 10px 0 rgba(0, 169, 255, 0.3)',
        'glow-cyan': '0 0 20px 0 rgba(0, 242, 234, 0.5)',
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.8s cubic-bezier(0.215, 0.610, 0.355, 1.000) forwards',
        'stagger': 'fade-in-up 0.8s cubic-bezier(0.215, 0.610, 0.355, 1.000) forwards',
        'nebula-pan': 'nebula-pan 200s linear infinite',
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: 0, transform: 'translateY(30px) scale(0.98)' },
          to: { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
        'nebula-pan': {
          '0%': { transform: 'translate(-50%, -50%) rotate(0deg)' },
          '100%': { transform: 'translate(-50%, -50%) rotate(360deg)' },
        }
      }
    },
  },
  plugins: [],
}
