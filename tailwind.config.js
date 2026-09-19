/** @type {import('tailwindcss').Config} */
// Design tokens mirror the Zinevu dealer portal (app.veranduo's
// tailwind.config.mjs + globals.css) so the mobile app shares one visual
// language. Brand palette is fixed; the semantic tokens
// (background/foreground/primary/...) come from CSS variables in global.css and
// flip for dark mode via the `.dark` class (toggled through NativeWind's
// useColorScheme).
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // --- Fixed brand palette (from the Zinevu dealer portal) ---
        // zinevu.com's palette. `ink` is black since the brand move
        // (2026-09); the old navy lives on as `deep`, for dark surfaces only.
        brand: {
          ink: '#000000',
          deep: '#082D36',
          'deep-950': '#04191F',
          lime: '#E7FFA4',
          'lime-strong': '#C7EE5C',
          paper: '#F7F4ED',
          'paper-dim': '#EFEBE1',
          smoke: '#5B6566',
          line: '#D4D2CC',
        },
        // --- Semantic tokens (theme-aware via CSS vars) ---
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: 'hsl(var(--card) / <alpha-value>)',
        'card-foreground': 'hsl(var(--card-foreground) / <alpha-value>)',
        primary: 'hsl(var(--primary) / <alpha-value>)',
        'primary-foreground': 'hsl(var(--primary-foreground) / <alpha-value>)',
        secondary: 'hsl(var(--secondary) / <alpha-value>)',
        'secondary-foreground': 'hsl(var(--secondary-foreground) / <alpha-value>)',
        muted: 'hsl(var(--muted) / <alpha-value>)',
        'muted-foreground': 'hsl(var(--muted-foreground) / <alpha-value>)',
        accent: 'hsl(var(--accent) / <alpha-value>)',
        'accent-foreground': 'hsl(var(--accent-foreground) / <alpha-value>)',
        destructive: 'hsl(var(--destructive) / <alpha-value>)',
        'destructive-foreground': 'hsl(var(--destructive-foreground) / <alpha-value>)',
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
      },
      // DM Sans for text, Bricolage Grotesque for display — the site's pair.
      // The default Text patch (lib/fonts.ts) picks the face by weight and
      // size, so these classes are only needed to force one.
      fontFamily: {
        sans: ['DMSans', 'System'],
        display: ['Bricolage-Bold', 'DMSans', 'System'],
      },
      // The site's geometry: sm 12, md 18, lg 26.
      borderRadius: {
        lg: '26px',
        md: '18px',
        sm: '12px',
      },
    },
  },
  plugins: [],
};
