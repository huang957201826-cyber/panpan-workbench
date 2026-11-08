import { memo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BookmarkPlus, Copy, Download, ImagePlus, Info, MoreHorizontal, RefreshCw, RotateCcw, Trash2, Wand2,
} from 'lucide-react'
import type { TaskRecord } from '../types'
import { editOutputs, removeTask, reuseConfig, retryTask, useStore } from '../store'
import { ensureImageCached, ensureImageThumbnailCached, subscribeImageThumbnail } from '../lib/imageCache'
import { resizeNodeFromCorner } from '../lib/canvasNodes'
import { downloadImage } from '../lib/downloadImage'
import { skillParamsFromTask } from '../lib/promptSkills'
import { useSkillStore } from '../lib/skillStore'
import { Menu, MenuItem, Tooltip } from '../ui'

export const CANVAS_NODE_WIDTH = 360
export const CANVAS_NODE_HEIGHT = 280

/** 节点右上角图标按钮：尺寸、底色、圆角与九宫格卡片操作条保持一致 */
const NODE_ACTION_CLASS = 'flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg bg-black/80 text-white shadow-sm backdrop-blur-md transition hover:bg-black disabled:opacity-40'

interface Props {
  task: TaskRecord
  x: number
  y: number
  width: number
  height: number
  scale: number
  selected: boolean
  compact: boolean
  spaceDown?: boolean
  /** 共享计时：仅 CanvasBoard 每秒更新一次 */
  now?: number
  onSelect: (id: string, additive?: boolean) => void
  onOpen: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
  onResize: (id: string, rect: { x: number; y: number; width: number; height: number }) => void
}

function statusLabel(task: TaskRecord) {
  if (task.status === 'running') return '生成中'
  if (task.status === 'error') return '失败'
  return ''
}

function CanvasTaskNode({ task, x, y, width, height, scale, selected, compact, spaceDown = false, now = Date.now(), onSelect, onOpen, onMove, onResize }: Props) {
  const imageId = task.outputImages[0] ?? task.inputImageIds[0] ?? ''
  const [thumb, setThumb] = useState('')
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [resized, setResized] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [downloadMenu, setDownloadMenu] = useState(false)
  const [moreMenu, setMoreMenu] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const prevStatusRef = useRef(task.status)
  const downloadAnchorRef = useRef<HTMLButtonElement>(null)
  const moreAnchorRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; dx: number; dy: number; moved: boolean } | null>(null)
  const resizeRef = useRef<{ corner: 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; x: number; y: number; width: number; height: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (prevStatusRef.current === 'running' && task.status === 'done') {
      setRevealing(true)
      const timer = window.setTimeout(() => setRevealing(false), 420)
      prevStatusRef.current = task.status
      return () => window.clearTimeout(timer)
    }
    prevStatusRef.current = task.status
  }, [task.status])

  const saveImage = async (index: number) => {
    const id = task.outputImages[index]
    if (!id || downloading) return
    setDownloading(true)
    setDownloadMenu(false)
    try {
      const ok = await downloadImage(id, task.prompt, task.outputImages.length > 1 ? index : undefined)
      if (!ok) useStore.getState().showToast('图片读取失败，下载未开始', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const elapsed = task.status === 'running'
    ? Math.max(0, Math.floor((now - (task.startedAt ?? task.createdAt)) / 1000))
    : Math.max(0, Math.floor(((task.finishedAt ?? task.startedAt ?? task.createdAt) - (task.startedAt ?? task.createdAt)) / 1000))
  const timer = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('blur', close)
    }
  }, [contextMenu])

  const setAsReference = async () => {
    const imageId = task.outputImages[0] ?? task.inputImageIds[0]
    if (!imageId) {
      useStore.getState().showToast('这条任务还没有可用的图片', 'error')
      return
    }
    if (useStore.getState().inputImages.some((image) => image.id === imageId)) {
      useStore.getState().showToast('该图片已在参考图中', 'info')
      return
    }
    const dataUrl = await ensureImageCached(imageId)
    if (!dataUrl) {
      useStore.getState().showToast('图片读取失败', 'error')
      return
    }
    useStore.getState().addInputImage({ id: imageId, dataUrl })
    useStore.getState().showToast('已加入参考图', 'success')
  }

  const deleteTask = () => {
    useStore.getState().setConfirmDialog({
      title: '删除任务',
      message: `将删除整条任务及其 ${task.outputImages.length} 张输出图，删除后无法恢复。`,
      confirmText: '删除任务',
      cancelText: '取消',
      tone: 'danger',
      action: () => { void removeTask(task) },
    })
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(task.prompt)
      useStore.getState().showToast('提示词已复制', 'success')
    } catch {
      useStore.getState().showToast('复制失败', 'error')
    }
  }

  /** 右键菜单与“更多”菜单共用同一份动作，避免两处能力不一致 */
  const actions = [
    { label: '复用参数', icon: <RotateCcw className="h-3 w-3 stroke-[1.6]" />, run: () => { void reuseConfig(task) } },
    { label: '保存为技能', icon: <BookmarkPlus className="h-3 w-3 stroke-[1.6]" />, run: () => useSkillStore.getState().openNewSkill({
      title: task.prompt.trim().split(/\r?\n/)[0]?.slice(0, 40),
      prompt: task.prompt,
      params: skillParamsFromTask(task),
      sourceTaskId: task.id,
    }) },
    { label: '设为参考图', icon: <ImagePlus className="h-3 w-3 stroke-[1.6]" />, run: () => { void setAsReference() } },
    { label: '复制提示词', icon: <Copy className="h-3 w-3 stroke-[1.6]" />, run: () => { void copyPrompt() } },
    { label: '编辑输出图', icon: <Wand2 className="h-3 w-3 stroke-[1.6]" />, run: () => { void editOutputs(task) } },
    { label: '重新生成', icon: <RefreshCw className="h-3 w-3 stroke-[1.6]" />, run: () => { void retryTask(task) } },
    { label: '详情', icon: <Info className="h-3 w-3 stroke-[1.6]" />, run: () => onOpen(task.id) },
    { label: '删除', icon: <Trash2 className="h-3 w-3 stroke-[1.6]" />, run: deleteTask, danger: true },
  ]

  useEffect(() => {
    if (!imageId) {
      setThumb('')
      return
    }
    let alive = true
    void ensureImageThumbnailCached(imageId).then((thumbnail) => {
      if (alive && thumbnail) setThumb(thumbnail.src)
    }).catch(() => {})
    const unsubscribe = subscribeImageThumbnail(imageId, (thumbnail) => {
      if (alive) setThumb(thumbnail.src)
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [imageId])

  const stop = (event: React.SyntheticEvent) => {
    event.stopPropagation()
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button === 1 || spaceDown) return
    if (event.button !== 0) return
    stop(event)
    dragRef.current = { startX: event.clientX, startY: event.clientY, dx: 0, dy: 0, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    stop(event)
    drag.dx = event.clientX - drag.startX
    drag.dy = event.clientY - drag.startY
    if (Math.abs(drag.dx) + Math.abs(drag.dy) > 4) drag.moved = true
    // 节点在 scale(k) 的世界容器里，offset 必须换算回世界坐标，否则拖动过程与落点不一致
    setOffset({ x: drag.dx / scale, y: drag.dy / scale })
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    stop(event)
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    setOffset({ x: 0, y: 0 })
    if (!drag.moved) {
      onSelect(task.id, event.shiftKey || event.ctrlKey || event.metaKey)
      return
    }
    onMove(task.id, x + drag.dx / scale, y + drag.dy / scale)
  }

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    stop(event)
    onSelect(task.id)
    setContextMenu({ x: event.clientX, y: event.clientY })
  }

  const handleResizeDown = (corner: 'nw' | 'ne' | 'sw' | 'se') => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()
    resizeRef.current = {
      corner,
      startX: event.clientX,
      startY: event.clientY,
      x,
      y,
      width: resized?.width ?? width,
      height: resized?.height ?? height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current
    if (!resize) return
    event.stopPropagation()
    setResized(resizeNodeFromCorner(resize, resize.corner, event.clientX - resize.startX, scale))
  }

  const handleResizeUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current
    if (!resize) return
    event.stopPropagation()
    resizeRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    const next = resized ?? { x: resize.x, y: resize.y, width: resize.width, height: resize.height }
    setResized(null)
    onResize(task.id, next)
  }

  const label = statusLabel(task)
  const title = task.prompt.trim() || '未命名任务'

  if (compact) {
    return (
      <div
        data-canvas-node
        className={`group absolute select-none overflow-hidden rounded-lg border bg-white dark:bg-[#161822] ${selected ? 'border-transparent ring-2 ring-brand' : 'border-black/10 dark:border-white/10'}`}
        style={{
          left: resized?.x ?? x,
          top: resized?.y ?? y,
          width,
          height,
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          cursor: 'default',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={() => onOpen(task.id)}
        onContextMenu={handleContextMenu}
      >
        {thumb ? (
          <img src={thumb} alt="" draggable={false} className="h-full w-full object-contain" />
        ) : (
          <div className={`flex h-full items-center justify-center text-body-sm ${task.status === 'error' ? 'bg-red-500/20 text-red-500' : 'text-gray-500'}`}>
            {task.status === 'running' ? '生成中' : task.status === 'error' ? '失败' : '无图'}
          </div>
        )}
        {label && (
          <span className={`absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-caption text-white ${task.status === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}>
            {label}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      data-canvas-node
      className={`group absolute select-none overflow-visible rounded-xl border bg-white dark:bg-[#161822] shadow-lg ${selected ? 'z-30 border-transparent ring-2 ring-brand' : 'border-black/10 dark:border-white/10'}`}
      style={{
        left: resized?.x ?? x,
        top: resized?.y ?? y,
        width: resized?.width ?? width,
        height: resized?.height ?? height,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        cursor: 'default',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={() => onOpen(task.id)}
      onContextMenu={handleContextMenu}
    >
      <div className="relative h-full w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-black/40">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            draggable={false}
            className={`h-full w-full object-contain transition-all duration-500 ${task.status === 'running' || revealing ? 'scale-105 opacity-80 blur-md' : 'scale-100 opacity-100 blur-0'}`}
          />
        ) : (
          <div className={`h-full w-full ${task.status === 'running' ? 'animate-pulse bg-gradient-to-br from-slate-200 via-slate-100 to-blue-100 dark:from-slate-800 dark:via-slate-900 dark:to-blue-950' : 'flex items-center justify-center text-body text-gray-500'}`}>
            {task.status === 'running' ? '' : '暂无图片'}
          </div>
        )}

        {task.status === 'running' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/20 backdrop-blur-[2px] dark:bg-black/20">
            <span className="rounded-full bg-blue-500/90 px-2 py-0.5 text-caption font-medium text-white shadow-[0_0_18px_rgba(59,130,246,0.65)]">生成中</span>
            <span className="rounded-full bg-black/55 px-2 py-0.5 font-mono text-caption text-white">{timer}</span>
          </div>
        )}

        {task.status === 'error' && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-red-600/35 text-white"
            onDoubleClick={(event) => { event.stopPropagation(); onOpen(task.id) }}
          >
            <button
              type="button"
              onPointerDown={stop}
              onClick={(event) => { event.stopPropagation(); void retryTask(task) }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600/85 text-4xl leading-none shadow-[0_0_28px_rgba(239,68,68,0.55)] transition hover:scale-105"
              title="重试"
              aria-label="重试"
            >
              ×
            </button>
            <div className="mt-2 max-w-[85%] text-center text-caption leading-snug opacity-0 transition-opacity group-hover:opacity-100">
              <p className="line-clamp-2 rounded bg-black/45 px-2 py-1">{task.error || '生成失败'}</p>
              <button
                type="button"
                onPointerDown={stop}
                onClick={(event) => {
                  event.stopPropagation()
                  void navigator.clipboard.writeText(task.error || '生成失败')
                  useStore.getState().showToast('错误信息已复制', 'success')
                }}
                className="mt-1 rounded bg-white/15 px-1.5 py-0.5 text-caption hover:bg-white/25"
              >
                复制错误
              </button>
            </div>
          </div>
        )}

        <div className="absolute left-2 top-2 flex items-center gap-1">
          <span className="rounded-md bg-white/85 px-1.5 py-0.5 text-caption font-medium text-slate-700 shadow-sm backdrop-blur dark:bg-black/55 dark:text-slate-200">成品</span>
          {task.outputImages.length > 1 && <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-caption text-white backdrop-blur">{task.outputImages.length} 张</span>}
          {task.status === 'running' && <span className="rounded-md bg-blue-500/90 px-1.5 py-0.5 text-caption text-white">{timer}</span>}
        </div>

        {/* 操作图标组：与九宫格右上角同一套尺寸与底色，悬停或选中时出现 */}
        <div className={`absolute right-2 top-2 flex items-center gap-1 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} onPointerDown={stop}>
          <Tooltip label="设为参考图">
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); void setAsReference() }}
              onDoubleClick={(event) => event.stopPropagation()}
              className={NODE_ACTION_CLASS}
              aria-label="设为参考图"
            >
              <ImagePlus className="h-3 w-3 stroke-[1.5]" />
            </button>
          </Tooltip>
          <Tooltip label="复用参数">
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); void reuseConfig(task) }}
              onDoubleClick={(event) => event.stopPropagation()}
              className={NODE_ACTION_CLASS}
              aria-label="复用参数"
            >
              <RotateCcw className="h-3 w-3 stroke-[1.5]" />
            </button>
          </Tooltip>
          {task.outputImages.length > 0 && (
            <Tooltip label={task.outputImages.length > 1 ? '下载（可选第几张）' : '下载原图'}>
              <button
                ref={downloadAnchorRef}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  if (task.outputImages.length > 1) setDownloadMenu((value) => !value)
                  else void saveImage(0)
                }}
                onDoubleClick={(event) => event.stopPropagation()}
                disabled={downloading}
                className={NODE_ACTION_CLASS}
                aria-label="下载原图"
              >
                {downloading ? <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" /> : <Download className="h-3 w-3 stroke-[1.5]" />}
              </button>
            </Tooltip>
          )}
          <Tooltip label="更多">
            <button
              ref={moreAnchorRef}
              type="button"
              onClick={(event) => { event.stopPropagation(); setMoreMenu((value) => !value) }}
              onDoubleClick={(event) => event.stopPropagation()}
              className={NODE_ACTION_CLASS}
              aria-label="更多操作"
            >
              <MoreHorizontal className="h-3 w-3 stroke-[1.5]" />
            </button>
          </Tooltip>
        </div>

        <Menu open={downloadMenu} anchorRef={downloadAnchorRef} width={112} onClose={() => setDownloadMenu(false)}>
          {task.outputImages.map((_, index) => (
            <MenuItem key={index} onClick={() => void saveImage(index)}>第 {index + 1} 张</MenuItem>
          ))}
        </Menu>

        <Menu open={moreMenu} anchorRef={moreAnchorRef} width={176} onClose={() => setMoreMenu(false)}>
          {actions.map((action) => (
            <MenuItem
              key={action.label}
              icon={action.icon}
              danger={action.danger}
              onClick={() => { setMoreMenu(false); action.run() }}
            >
              {action.label}
            </MenuItem>
          ))}
        </Menu>
      </div>

      {/* 选中时在底部显示一行提示词，替代原来的悬浮半透明卡片与原生 tooltip */}
      {selected && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 rounded-b-lg bg-white/90 px-2 py-1 backdrop-blur-md dark:bg-black/75">
          <span className="min-w-0 flex-1 truncate text-body-sm text-slate-700 dark:text-slate-200">{title}</span>
          <span className="shrink-0 font-mono text-caption text-slate-500 dark:text-slate-400">{task.params.size}</span>
        </div>
      )}

      {selected && (['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
        <div
          key={corner}
          data-canvas-resize
          onPointerDown={handleResizeDown(corner)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          onPointerCancel={handleResizeUp}
          className={`absolute h-3 w-3 rounded-full border-2 border-brand bg-white shadow-e1 dark:bg-[#161822] ${
            corner === 'nw' ? '-left-1.5 -top-1.5 cursor-nwse-resize'
              : corner === 'ne' ? '-right-1.5 -top-1.5 cursor-nesw-resize'
                : corner === 'sw' ? '-bottom-1.5 -left-1.5 cursor-nesw-resize'
                  : '-bottom-1.5 -right-1.5 cursor-nwse-resize'
          }`}
          title="等比缩放节点"
        />
      ))}
      {contextMenu && createPortal(
        <div
          className="fixed z-[9999] w-40 rounded-lg border border-black/10 bg-white/98 p-1 text-body-sm shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#1a1d28]/98"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 170),
            top: Math.min(contextMenu.y, window.innerHeight - 220),
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                setContextMenu(null)
                action.run()
              }}
              className={`w-full rounded-md px-2 py-1.5 text-left hover:bg-black/[0.06] dark:hover:bg-white/[0.1] ${action.danger ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}
            >
              {action.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

export default memo(CanvasTaskNode)
