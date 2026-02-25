/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        olive: {
          50:  '#f5f2e8',
          100: '#ebe8d4',
          200: '#d4d0a8',
          300: '#a8b46a',
          400: '#8fa050',
          500: '#6b7c3f',
          600: '#556630',
          700: '#4a5a2a',
          800: '#3a4a1a',
          900: '#2a3510',
          950: '#1a2008',
        },
      },
    },
  },
  plugins: [],
}
