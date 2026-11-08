import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './node_modules/streamdown/dist/*.js'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        gray: colors.zinc,
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar) / <alpha-value>)',
          foreground: 'hsl(var(--sidebar-foreground) / <alpha-value>)',
        },
        // 设计系统令牌（docs/execution/DESIGN-SYSTEM-SPEC.md）：新组件只用这些，不写任意值
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        ink: {
          1: 'var(--text-1)',
          2: 'var(--text-2)',
          3: 'var(--text-3)',
        },
        line: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          soft: 'var(--brand-soft)',
        },
        danger: 'var(--danger)',
        success: 'var(--success)',
        warn: 'var(--warn)',
      },
      fontFamily: {
        sans: ['var(--font-ui-sans)'],
        mono: ['var(--font-mono)'],
      },
      // 6 档字号，值全部来自 index.css 的 --type-* 变量；禁止再出现 8~13px 任意值
      fontSize: {
        micro: ['var(--type-micro)', { lineHeight: '1.2' }],
        caption: ['var(--type-caption)', { lineHeight: '1.4' }],
        'body-sm': ['var(--type-body-sm)', { lineHeight: '1.5' }],
        body: ['var(--type-body)', { lineHeight: '1.55' }],
        title: ['var(--type-title)', { lineHeight: '1.4', fontWeight: '600' }],
        page: ['var(--type-page)', { lineHeight: '1.3', fontWeight: '600' }],
      },
      // 圆角四档
      borderRadius: {
        chip: 'var(--radius-chip)',
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
        panel: 'var(--radius-modal)',
      },
      // 阴影三层
      boxShadow: {
        e1: 'var(--e1)',
        e2: 'var(--e2)',
        e3: 'var(--e3)',
      },
      transitionDuration: {
        fast: 'var(--motion-fast)',
        base: 'var(--motion-base)',
        slow: 'var(--motion-slow)',
      },
    },
  },
  plugins: [],
}
