/**
 * 浮层栈：所有弹层（Modal / Menu）在根节点上标 data-overlay。
 * portal 一律 append 到 body，后打开的节点在 DOM 后面，也就是最上层。
 * Esc 只由栈顶消费，避免一次按键把叠着的两层一起关掉。
 */
export function isTopmostOverlay(element: HTMLElement | null | undefined): boolean {
  if (!element) return false
  const overlays = Array.from(document.querySelectorAll<HTMLElement>('[data-overlay]'))
  if (overlays.length === 0) return false
  return overlays[overlays.length - 1] === element
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Tab 焦点陷阱：把焦点约束在弹层内循环，返回是否接管了这次按键 */
export function trapTabKey(event: KeyboardEvent, container: HTMLElement | null): boolean {
  if (event.key !== 'Tab' || !container) return false
  // 不用 offsetParent 判断可见性：jsdom 里恒为 null，会让单测与真实行为不一致
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((item) => !item.hasAttribute('hidden') && !item.closest('[hidden]'))
  if (items.length === 0) {
    event.preventDefault()
    container.focus()
    return true
  }
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (event.shiftKey && (active === first || active === container || !container.contains(active))) {
    event.preventDefault()
    last.focus()
    return true
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
    return true
  }
  return false
}
