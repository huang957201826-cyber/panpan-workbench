import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import type { ProjectCanvas } from '../../types'

interface CanvasCapsuleBarProps {
  canvases: ProjectCanvas[]
  activeCanvasId: string
  editingCanvasId: string | null
  onEditingChange: (canvasId: string | null) => void
  onSwitch: (canvasId: string) => void
  onCreate: () => void
  onRename: (canvasId: string, name: string) => void
  onDuplicate: (canvasId: string) => void
  onDelete: (canvasId: string) => void
}

/** 画布层胶囊：切换、新建、双击改名、右键菜单与溢出滚动都在这里，侧栏不再承载画布树 */
export function CanvasCapsuleBar({
  canvases,
  activeCanvasId,
  editingCanvasId,
  onEditingChange,
  onSwitch,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
}: CanvasCapsuleBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelRenameRef = useRef(false)
  const [editingName, setEditingName] = useState('')
  const [overflow, setOverflow] = useState({ left: false, right: false })
  const [menu, setMenu] = useState<{ x: number; y: number; canvasId: string } | null>(null)

  const updateOverflow = () => {
    const el = scrollRef.current
    if (!el) return
    setOverflow({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    })
  }

  const scrollActiveIntoView = () => {
    const el = scrollRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  useEffect(() => {
    updateOverflow()
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      updateOverflow()
      scrollActiveIntoView()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [canvases.length])

  useEffect(() => {
    if (!editingCanvasId) return
    const canvas = canvases.find((item) => item.id === editingCanvasId)
    if (!canvas) return
    setEditingName(canvas.name)
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [editingCanvasId])

  useEffect(() => {
    scrollActiveIntoView()
    updateOverflow()
  }, [activeCanvasId, canvases.length])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('blur', close)
    }
  }, [menu])

  const startRename = (canvas: ProjectCanvas) => {
    cancelRenameRef.current = false
    setEditingName(canvas.name)
    onEditingChange(canvas.id)
    setMenu(null)
  }

  const commitRename = (canvas: ProjectCanvas) => {
    const name = editingName.trim()
    if (name && name !== canvas.name) onRename(canvas.id, name)
    onEditingChange(null)
  }

  const scrollBy = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <div className="pointer-events-none absolute left-0 right-0 top-3 z-20 flex justify-center">
      <div data-canvas-capsule className="pointer-events-auto relative flex h-9 max-w-[64%] items-center rounded-full border border-black/[0.04] bg-white/90 text-[11.5px] shadow-[0_10px_30px_-4px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#141620]/90">
        {overflow.left && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-full bg-gradient-to-r from-white/95 via-white/70 to-transparent dark:from-[#141620]/95 dark:via-[#141620]/70" />
            <button
              type="button"
              onClick={() => scrollBy(-160)}
              className="absolute left-0.5 z-10 flex h-7 w-6 items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              title="向左滚动画布"
              aria-label="向左滚动画布"
            >
              <ChevronLeft className="h-3.5 w-3.5 stroke-[2]" />
            </button>
          </>
        )}

        <div ref={scrollRef} onScroll={updateOverflow} className="flex h-full items-center gap-1 overflow-x-auto px-1.5 no-scrollbar">
          {canvases.map((canvas, index) => {
            const selected = canvas.id === activeCanvasId
            if (editingCanvasId === canvas.id) {
              return (
                <div key={canvas.id} className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-black px-2.5 dark:bg-white">
                  <span className="font-mono text-[10px] text-white/60 dark:text-black/60">{String(index + 1).padStart(2, '0')}</span>
                  <input
                    ref={inputRef}
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onBlur={() => {
                      if (cancelRenameRef.current) {
                        cancelRenameRef.current = false
                        onEditingChange(null)
                        return
                      }
                      commitRename(canvas)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitRename(canvas)
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        cancelRenameRef.current = true
                        onEditingChange(null)
                      }
                    }}
                    aria-label="画布名称"
                    className="w-[96px] border-none bg-transparent p-0 text-[11.5px] font-medium text-white outline-none dark:text-black"
                  />
                </div>
              )
            }
            return (
              <button
                key={canvas.id}
                type="button"
                data-canvas-id={canvas.id}
                data-active={selected ? 'true' : undefined}
                aria-current={selected ? 'page' : undefined}
                onClick={() => onSwitch(canvas.id)}
                onDoubleClick={() => startRename(canvas)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setMenu({ x: event.clientX, y: event.clientY, canvasId: canvas.id })
                }}
                className={`flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 font-medium transition ${
                  selected
                    ? 'bg-black text-white shadow-sm dark:bg-white dark:text-black'
                    : 'text-slate-500 hover:bg-black/[0.03] hover:text-slate-900 dark:hover:bg-white/[0.05] dark:hover:text-white'
                }`}
                title={canvas.name}
              >
                <span className="font-mono text-[10px] opacity-60">{String(index + 1).padStart(2, '0')}</span>
                <span className="max-w-[120px] truncate">{canvas.name}</span>
                {selected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#137333] dark:bg-[#81c995]" />}
              </button>
            )
          })}
          <button
            type="button"
            onClick={onCreate}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-black/[0.04] hover:text-slate-800 dark:hover:bg-white/[0.06] dark:hover:text-white"
            title="新建画布"
            aria-label="新建画布"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2]" />
          </button>
        </div>

        {overflow.right && (
          <>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-full bg-gradient-to-l from-white/95 via-white/70 to-transparent dark:from-[#141620]/95 dark:via-[#141620]/70" />
            <button
              type="button"
              onClick={() => scrollBy(160)}
              className="absolute right-0.5 z-10 flex h-7 w-6 items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              title="向右滚动画布"
              aria-label="向右滚动画布"
            >
              <ChevronRight className="h-3.5 w-3.5 stroke-[2]" />
            </button>
          </>
        )}
      </div>

      {menu && createPortal(
        <div
          className="fixed z-[9999] w-36 rounded-lg border border-black/10 bg-white/98 p-1 text-body-sm shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#1a1d28]/98"
          style={{ left: Math.min(menu.x, window.innerWidth - 154), top: Math.min(menu.y, window.innerHeight - 116) }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              const canvas = canvases.find((item) => item.id === menu.canvasId)
              if (canvas) startRename(canvas)
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
          >
            <Pencil className="h-3 w-3" /> 重命名
          </button>
          <button
            type="button"
            onClick={() => {
              onDuplicate(menu.canvasId)
              setMenu(null)
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
          >
            <Copy className="h-3 w-3" /> 复制
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete(menu.canvasId)
              setMenu(null)
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-red-500 hover:bg-red-500/10"
          >
            <Trash2 className="h-3 w-3" /> 删除
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}
