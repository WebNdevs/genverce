import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Genverce Design System
        background: '#0A0A0F',
        surface: '#0F0F1A',
        brand: {
          DEFAULT: '#4F46E5',
          hover: '#6366F1',
          light: '#818CF8',
        },
        accent: '#6366F1',
        border: '#1E1E3A',
        success: '#10B981',
        error: '#EF4444',
        text: {
          primary: '#F8FAFC',
          secondary: '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        hero: ['72px', { lineHeight: '1.1', fontWeight: '700' }],
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)',
        'gradient-glow': 'linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #818CF8 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0A0A0F 0%, #0F0F1A 100%)',
      },
      boxShadow: {
        glow: '0 0 20px rgba(99, 102, 241, 0.3)',
        'glow-lg': '0 0 40px rgba(99, 102, 241, 0.4)',
        'glow-brand': '0 0 30px rgba(79, 70, 229, 0.5)',
        card: '0 4px 20px rgba(0, 0, 0, 0.3)',
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
        'typing-dot': 'typing-dot 1.4s infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(99, 102, 241, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'typing-dot': {
          '0%, 60%, 100%': { opacity: '0.2', transform: 'scale(0.8)' },
          '30%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
