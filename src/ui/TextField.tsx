import type { InputHTMLAttributes, ReactNode } from 'react'
import { X } from 'lucide-react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode
  /** 有值且传了 onClear 时显示清空按钮 */
  onClear?: () => void
  className?: string
}

/** 输入框：高 32、圆角 8、浅底；聚焦只加描边与焦点环，不改变尺寸 */
export function TextField({ icon, onClear, className = '', ...rest }: TextFieldProps) {
  const hasValue = Boolean(rest.value ?? rest.defaultValue)
  return (
    <div
      className={`flex h-8 items-center gap-1.5 rounded-control border border-line bg-surface-2 px-2 transition-colors duration-fast focus-within:border-line-strong ${className}`}
    >
      {icon && <span className="flex shrink-0 items-center text-ink-3">{icon}</span>}
      <input
        {...rest}
        className="min-w-0 flex-1 bg-transparent text-body-sm text-ink-1 outline-none placeholder:text-ink-3"
      />
      {onClear && hasValue && (
        <button
          type="button"
          aria-label="清空"
          onClick={onClear}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-chip text-ink-3 hover:bg-surface-3 hover:text-ink-1"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
