import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90',
  secondary: 'border border-line bg-surface-2 text-ink-1 hover:bg-surface-3',
  ghost: 'text-ink-2 hover:bg-surface-3 hover:text-ink-1',
  danger: 'bg-danger/10 text-danger hover:bg-danger/15',
}

const SIZE: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-caption',
  md: 'h-8 px-3 text-body-sm',
  lg: 'h-9 px-4 text-body',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

/** 主按钮：高度 28/32/36，四态由令牌统一，不再各处手写 hover/disabled */
export function Button({ variant = 'secondary', size = 'md', className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-control font-medium transition-colors duration-fast disabled:pointer-events-none disabled:opacity-40 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 必填：图标按钮没有文字，必须有可读名称 */
  label: string
}

/** 图标按钮：32×32 命中区，需要提示时外层套 Tooltip，不用原生 title */
export function IconButton({ label, className = '', children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-ink-2 transition-colors duration-fast hover:bg-surface-3 hover:text-ink-1 disabled:pointer-events-none disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
