import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { isTopmostOverlay, trapTabKey } from './overlay'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** 内容区最大宽度，默认 720 */
  width?: number
}

/** 模态：圆角 16、e3；Esc 与点遮罩关闭，打开时锁滚动 */
export function Modal({ open, title, onClose, children, footer, width = 720 }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    const onKeyDown = (event: KeyboardEvent) => {
      // 只由最上层弹层消费 Esc；栈顶可能是它内部再打开的 Menu
      if (event.key === 'Escape' && isTopmostOverlay(dialogRef.current)) {
        event.preventDefault()
        onClose()
        restoreFocusRef.current?.focus?.()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const raf = requestAnimationFrame(() => dialogRef.current?.focus())
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (trapTabKey(event.nativeEvent, dialogRef.current)) event.preventDefault()
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[4px]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        data-overlay
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        className="flex max-h-[80vh] w-full flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-e3"
        style={{ maxWidth: width }}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-4">
          <span className="min-w-0 flex-1 truncate text-title text-ink-1">{title}</span>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-ink-3 transition-colors duration-fast hover:bg-surface-3 hover:text-ink-1"
          >
            <X size={14} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
