import { useEffect, useMemo, useRef, useState } from 'react'
import { createInputImageFromFile, removeMultipleTasks, useStore, updateTaskCanvas, withInputPending } from '../store'
import type { CanvasImageNode, TaskRecord } from '../types'
import { useVisibleTasks } from '../hooks/usePrivacyMode'
import { useCanvasViewStore } from '../lib/canvasViewStore'
import { autoLayoutCanvasNodes, getTaskNodeSize, nodeIdsInRect } from '../lib/canvasNodes'
import { fitNodesViewport, nodeInView, screenToWorld, zoomAtPoint } from '../lib/canvasMath'
import { isUiModalOpen } from '../lib/uiLayers'
import { ensureImageCached } from '../lib/imageCache'
import { downloadImage } from '../lib/downloadImage'
import { useWorkspaceStore } from '../lib/workspaceStore'
import { addCanvasImageNode, createCanvasImageNode, fitCanvasImageNodeSize, removeCanvasImageNodes } from '../lib/canvasImageNodes'
import { pruneTaskSelection } from '../lib/taskSelection'
import CanvasTaskNode from './CanvasTaskNode'
import { InteractiveDotGrid } from './InteractiveDotGrid'

const AUTO_GAP = 48
const MAX_RENDER = 500
const EMPTY_NODES: CanvasImageNode[] = []

export default function CanvasBoard({ tasks: providedTasks, allTaskCount, canvasId = '', selectionCommand, onSelectionChange, pickMode = false, onPickImage, onCancelPick }: { tasks?: TaskRecord[]; allTaskCount?: number; canvasId?: string; selectionCommand?: { type: 'all' | 'clear'; nonce: number } | null; onSelectionChange?: (taskIds: string[]) => void; pickMode?: boolean; onPickImage?: (imageId: string) => void; onCancelPick?: () => void } = {}) {
  const visibleTasks = useVisibleTasks()
  const tasks = providedTasks ?? visibleTasks
  const setDetailTaskId = useStore((s) => s.setDetailTaskId)
  const inputImages = useStore((s) => s.inputImages)
  const viewport = useCanvasViewStore((s) => s.viewport)
  const setViewport = useCanvasViewStore((s) => s.setViewport)
  const size = useCanvasViewStore((s) => s.size)
  const setSize = useCanvasViewStore((s) => s.setSize)
  const bottomInset = useCanvasViewStore((s) => s.bottomInset)
  const setBottomInset = useCanvasViewStore((s) => s.setBottomInset)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set())
  const imageNodes = useWorkspaceStore((s) => s.canvases.find((canvas) => canvas.id === canvasId)?.imageNodes ?? EMPTY_NODES)
  const updateCanvas = useWorkspaceStore((s) => s.updateCanvas)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [imagePreview, setImagePreview] = useState<Record<string, CanvasImageNode>>({})
  const imagePreviewRef = useRef<Record<string, CanvasImageNode>>({})
  const [imageDrag, setImageDrag] = useState<{ id: string; mode: 'move' | 'resize'; startX: number; startY: number; origin: CanvasImageNode } | null>(null)
  const [imageMenu, setImageMenu] = useState<{ x: number; y: number; node: CanvasImageNode } | null>(null)
  const imageNodesRef = useRef(imageNodes)
  imageNodesRef.current = imageNodes
  const [box, setBox] = useState<{ startX: number; startY: number; x: number; y: number } | null>(null)
  const [spaceDown, setSpaceDown] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [showPerf, setShowPerf] = useState(import.meta.env.DEV)
  const [fps, setFps] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const rootRef = useRef<HTMLDivElement>(null)
  const placeholderCanvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef(viewport)
  const panRef = useRef<{ startX: number; startY: number; base: typeof viewport } | null>(null)
  const userInteractedRef = useRef(false)
  const didFitRef = useRef(false)
  viewportRef.current = viewport

  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => a.createdAt - b.createdAt), [tasks])
  const hasRunningTasks = useMemo(() => tasks.some((task) => task.status === 'running'), [tasks])
  useEffect(() => {
    if (!hasRunningTasks) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [hasRunningTasks])
  const nodes = useMemo(() => {
    const sized = sortedTasks.map((task) => ({ task, ...getTaskNodeSize(task) }))
    const imageSizes = imageNodes.map((node) => ({ width: node.w, height: node.h }))
    const auto = autoLayoutCanvasNodes([...imageSizes, ...sized.map(({ width, height }) => ({ width, height }))], AUTO_GAP)
    return sized.map((node, index) => ({
      task: node.task,
      x: node.task.canvas?.x ?? auto[imageSizes.length + index]?.x ?? 0,
      y: node.task.canvas?.y ?? auto[imageSizes.length + index]?.y ?? 0,
      width: node.width,
      height: node.height,
    }))
  }, [sortedTasks, imageNodes])

  const nodeRects = useMemo(() => nodes.map((node) => ({
    id: node.task.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  })), [nodes])

  useEffect(() => {
    setSelectedIds((previous) => {
      const next = pruneTaskSelection(previous, nodeRects)
      if (next.size === previous.size) return previous
      return next
    })
  }, [nodeRects])

  const allRects = useMemo(() => [
    ...nodeRects,
    ...imageNodes.map((node) => ({ id: `image:${node.id}`, x: node.x, y: node.y, width: node.w, height: node.h })),
  ], [nodeRects, imageNodes])

  const pickTaskImage = (task: TaskRecord) => {
    const imageId = task.outputImages[0]
    if (!imageId) return false
    onPickImage?.(imageId)
    return true
  }

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) setSize({ width: rect.width, height: rect.height })
    }
    const observer = new ResizeObserver(update)
    observer.observe(el)
    window.addEventListener('resize', update)
    update()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [setSize])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setShowPerf((value) => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    didFitRef.current = false
    userInteractedRef.current = false
    setSelectedIds(new Set())
    setSelectedImageIds(new Set())
    setImageMenu(null)
    setBox(null)
  }, [canvasId])

  useEffect(() => {
    let cancelled = false
    for (const node of imageNodes) {
      if (imageUrls[node.imageId]) continue
      void ensureImageCached(node.imageId).then((url) => {
        if (!url || cancelled) return
        setImageUrls((previous) => previous[node.imageId] ? previous : { ...previous, [node.imageId]: url })
      })
    }
    return () => { cancelled = true }
  }, [imageNodes, imageUrls])

  useEffect(() => {
    if (!imageDrag) return
    const read = (event: PointerEvent) => {
      const node = imageDrag.origin
      const dx = (event.clientX - imageDrag.startX) / Math.max(0.05, viewportRef.current.k)
      const dy = (event.clientY - imageDrag.startY) / Math.max(0.05, viewportRef.current.k)
      const next = imageDrag.mode === 'move'
        ? { ...node, x: node.x + dx, y: node.y + dy }
        : { ...node, w: Math.max(48, node.w + dx), h: Math.max(48, node.h + dy) }
      imagePreviewRef.current = { ...imagePreviewRef.current, [node.id]: next }
      setImagePreview(imagePreviewRef.current)
    }
    const finish = () => {
      const preview = imagePreviewRef.current[imageDrag.id]
      imagePreviewRef.current = {}
      setImagePreview({})
      setImageDrag(null)
      if (!preview || !canvasId) return
      updateCanvas(canvasId, {
        imageNodes: imageNodesRef.current.map((node) => node.id === preview.id ? preview : node),
      })
    }
    window.addEventListener('pointermove', read)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      window.removeEventListener('pointermove', read)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [imageDrag, canvasId, updateCanvas])

  const currentImageNodes = () => useWorkspaceStore.getState().canvases.find((item) => item.id === canvasId)?.imageNodes ?? []

  const setNodes = (next: CanvasImageNode[]) => {
    if (!canvasId) return
    updateCanvas(canvasId, { imageNodes: next })
  }

  const removeImageNodesByIds = (ids: string[]) => {
    if (!canvasId) return
    const canvas = useWorkspaceStore.getState().canvases.find((item) => item.id === canvasId)
    if (!canvas) return
    const removedNodes = (canvas.imageNodes ?? []).filter((node) => ids.includes(node.id))
    const removedImageIds = [...new Set([...(canvas.removedImageIds ?? []), ...removedNodes.map((node) => node.imageId)])]
    updateCanvas(canvasId, {
      imageNodes: removeCanvasImageNodes(canvas.imageNodes ?? [], ids),
      removedImageIds,
    })
  }

  const clearRemovedImageId = (imageId: string) => {
    if (!canvasId) return
    const canvas = useWorkspaceStore.getState().canvases.find((item) => item.id === canvasId)
    if (!canvas?.removedImageIds?.includes(imageId)) return
    updateCanvas(canvasId, { removedImageIds: canvas.removedImageIds.filter((id) => id !== imageId) })
  }

  const addImageNode = async (image: { id: string; dataUrl: string }, world: { x: number; y: number }) => {
    const existing = imageNodesRef.current.find((node) => node.imageId === image.id)
    if (existing) {
      clearRemovedImageId(image.id)
      setSelectedImageIds(new Set([existing.id]))
      userInteractedRef.current = true
      const k = Math.max(0.5, Math.min(1, viewportRef.current.k))
      setViewport({
        k,
        x: size.width / 2 - (existing.x + existing.w / 2) * k,
        y: Math.max(1, size.height - bottomInset) / 2 - (existing.y + existing.h / 2) * k,
      })
      return
    }
    const nodeSize = await new Promise<{ width: number; height: number }>((resolve) => {
      const probe = new Image()
      probe.onload = () => resolve(fitCanvasImageNodeSize(probe.naturalWidth, probe.naturalHeight))
      probe.onerror = () => resolve(fitCanvasImageNodeSize(0, 0))
      probe.src = image.dataUrl
    })
    const node = createCanvasImageNode(image.id, world.x, world.y, nodeSize.width, nodeSize.height)
    setNodes(addCanvasImageNode(currentImageNodes(), node))
    clearRemovedImageId(image.id)
    setSelectedImageIds(new Set([node.id]))
  }

  const addImageToInput = async (imageId: string) => {
    if (useStore.getState().inputImages.some((image) => image.id === imageId)) return
    const dataUrl = await ensureImageCached(imageId)
    if (!dataUrl) {
      useStore.getState().showToast('读取图片失败，未能加入参考图。', 'error')
      return
    }
    useStore.getState().addInputImage({ id: imageId, dataUrl })
  }

  useEffect(() => {
    onSelectionChange?.([...selectedIds])
  }, [selectedIds, onSelectionChange])

  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isUiModalOpen()) return
      if (event.code === 'Space' && !isEditable(event.target)) {
        event.preventDefault()
        setSpaceDown(true)
      }
      if (isEditable(event.target)) return
      if (event.key === 'Escape' && pickMode) {
        event.preventDefault()
        onCancelPick?.()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key === '0') {
        event.preventDefault()
        userInteractedRef.current = true
        const fit = fitNodesViewport(allRects, { width: size.width, height: Math.max(1, size.height - bottomInset) })
        if (fit) setViewport(fit)
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setSelectedIds(new Set(nodeRects.map((node) => node.id)))
      }
      if (event.key === 'Delete' && (selectedIds.size || selectedImageIds.size)) {
        event.preventDefault()
        const taskIds = [...selectedIds]
        const imageNodeIds = [...selectedImageIds]
        useStore.getState().setConfirmDialog({
          title: '删除所选内容',
          message: `将删除 ${taskIds.length} 个任务及其输出图${imageNodeIds.length ? `，以及 ${imageNodeIds.length} 个画布素材` : ''}，删除后无法恢复。`,
          confirmText: '删除',
          cancelText: '取消',
          tone: 'danger',
          action: () => {
            if (imageNodeIds.length) removeImageNodesByIds(imageNodeIds)
            if (taskIds.length) void removeMultipleTasks(taskIds)
            setSelectedIds(new Set())
            setSelectedImageIds(new Set())
          },
        })
      }
      if (event.key === 'Escape') {
        setSelectedIds(new Set())
        setSelectedImageIds(new Set())
        setImageMenu(null)
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpaceDown(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [nodeRects, allRects, selectedIds, selectedImageIds, size.width, size.height, bottomInset, setViewport, pickMode, onCancelPick])

  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('[data-input-bar]')
    const read = () => {
      const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--input-bar-clearance'))
      setBottomInset(Number.isFinite(value) ? value : 0)
    }
    read()
    if (!bar) return
    const observer = new ResizeObserver(read)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [setBottomInset])

  useEffect(() => {
    if (didFitRef.current || userInteractedRef.current || size.width <= 0 || nodeRects.length === 0) return
    const fit = fitNodesViewport(allRects, { width: size.width, height: Math.max(1, size.height - bottomInset) })
    if (fit) {
      didFitRef.current = true
      setViewport(fit)
    }
  }, [size, bottomInset, allRects, setViewport, canvasId])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      userInteractedRef.current = true
      const rect = el.getBoundingClientRect()
      const factor = Math.exp(-event.deltaY * 0.0015)
      setViewport(zoomAtPoint(viewportRef.current, event.clientX - rect.left, event.clientY - rect.top, factor))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [setViewport])

  const visibleNodes = useMemo(() => {
    if (viewport.k < 0.15) return nodes
    const world = {
      x: -viewport.x / viewport.k,
      y: -viewport.y / viewport.k,
      width: size.width / viewport.k,
      height: size.height / viewport.k,
    }
    const overscan = 300
    const visible = nodeRects
      .map((rect, index) => ({ rect, node: nodes[index] }))
      .filter(({ rect }) => nodeInView(rect, {
        x: world.x - overscan,
        y: world.y - overscan,
        width: world.width + overscan * 2,
        height: world.height + overscan * 2,
      }))
    return visible.map(({ node }) => node)
  }, [nodeRects, nodes, size, viewport])

  const lowZoom = viewport.k < 0.15
  const realNodeLimit = lowZoom ? 0 : MAX_RENDER
  const renderedNodes = lowZoom ? [] : visibleNodes.slice(0, realNodeLimit)
  const placeholderNodes = lowZoom ? [] : visibleNodes.slice(realNodeLimit)
  const placeholderCount = lowZoom ? nodes.length : placeholderNodes.length

  const placeholderElements = useMemo(() => placeholderNodes.map(({ task, x, y, width, height }) => (
    <div
      key={`placeholder-${task.id}`}
      className="absolute cursor-pointer rounded-lg border border-black/10 bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.08]"
      style={{ left: x, top: y, width, height }}
      title={task.prompt.trim() || '任务'}
      onPointerDown={(event) => {
        event.stopPropagation()
        if (pickMode && pickTaskImage(task)) return
        setSelectedIds(new Set([task.id]))
        userInteractedRef.current = true
        const k = Math.max(0.5, Math.min(1, viewport.k))
        setViewport({
          k,
          x: size.width / 2 - (x + width / 2) * k,
          y: Math.max(1, size.height - bottomInset) / 2 - (y + height / 2) * k,
        })
      }}
    />
  )), [placeholderNodes, bottomInset, setViewport, size.height, size.width, viewport, pickMode])

  // 低倍全览用单张 canvas 画占位块，避免每帧重排数千个 DOM 节点
  useEffect(() => {
    if (!lowZoom) return
    const canvas = placeholderCanvasRef.current
    if (!canvas || size.width <= 0 || size.height <= 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.round(size.width))
    const height = Math.max(1, Math.round(size.height))
    const backingWidth = Math.round(width * dpr)
    const backingHeight = Math.round(height * dpr)
    if (canvas.width !== backingWidth) canvas.width = backingWidth
    if (canvas.height !== backingHeight) canvas.height = backingHeight
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const dark = document.documentElement.classList.contains('dark')
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)'
    for (const node of nodes) {
      const x = node.x * viewport.k + viewport.x
      const y = node.y * viewport.k + viewport.y
      const w = Math.max(1, node.width * viewport.k)
      const h = Math.max(1, node.height * viewport.k)
      if (x + w < 0 || y + h < 0 || x > width || y > height) continue
      ctx.fillRect(x, y, w, h)
    }
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.14)'
    for (const node of imageNodesRef.current) {
      const x = node.x * viewport.k + viewport.x
      const y = node.y * viewport.k + viewport.y
      const w = Math.max(1, node.w * viewport.k)
      const h = Math.max(1, node.h * viewport.k)
      if (x + w < 0 || y + h < 0 || x > width || y > height) continue
      ctx.fillRect(x, y, w, h)
    }
  }, [lowZoom, nodes, viewport, size])

  const compact = viewport.k < 0.35

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduceMotion(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!showPerf) return
    let frames = 0
    let last = performance.now()
    let raf = 0
    const tick = (time: number) => {
      frames += 1
      if (time - last >= 1000) {
        setFps(Math.round(frames * 1000 / (time - last)))
        frames = 0
        last = time
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [showPerf])

  useEffect(() => {
    if (!selectionCommand) return
    setSelectedIds(selectionCommand.type === 'all' ? new Set(nodeRects.map((node) => node.id)) : new Set())
    setSelectedImageIds(new Set())
  }, [selectionCommand])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return
    const panWithPointer = event.button === 1 || spaceDown
    if (!panWithPointer && (event.target as HTMLElement).closest('[data-canvas-node],[data-canvas-image-node]')) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!panWithPointer) {
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      setBox({ startX: x, startY: y, x, y })
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    panRef.current = { startX: event.clientX, startY: event.clientY, base: viewport }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (box) {
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      setBox({ ...box, x: event.clientX - rect.left, y: event.clientY - rect.top })
      return
    }
    const pan = panRef.current
    if (!pan) return
    userInteractedRef.current = true
    setViewport({ ...pan.base, x: pan.base.x + event.clientX - pan.startX, y: pan.base.y + event.clientY - pan.startY })
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (box) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      const rect = event.currentTarget.getBoundingClientRect()
      const moved = Math.abs(box.x - box.startX) + Math.abs(box.y - box.startY) > 4
      if (!moved) {
        setSelectedIds(new Set())
        setBox(null)
        return
      }
      const start = screenToWorld(box.startX + rect.left, box.startY + rect.top, rect, viewport)
      const end = screenToWorld(box.x + rect.left, box.y + rect.top, rect, viewport)
      const world = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }
      const hits = nodeIdsInRect(nodeRects, world)
      const imageHits = imageNodesRef.current
        .filter((node) => node.x < world.x + world.width && node.x + node.w > world.x && node.y < world.y + world.height && node.y + node.h > world.y)
        .map((node) => node.id)
      setSelectedIds((previous) => {
        if (!(event.shiftKey || event.ctrlKey || event.metaKey)) return new Set(hits)
        const next = new Set(previous)
        for (const id of hits) next.add(id)
        return next
      })
      setSelectedImageIds((previous) => {
        if (!(event.shiftKey || event.ctrlKey || event.metaKey)) return new Set(imageHits)
        const next = new Set(previous)
        for (const id of imageHits) next.add(id)
        return next
      })
      setBox(null)
      return
    }
    if (!panRef.current) return
    panRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const focusNode = (node: { x: number; y: number; width: number; height: number }) => {
    userInteractedRef.current = true
    const k = Math.max(0.5, Math.min(1, viewport.k))
    setViewport({
      k,
      x: size.width / 2 - (node.x + node.width / 2) * k,
      y: Math.max(1, size.height - bottomInset) / 2 - (node.y + node.height / 2) * k,
    })
  }

  const zoomAroundCenter = (factor: number) => {
    userInteractedRef.current = true
    setViewport(zoomAtPoint(viewport, size.width / 2, Math.max(1, size.height - bottomInset) / 2, factor))
  }

  const fitAll = () => {
    userInteractedRef.current = true
    const fit = fitNodesViewport(allRects, { width: size.width, height: Math.max(1, size.height - bottomInset) })
    if (fit) setViewport(fit)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files') && !event.dataTransfer.types.includes('application/x-studio-image')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const world = screenToWorld(event.clientX, event.clientY, rect, viewport)
    const raw = event.dataTransfer.getData('application/x-studio-image')
    if (raw) {
      try {
        await withInputPending(async () => {
          const payload = JSON.parse(raw) as { imageId?: string }
          if (!payload.imageId) return
          await addImageToInput(payload.imageId)
          const dataUrl = useStore.getState().inputImages.find((image) => image.id === payload.imageId)?.dataUrl
          if (dataUrl) await addImageNode({ id: payload.imageId, dataUrl }, world)
          else {
            const cached = await ensureImageCached(payload.imageId)
            if (cached) await addImageNode({ id: payload.imageId, dataUrl: cached }, world)
          }
        })
      } catch {
        // 忽略非本应用的拖拽数据
      } finally {
        window.dispatchEvent(new Event('studio-drag-reset'))
      }
      return
    }
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'))
    if (!files.length) {
      window.dispatchEvent(new Event('studio-drag-reset'))
      return
    }
    // 串行处理，避免多张大图同时解码/哈希把主线程卡死
    let offset = 0
    let failed = 0
    try {
      await withInputPending(async () => {
        for (const file of files) {
          try {
            const image = await createInputImageFromFile(file)
            if (!image) {
              failed += 1
              continue
            }
            useStore.getState().addInputImage(image)
            await addImageNode(image, { x: world.x + offset, y: world.y + offset })
            offset += 24
          } catch (err) {
            console.error('拖入图片失败', err)
            failed += 1
          }
        }
      })
    } finally {
      window.dispatchEvent(new Event('studio-drag-reset'))
    }
    if (failed) {
      useStore.getState().showToast(`有 ${failed} 张图片未能加入，请检查格式或大小。`, 'error')
    }
  }

  return (
    <div
      ref={rootRef}
      data-canvas-root
      className={`relative h-full w-full overflow-hidden bg-[#fbfcfd] dark:bg-[#0c0e14] ${spaceDown ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {reduceMotion ? (
        <div
          data-canvas-grid
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(120,120,120,0.28) 1px, transparent 1px)',
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            backgroundSize: `${Math.max(16, 24 * viewport.k)}px ${Math.max(16, 24 * viewport.k)}px`,
          }}
        />
      ) : (
        <InteractiveDotGrid pan={{ x: viewport.x, y: viewport.y }} spacing={Math.max(16, 24 * viewport.k)} />
      )}
      {lowZoom && (
        <canvas
          ref={placeholderCanvasRef}
          className="absolute inset-0 h-full w-full"
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const point = screenToWorld(event.clientX, event.clientY, rect, viewport)
            const hit = nodes.find((node) =>
              point.x >= node.x && point.x <= node.x + node.width && point.y >= node.y && point.y <= node.y + node.height)
            if (!hit) return
            event.stopPropagation()
            if (pickMode && pickTaskImage(hit.task)) return
            setSelectedIds(new Set([hit.task.id]))
            focusNode(hit)
          }}
        />
      )}
      {!lowZoom && (
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.k})` }}
        >
          {imageNodes.map((node) => {
            const view = imagePreview[node.id] ?? node
            const url = imageUrls[node.imageId]
            const selected = selectedImageIds.has(node.id)
            const refIndex = inputImages.findIndex((image) => image.id === node.imageId)
            const nodeLabel = refIndex >= 0 ? `图${refIndex + 1}` : '素材'
            return (
              <div
                key={node.id}
                data-canvas-image-node
                className={`group absolute select-none overflow-visible rounded-lg border bg-white dark:bg-[#161822] ${selected ? 'z-20 border-black/30 ring-2 ring-black dark:border-white/40 dark:ring-white' : 'border-black/10 dark:border-white/10'}`}
                style={{ left: view.x, top: view.y, width: view.w, height: view.h }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return
                  event.stopPropagation()
                  setSelectedImageIds(new Set([node.id]))
                  setSelectedIds(new Set())
                  setImageMenu(null)
                  setImageDrag({ id: node.id, mode: 'move', startX: event.clientX, startY: event.clientY, origin: node })
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation()
                  void onPickImage?.(node.imageId)
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setSelectedImageIds(new Set([node.id]))
                  setImageMenu({ x: event.clientX, y: event.clientY, node })
                }}
              >
                {url ? (
                  <img
                    src={url}
                    alt=""
                    draggable={false}
                    className="h-full w-full rounded-lg bg-slate-100 object-contain pointer-events-none dark:bg-black/40"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-full w-full animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/[0.08]" />
                )}
                <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-caption text-white">
                  {nodeLabel}
                </span>
                <button
                  type="button"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-body-sm text-white opacity-0 transition group-hover:opacity-100"
                  title="下载原图"
                  aria-label="下载原图"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    void downloadImage(node.imageId, nodeLabel).then((ok) => {
                      if (!ok) useStore.getState().showToast('图片读取失败，下载未开始', 'error')
                    })
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="absolute -bottom-1 -right-1 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-white bg-black/70 opacity-0 transition group-hover:opacity-100"
                  title="缩放素材"
                  aria-label="缩放素材"
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    setImageDrag({ id: node.id, mode: 'resize', startX: event.clientX, startY: event.clientY, origin: node })
                  }}
                />
              </div>
            )
          })}
          {renderedNodes.map(({ task, x, y, width, height }) => (
            <CanvasTaskNode
              key={task.id}
              task={task}
              x={x}
              y={y}
              width={width}
              height={height}
              scale={viewport.k}
              selected={selectedIds.has(task.id)}
              compact={compact}
              spaceDown={spaceDown}
              now={now}
              onSelect={(id, additive) => {
                if (pickMode) {
                  const task = nodes.find((node) => node.task.id === id)?.task
                  if (task && pickTaskImage(task)) return
                }
                setSelectedIds((previous) => {
                  if (!additive) return new Set([id])
                  const next = new Set(previous)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }}
              onOpen={setDetailTaskId}
              onMove={(id, nextX, nextY) => {
                userInteractedRef.current = true
                const meta = task.canvas
                void updateTaskCanvas(id, meta?.userSized ? { ...meta, x: nextX, y: nextY } : { x: nextX, y: nextY })
              }}
              onResize={(id, rect) => { userInteractedRef.current = true; void updateTaskCanvas(id, { x: rect.x, y: rect.y, w: rect.width, h: rect.height, userSized: true }) }}
            />
          ))}
          {placeholderElements}
        </div>
      )}

      {tasks.length === 0 && imageNodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-body text-gray-500">
            {allTaskCount && allTaskCount > 0 ? '没有匹配任务' : '还没有内容，拖入图片或在左侧输入提示词开始生成'}
          </p>
        </div>
      )}

      {showPerf && (
        <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-md border border-black/10 bg-white/90 px-2 py-1 text-caption font-mono text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#161822]/90 dark:text-slate-200">
          FPS {fps} · 渲染 {renderedNodes.length} 节点 + {placeholderCount} 占位 · 总 {tasks.length} · {Math.round(viewport.k * 100)}%
        </div>
      )}

      {box && (
        <div
          className="pointer-events-none absolute border border-black/60 bg-black/5 dark:border-white/70 dark:bg-white/10"
          style={{
            left: Math.min(box.startX, box.x),
            top: Math.min(box.startY, box.y),
            width: Math.abs(box.x - box.startX),
            height: Math.abs(box.y - box.startY),
          }}
        />
      )}

      {imageMenu && (
        <div
          className="fixed z-50 min-w-[140px] overflow-hidden rounded-lg border border-black/10 bg-white py-1 text-body-sm shadow-xl dark:border-white/10 dark:bg-[#181b26]"
          style={{ left: imageMenu.x, top: imageMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center px-3 py-1.5 text-left hover:bg-black/[0.06] dark:hover:bg-white/[0.1]"
            onClick={() => {
              void onPickImage?.(imageMenu.node.imageId)
              setImageMenu(null)
            }}
          >
            设为参考图
          </button>
          <button
            type="button"
            className="flex w-full items-center px-3 py-1.5 text-left text-red-500 hover:bg-red-500/10"
            onClick={() => {
              removeImageNodesByIds([imageMenu.node.id])
              setSelectedImageIds(new Set())
              setImageMenu(null)
            }}
          >
            删除素材
          </button>
        </div>
      )}

      <div
        className="absolute right-4 z-10 flex items-center gap-1 rounded-full border border-black/10 bg-white/95 px-2 py-1 text-body-sm text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#161822]/95 dark:text-slate-300"
        style={{ bottom: bottomInset > 0 ? bottomInset + 4 : 16 }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {import.meta.env.DEV && (
          <button
            type="button"
            className={`h-8 rounded-full px-2 ${showPerf ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-black/[0.06] dark:hover:bg-white/[0.1]'}`}
            onClick={() => setShowPerf((value) => !value)}
            title="显示 FPS 与渲染节点数"
            aria-label="显示 FPS 与渲染节点数"
          >
            FPS
          </button>
        )}
        <span className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1]"
          onClick={() => zoomAroundCenter(0.8)}
          title="缩小"
          aria-label="缩小画布"
        >−</button>
        <span className="w-12 text-center tabular-nums">{Math.round(viewport.k * 100)}%</span>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1]"
          onClick={() => zoomAroundCenter(1.25)}
          title="放大"
          aria-label="放大画布"
        >+</button>
        <span className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
        <button
          type="button"
          className="flex h-8 items-center gap-1 rounded-full px-2 hover:bg-black/[0.06] dark:hover:bg-white/[0.1]"
          onClick={fitAll}
          title="适应全部 (Ctrl+0)"
          aria-label="适应全部 (Ctrl+0)"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
            <path d="M2 6V3a1 1 0 011-1h3M14 6V3a1 1 0 00-1-1h-3M2 10v3a1 1 0 001 1h3M14 10v3a1 1 0 01-1 1h-3" />
          </svg>
          <span className="text-caption">全览</span>
        </button>
      </div>
    </div>
  )
}
