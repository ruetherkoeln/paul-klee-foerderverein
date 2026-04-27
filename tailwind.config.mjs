/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0e1424',
          800: '#141a2e',
          700: '#1a2138'
        },
        gold: {
          400: '#f5c042',
          500: '#e8af2a',
          600: '#c89010'
        },
        brick: {
          600: '#a14237',
          700: '#8a3329'
        },
        cream: {
          50: '#faf6ef',
          100: '#f5efe2'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif']
      },
      maxWidth: {
        content: '1200px'
      }
    }
  },
  plugins: []
};
