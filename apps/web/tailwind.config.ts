import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        surface: 'hsl(var(--surface))',
        'surface-2': 'hsl(var(--surface-2))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        beacon: {
          DEFAULT: 'hsl(var(--beacon))',
          foreground: 'hsl(var(--beacon-foreground))',
          muted: 'hsl(var(--beacon-muted))',
        },
        cyan: {
          DEFAULT: 'hsl(var(--cyan))',
          foreground: 'hsl(var(--cyan-foreground))',
        },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        danger: 'hsl(var(--danger))',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      boxShadow: {
        glow: '0 0 40px -8px hsl(var(--beacon) / 0.45)',
        'glow-cyan': '0 0 40px -8px hsl(var(--cyan) / 0.4)',
        card: '0 1px 0 0 hsl(0 0% 100% / 0.04) inset, 0 8px 30px -12px hsl(0 0% 0% / 0.6)',
      },
      backgroundImage: {
        'grid-fade':
          'radial-gradient(circle at 50% 0%, hsl(var(--beacon) / 0.10), transparent 55%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 20px -6px hsl(var(--beacon) / 0.5)' },
          '50%': { opacity: '0.85', boxShadow: '0 0 34px -4px hsl(var(--beacon) / 0.8)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 2.2s linear infinite',
        'pulse-glow': 'pulse-glow 3.5s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
