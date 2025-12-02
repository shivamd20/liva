export default {
  darkMode: ['class'],
  content: [
    './ui/index.html',
    './ui/**/*.{js,ts,jsx,tsx}',
    '!./ui/node_modules/**',
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {},
    },
  },
  plugins: [require('tailwindcss-animate')],
}
