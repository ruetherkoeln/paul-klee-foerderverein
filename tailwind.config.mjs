/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Aus dem Schullogo abgeleitete Markenfarben (Bögen + Schriftzug)
        pk: {
          blue:   '#3a78b8', // Spitze oben (Dach)
          green:  '#7fb83e', // Spitze unten
          yellow: '#e0a836', // linke Säule  (= gold-500)
          orange: '#d97b3a', // mittlere Säule
          red:    '#b13830', // rechte Säule + Unterstrich  (= brick-600)
          ink:    '#1c1c1c'  // Schriftzug
        },
        // Funktionale Aliase (für bestehende Komponenten)
        navy: {
          900: '#0e1424',
          800: '#141a2e',
          700: '#1a2138'
        },
        gold: {
          400: '#f5c042',
          500: '#e0a836', // an Logo-Gelb angeglichen
          600: '#c89010'
        },
        brick: {
          600: '#b13830', // an Logo-Rot angeglichen
          700: '#8a3329'
        },
        cream: {
          50: '#faf6ef',
          100: '#f5efe2'
        }
      },
      fontFamily: {
        // Klar, ohne Serifen — Montserrat durchgehend
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'sans-serif']
      },
      maxWidth: {
        content: '1200px'
      }
    }
  },
  plugins: []
};
