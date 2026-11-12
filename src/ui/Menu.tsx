import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react'
import { isTopmostOverlay } from './overlay'
import { createPortal } from 'react-dom'

export interface AnchorRect {
  left: number
  top: number
  bottom: number
  width: number
  height: number
}

export interface MenuPlacement {
  left: number
  top: number
  placement: 'top' | 'bottom'
  maxHeight: number
}

const MARGIN = 8
const GAP = 6
const MAX_HEIGHT = 320

/**
 * 键盘可操作项：既认显式 role="menuitem"，也认菜单里的原生 button。
 * 历史下拉多用裸 div/按钮拼装，没有 role，导致 ↑↓/Enter 完全无法激活；
 * 这里统一兜底，避免每处菜单都要改一遍 JSX。
 * querySelectorAll 对逗号分隔选择器天然去重，显式 role 与 button 同时命中也只算一项。
 */
const MENU_ITEM_SELECTOR = '[role="menuitem"]:not([disabled]), [role="menuitemradio"]:not([disabled]), button:not([disabled])'

/**
 * 浮层定位：默认向下展开，下方空间不足时翻到上方；左右贴边钳制，高度按可用空间收敛。
 * 抽成纯函数，便于单测覆盖"贴边/翻转/超长菜单"三种情况。
 */
export function computeMenuPosition(
  anchor: AnchorRect,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): MenuPlacement {
  const spaceBelow = viewport.height - anchor.bottom - GAP - MARGIN
  const spaceAbove = anchor.top - GAP - MARGIN
  const want = Math.min(size.height, MAX_HEIGHT)
  const placement: 'top' | 'bottom' = spaceBelow >= want || spaceBelow >= spaceAbove ? 'bottom' : 'top'
  const room = placement === 'bottom' ? spaceBelow : spaceAbove
  const maxHeight = Math.max(96, Math.min(want, room))
  const top = placement === 'bottom'
    ? anchor.bottom + GAP
    : Math.max(MARGIN, anchor.top - GAP - maxHeight)
  const left = Math.min(Math.max(MARGIN, anchor.left), Math.max(MARGIN, viewport.width - size.width - MARGIN))
  return { left, top, placement, maxHeight }
}

interface MenuProps {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  width?: number
  onClose: () => void
  children: ReactNode
}

/** 统一浮层菜单：portal + 翻转 + 内部滚动；替代原生 select 与各处手写的 absolute 菜单 */
export function Menu({ open, anchorRef, width = 180, onClose, children }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const [placement, setPlacement] = useState<MenuPlacement>({ left: 0, top: 0, placement: 'bottom', maxHeight: MAX_HEIGHT })

  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    if (!anchor) return

    const update = () => {
      const rect = anchor.getBoundingClientRect()
      const height = ref.current?.offsetHeight ?? MAX_HEIGHT
      setPlacement(computeMenuPosition(
        { left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
        { width, height },
        { width: window.innerWidth, height: window.innerHeight },
      ))
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef, width])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (ref.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // 叠层时只有栈顶消费 Esc，焦点归还给触发菜单的按钮
      if (event.key === 'Escape' && isTopmostOverlay(ref.current)) {
        event.preventDefault()
        onClose()
        restoreFocusRef.current?.focus?.()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose, anchorRef])

  // 打开后把焦点移进菜单；优先落在当前选中项，否则第一项
  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    const raf = requestAnimationFrame(() => {
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? [])
      ;(items.find((item) => item.dataset.active === 'true') ?? items[0])?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [open])

  const menuItems = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? [])

  /** WAI-ARIA menu 键盘模型：方向键移动、Home/End 跳首尾、Enter/Space 激活、Tab 退出 */
  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      onClose()
      return
    }
    const items = menuItems()
    if (items.length === 0) return
    const current = items.indexOf(document.activeElement as HTMLElement)
    let next: number | null = null
    switch (event.key) {
      case 'ArrowDown': next = current < 0 ? 0 : (current + 1) % items.length; break
      case 'ArrowUp': next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length; break
      case 'Home': next = 0; break
      case 'End': next = items.length - 1; break
      case 'Enter':
      case ' ':
        if (current >= 0) {
          event.preventDefault()
          items[current].click()
        }
        return
      default: return
    }
    if (next !== null) {
      event.preventDefault()
      items[next].focus()
    }
  }

  if (!open) return null

  return createPortal(
    <div
      ref={ref}
      role="menu"
      data-overlay
      onKeyDown={onMenuKeyDown}
      className="fixed z-[9999] flex flex-col gap-0.5 overflow-y-auto rounded-control border border-line bg-surface p-1 text-body-sm shadow-e2"
      style={{ left: placement.left, top: placement.top, width, maxHeight: placement.maxHeight }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}

interface MenuItemProps {
  children: ReactNode
  active?: boolean
  icon?: ReactNode
  hint?: ReactNode
  danger?: boolean
  onClick?: () => void
}

/** 菜单项：高 28、圆角 8；选中用品牌浅底，危险项用 danger 色 */
export function MenuItem({ children, active = false, icon, hint, danger = false, onClick }: MenuItemProps) {
  const tone = danger
    ? 'text-danger hover:bg-danger/10'
    : active
      ? 'bg-brand-soft text-brand'
      : 'text-ink-1 hover:bg-surface-3'
  return (
    <button
      type="button"
      role="menuitem"
      data-active={active ? 'true' : undefined}
      tabIndex={-1}
      onClick={onClick}
      className={`flex h-7 w-full items-center gap-2 rounded-control px-2 text-left text-body-sm transition-colors duration-fast ${tone}`}
    >
      {icon && <span className="flex w-4 shrink-0 items-center justify-center">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 font-mono text-caption text-ink-3">{hint}</span>}
    </button>
  )
}
