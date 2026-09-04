/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0B2321', 900: '#0F3D3A', 800: '#154F4A', 700: '#1C635C' },
        sand: { 50: '#FAF8F4', 100: '#F4F0E8', 200: '#E9E2D3' },
        gold: { 400: '#C9A24B', 500: '#B4903D', 600: '#96762F' },
        clay: { 500: '#B5573F' }
      },
      fontFamily: {
        arabic: ['"IBM Plex Sans Arabic"', 'Tajawal', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
