/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f7f6f4',
          100: '#ebe8e2',
          200: '#d4cfc4',
          300: '#b0a898',
          400: '#8a8070',
          500: '#6e6558',
          600: '#574f46',
          700: '#473f39',
          800: '#3b3530',
          900: '#332e2a',
          950: '#1c1917',
        },
        paper: '#f4f1eb',
        accent: '#c45c26',
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Outfit"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '4px 4px 0 0 #1c1917',
        lift: '6px 6px 0 0 #1c1917',
      },
    },
  },
  plugins: [],
};
