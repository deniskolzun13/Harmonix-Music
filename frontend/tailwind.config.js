/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0b0e',
        surface: '#14161d',
        'surface-light': '#1e222d',
        'surface-hover': '#2a2f3e',
        primary: '#3b82f6',
        'primary-hover': '#2563eb',
        accent: '#10b981',
        'yandex': '#fc3f1d',
        'vk': '#0077ff',
        'spotify': '#1ed760',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
