/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Press Box palette. The `neutral` scale is deliberately remapped from
        // Tailwind's cool grays to a warm paper/ink scale so every existing
        // neutral-* utility in the app picks up the new tone at once.
        neutral: {
          50: '#FBFAF7',  // paper
          100: '#F5F3EE',
          200: '#E5E1DB', // hairline
          300: '#D6D1C8',
          400: '#A8A29B',
          500: '#78716C', // byline
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917', // ink
        },
        paper: '#FBFAF7',
        surface: '#FFFFFF',
        ink: '#1C1917',
        byline: '#78716C',
        hairline: '#E5E1DB',
        // Accent is team-driven at runtime via --accent (see index.css).
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-ink': 'var(--accent-ink)',
      },
      fontFamily: {
        sans: ['"Inter Tight Variable"', '"Inter Tight"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Inter Tight Variable"', '"Inter Tight"', 'system-ui', 'sans-serif'],
      },
      // Print corners, not pill corners. Every existing rounded-* utility
      // collapses toward the 4px Press Box radius; `full` stays for swatches.
      borderRadius: {
        none: '0px',
        sm: '2px',
        DEFAULT: '3px',
        md: '3px',
        lg: '4px',
        xl: '4px',
        '2xl': '5px',
        '3xl': '6px',
        full: '9999px',
      },
      // Structure comes from hairlines, not elevation. Card-weight shadows are
      // neutralized; only true overlays (dropdowns, modals) keep depth.
      boxShadow: {
        none: 'none',
        sm: 'none',
        DEFAULT: 'none',
        md: 'none',
        lg: '0 2px 6px rgba(28,25,23,0.06), 0 12px 28px -14px rgba(28,25,23,0.22)',
        xl: '0 4px 10px rgba(28,25,23,0.08), 0 24px 48px -20px rgba(28,25,23,0.28)',
        '2xl': '0 6px 14px rgba(28,25,23,0.10), 0 32px 64px -24px rgba(28,25,23,0.32)',
      },
    },
  },
  plugins: [],
};
