/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'Consolas', 'ui-monospace', 'monospace']
      },
      letterSpacing: {
        tightest: '-0.04em',
        ui: '0.01em',
        micro: '0.08em',
        section: '0.14em'
      },
      colors: {
        bg: {
          primary: '#0d1117',
          secondary: '#161b22',
          tertiary: '#21262d',
          elevated: '#2d333b'
        },
        border: {
          default: '#30363d',
          active: '#5c6e8d'
        },
        accent: {
          blue: '#8b9fc6',
          obsidian: '#202837',
          'obsidian-hover': '#2a364b',
          'obsidian-active': '#161d29',
          green: '#3fb950',
          red: '#f85149',
          yellow: '#d29922',
          purple: '#a371f7'
        }
      }
    }
  },
  plugins: []
}
