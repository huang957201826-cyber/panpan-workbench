import { useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Menu, MenuItem } from './Menu'

interface SelectProps<T extends string> {
  value: T
  options: Array<{ value: T; label: ReactNode }>
  onChange: (value: T) => void
  /** 菜单宽度，默认 160 */
  width?: number
  placeholder?: string
  icon?: ReactNode
  className?: string
  /** 无障碍名称（触发按钮没有可见标签时需要） */
  label?: string
}

/** 下拉选择：自绘，替代原生 select，保证箭头、菜单、选中态与其它控件同源 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  width = 160,
  placeholder = '请选择',
  icon,
  className = '',
  label,
}: SelectProps<T>) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const current = options.find((option) => option.value === value)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-control border border-line bg-surface-2 px-2.5 text-body-sm text-ink-1 transition-colors duration-fast hover:bg-surface-3 ${className}`}
      >
        {icon && <span className="flex shrink-0 items-center text-ink-3">{icon}</span>}
        <span className="min-w-0 truncate">{current?.label ?? placeholder}</span>
        <ChevronDown size={14} className="shrink-0 text-ink-3" />
      </button>
      <Menu open={open} anchorRef={triggerRef} width={width} onClose={() => setOpen(false)}>
        {options.map((option) => (
          <MenuItem
            key={option.value}
            active={option.value === value}
            onClick={() => {
              onChange(option.value)
              setOpen(false)
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
