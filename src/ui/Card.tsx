import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  /** 可点时传 onClick，会自动加 hover 抬升与键盘可达 */
  onClick?: () => void
}

/** 卡片容器：圆角 12、1px 描边、e1；可点版本 hover 升 e2 */
export function Card({ children, className = '', onClick }: CardProps) {
  const base = `rounded-card border border-line bg-surface ${className}`
  if (!onClick) return <div className={base}>{children}</div>
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      className={`${base} cursor-pointer transition-shadow duration-fast hover:shadow-e2`}
    >
      {children}
    </div>
  )
}

interface PanelHeaderProps {
  title: ReactNode
  /** 标题右侧计数/徽章 */
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

/** 面板头：44px，左标题右操作，下边线；两视图共用同一高度，保证横向一条线 */
export function PanelHeader({ title, meta, actions, className = '' }: PanelHeaderProps) {
  return (
    <div className={`flex h-11 shrink-0 items-center gap-2 border-b border-line px-4 ${className}`}>
      <span className="min-w-0 truncate text-title text-ink-1">{title}</span>
      {meta}
      <span className="ml-auto flex shrink-0 items-center gap-1">{actions}</span>
    </div>
  )
}

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/** 空状态：图标 + 一句话 + 一个主行动，替代各处一行灰字 */
export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex h-full flex-col items-center justify-center gap-2 text-center ${className}`}>
      {icon && <span className="text-ink-3">{icon}</span>}
      <p className="text-title text-ink-1">{title}</p>
      {description && <p className="max-w-[320px] text-body-sm leading-relaxed text-ink-2">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
