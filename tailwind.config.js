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
        brand: {
          ink: '#082D36',
          'ink-deep': '#04191F',
          'ink-soft': '#0F3C48',
          'ink-muted': '#40606B',
          lime: '#E7FFA4',
          'lime-strong': '#D4F34C',
          cloud: '#F6F7F9',
          line: '#E2E6E9',
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
      fontFamily: {
        sans: ['Sora', 'System'],
      },
      borderRadius: {
        lg: '16px',
        md: '12px',
        sm: '8px',
      },
    },
  },
  plugins: [],
};
