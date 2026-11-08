import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom'
}

/** 提示气泡：延迟 400ms，深色玻璃，替掉全项目的原生 title */
export function Tooltip({ label, children, side = 'top' }: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const timerRef = useRef(0)

  const clear = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = 0
    setPosition(null)
  }

  const show = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      setPosition({
        left: rect.left + rect.width / 2,
        top: side === 'top' ? rect.top - 8 : rect.bottom + 8,
      })
    }, 400)
  }

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
  }, [])

  useEffect(() => {
    if (!position) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clear()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [position])

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex"
        onMouseEnter={show}
        onMouseLeave={clear}
        onFocus={show}
        onBlur={clear}
      >
        {children}
      </span>
      {position && createPortal(
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[10000] max-w-[240px] -translate-x-1/2 whitespace-pre-line rounded-chip bg-[#11131a] px-2 py-1 text-caption leading-relaxed text-white shadow-e2"
          style={{
            left: position.left,
            top: position.top,
            transform: `translate(-50%, ${side === 'top' ? '-100%' : '0'})`,
          }}
        >
          {label}
        </div>,
        document.body,
      )}
    </>
  )
}
