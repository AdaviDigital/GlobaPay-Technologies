/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0C1220',
        surface: '#141B2E',
        'surface-2': '#1B2540',
        border: '#242F4A',
        ink: '#F2F4F8',
        muted: '#8891A8',
        gold: {
          DEFAULT: '#E7A93D',
          soft: '#F2C876',
          dim: '#3A2E17',
        },
        teal: {
          DEFAULT: '#29D9C4',
          dim: '#0F332F',
        },
        danger: '#F1636B',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        ticker: 'ticker 32s linear infinite',
      },
    },
  },
  plugins: [],
};
