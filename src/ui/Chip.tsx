import type { ReactNode } from 'react'

interface ChipProps {
  active?: boolean
  className?: string
  children: ReactNode
  onClick?: () => void
}

/** 标签/分段控件：高 24、圆角 6；有 onClick 时渲染为按钮，否则为纯展示 */
export function Chip({ active = false, className = '', children, onClick }: ChipProps) {
  const base = `inline-flex h-6 shrink-0 items-center gap-1 rounded-chip px-2 text-caption transition-colors duration-fast ${
    active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-surface-2 text-ink-2'
  } ${className}`

  if (!onClick) return <span className={base}>{children}</span>

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${base} ${active ? '' : 'hover:bg-surface-3 hover:text-ink-1'}`}
    >
      {children}
    </button>
  )
}

interface SegmentedProps<T extends string> {
  value: T
  options: Array<{ value: T; label: ReactNode }>
  onChange: (value: T) => void
  className?: string
}

/** 分段 tab（技能库分类栏、视图切换共用）：选中实心，未选透明 */
export function Segmented<T extends string>({ value, options, onChange, className = '' }: SegmentedProps<T>) {
  return (
    <div className={`flex items-center gap-1 overflow-x-auto no-scrollbar ${className}`} role="tablist">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-control px-2.5 text-body-sm transition-colors duration-fast ${
              active
                ? 'bg-black font-medium text-white dark:bg-white dark:text-black'
                : 'text-ink-2 hover:bg-surface-3 hover:text-ink-1'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
