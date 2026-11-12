import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  Columns3,
  Grid2X2,
  Rows3,
  Undo2,
} from 'lucide-react'
import { createInputImageFromFile, useStore, updateTaskCanvas, withInputPending } from '../store'
import type { CanvasImageNode, TaskRecord } from '../types'
import { useVisibleTasks } from '../hooks/usePrivacyMode'
import { useCanvasViewStore } from '../lib/canvasViewStore'
import { autoLayoutCanvasNodes, getTaskNodeSize, nodeIdsInRect } from '../lib/canvasNodes'
import { fitNodesViewport, nodeInView, screenToWorld, zoomAtPoint } from '../lib/canvasMath'
import { isUiModalOpen } from '../lib/uiLayers'
import { ensureImageCached } from '../lib/imageCache'
import { downloadImage } from '../lib/downloadImage'
import { getDownloadErrorMessage } from '../lib/downloadImages'
import { useWorkspaceStore } from '../lib/workspaceStore'
import { addCanvasImageNode, createCanvasImageNode, fitCanvasImageNodeSize } from '../lib/canvasImageNodes'
import { assertCanvasUndoActive, createCanvasUndoEntry, getCanvasUndoDepth, isCanvasUndoing, pushCanvasUndo, runCanvasUndo, subscribeCanvasUndo } from '../lib/canvasUndo'
import { pruneTaskSelection } from '../lib/taskSelection'
import { deleteSelection } from '../lib/taskActions'
import { useCanvasSelectionStore } from '../lib/canvasSelectionStore'
import { clearAllSelection } from '../lib/selection'
import CanvasTaskNode from './CanvasTaskNode'
import { InteractiveDotGrid } from './InteractiveDotGrid'

const AUTO_GAP = 48
const MAX_RENDER = 500
const EMPTY_NODES: CanvasImageNode[] = []

interface PositionSnapshot {
  tasks: Record<string, { x: number; y: number; w?: number; h?: number; userSized?: boolean }>
  nodes: Record<string, { x: number; y: number; w?: number; h?: number }>
}

interface GroupDragState {
  startX: number
  startY: number
  dx: number
  dy: number
  moved: boolean
  tasks: Array<{ id: string; x: number; y: number; w?: number; h?: number; userSized?: boolean }>
  nodes: Array<{ id: string; x: number; y: number; w?: number; h?: number }>
}

export default function CanvasBoard({ tasks: providedTasks, allTaskCount, canvasId = '', pickMode = false, onPickImage, onCancelPick, rightInset = 0 }: { tasks?: TaskRecord[]; allTaskCount?: number; canvasId?: string; pickMode?: boolean; onPickImage?: (imageId: string) => void; onCancelPick?: () => void; rightInset?: number } = {}) {
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
  const selectedTaskIdsState = useStore((s) => s.selectedTaskIds)
  const setSelectedTaskIdsState = useStore((s) => s.setSelectedTaskIds)
  const selectedIds = useMemo(() => new Set(selectedTaskIdsState), [selectedTaskIdsState])
  const setSelectedIds = (updater: Set<string> | ((previous: Set<string>) => Set<string>)) => {
    setSelectedTaskIdsState((previous) => {
      const previousSet = new Set(previous)
      const next = typeof updater === 'function' ? updater(previousSet) : updater
      return next === previousSet ? previous : [...next]
    })
  }
  const selectedNodeIdsState = useCanvasSelectionStore((s) => s.selectedNodeIds)
  const setSelectedNodeIdsState = useCanvasSelectionStore((s) => s.setSelectedNodeIds)
  const selectedImageIds = useMemo(() => new Set(selectedNodeIdsState), [selectedNodeIdsState])
  const setSelectedImageIds = (updater: Set<string> | ((previous: Set<string>) => Set<string>)) => {
    setSelectedNodeIdsState((previous) => {
      const previousSet = new Set(previous)
      const next = typeof updater === 'function' ? updater(previousSet) : updater
      return next === previousSet ? previous : new Set(next)
    })
  }
  const selectionClearNonce = useCanvasSelectionStore((s) => s.selectionClearNonce)
  const imageNodes = useWorkspaceStore((s) => s.canvases.find((canvas) => canvas.id === canvasId)?.imageNodes ?? EMPTY_NODES)
  const updateCanvas = useWorkspaceStore((s) => s.updateCanvas)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [imagePreview, setImagePreview] = useState<Record<string, CanvasImageNode>>({})
  const imagePreviewRef = useRef<Record<string, CanvasImageNode>>({})
  const [imageDrag, setImageDrag] = useState<{ id: string; mode: 'move' | 'resize'; startX: number; startY: number; origin: CanvasImageNode } | null>(null)
  const [imageMenu, setImageMenu] = useState<{ x: number; y: number; node: CanvasImageNode } | null>(null)
  const [groupDrag, setGroupDrag] = useState<GroupDragState | null>(null)
  const groupDragRef = useRef<GroupDragState | null>(null)
  const undoDepth = useSyncExternalStore(
    (onStoreChange) => subscribeCanvasUndo(canvasId, onStoreChange),
    () => getCanvasUndoDepth(canvasId),
    () => 0,
  )
  const undoing = useSyncExternalStore(
    (onStoreChange) => subscribeCanvasUndo(canvasId, onStoreChange),
    () => isCanvasUndoing(canvasId),
    () => false,
  )
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
    setBox(null)
  }, [canvasId])

  useEffect(() => {
    setImageMenu(null)
  }, [selectionClearNonce])

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

  const capturePositions = (): PositionSnapshot => {
    const tasks: PositionSnapshot['tasks'] = {}
    for (const node of nodes) {
      if (!selectedIds.has(node.task.id)) continue
      tasks[node.task.id] = {
        x: node.x,
        y: node.y,
        w: node.width,
        h: node.height,
        userSized: node.task.canvas?.userSized,
      }
    }
    const imagePositions: PositionSnapshot['nodes'] = {}
    for (const node of imageNodesRef.current) {
      if (!selectedImageIds.has(node.id)) continue
      imagePositions[node.id] = { x: node.x, y: node.y, w: node.w, h: node.h }
    }
    return { tasks, nodes: imagePositions }
  }

  const pushPositionUndo = (snapshot: PositionSnapshot) => {
    if (!canvasId) return
    if (!Object.keys(snapshot.tasks).length && !Object.keys(snapshot.nodes).length) return
    pushCanvasUndo(canvasId, createCanvasUndoEntry('position', '移动、缩放或排列', ({ isActive }) => applyPositions(snapshot, isActive)))
  }

  const applyPositions = async (snapshot: PositionSnapshot, isActive: () => boolean) => {
    const results = await Promise.all(Object.entries(snapshot.tasks).map(([id, position]) => {
      const canvas = position.userSized && position.w != null && position.h != null
        ? { x: position.x, y: position.y, w: position.w, h: position.h, userSized: true }
        : { x: position.x, y: position.y }
      return updateTaskCanvas(id, canvas, { silent: true })
    }))
    if (results.some((saved) => !saved)) throw new Error('画布位置保存失败')
    assertCanvasUndoActive(isActive)
    if (!canvasId || !Object.keys(snapshot.nodes).length) return
    const canvas = useWorkspaceStore.getState().canvases.find((item) => item.id === canvasId)
    if (!canvas) return
    updateCanvas(canvasId, {
      imageNodes: (canvas.imageNodes ?? []).map((node) => {
        const position = snapshot.nodes[node.id]
        return position
          ? { ...node, x: position.x, y: position.y, w: position.w ?? node.w, h: position.h ?? node.h }
          : node
      }),
    })
  }

  const undoPositions = async () => {
    const result = await runCanvasUndo(
      canvasId,
      undefined,
      () => useWorkspaceStore.getState().canvases.some((canvas) => canvas.id === canvasId),
    )
    if (result.error) {
      useStore.getState().showToast(`撤销失败：${result.error}，已保留撤销记录`, 'error')
      return
    }
    if (result.entry?.kind === 'position') {
      useStore.getState().showToast(`已撤销${result.entry.label}`, 'success')
    }
  }

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
      const origin = imageDrag.origin
      const changed = preview.x !== origin.x || preview.y !== origin.y || preview.w !== origin.w || preview.h !== origin.h
      if (!changed) return
      pushPositionUndo({
        tasks: {},
        nodes: { [origin.id]: { x: origin.x, y: origin.y, w: origin.w, h: origin.h } },
      })
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
        setSelectedImageIds(new Set())
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
            void deleteSelection({ taskIds, nodeIds: imageNodeIds, canvasId })
            clearAllSelection()
          },
        })
      }
      if (event.key === 'Escape') {
        clearAllSelection()
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
        setSelectedImageIds(new Set())
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
      const running = node.task.status === 'running'
      ctx.filter = running ? 'blur(6px)' : 'none'
      ctx.globalAlpha = running ? 0.55 : 1
      ctx.fillRect(x, y, w, h)
    }
    ctx.filter = 'none'
    ctx.globalAlpha = 1
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

  const selectionCount = selectedIds.size + selectedImageIds.size

  const commitGroupDrag = (drag: GroupDragState) => {
    const before: PositionSnapshot = {
      tasks: Object.fromEntries(drag.tasks.map((task) => [task.id, {
        x: task.x,
        y: task.y,
        w: task.w,
        h: task.h,
        userSized: task.userSized,
      }])),
      nodes: Object.fromEntries(drag.nodes.map((node) => [node.id, {
        x: node.x,
        y: node.y,
        w: node.w,
        h: node.h,
      }])),
    }
    pushPositionUndo(before)
    for (const task of drag.tasks) {
      const next = task.userSized && task.w != null && task.h != null
        ? { x: task.x + drag.dx, y: task.y + drag.dy, w: task.w, h: task.h, userSized: true }
        : { x: task.x + drag.dx, y: task.y + drag.dy }
      void updateTaskCanvas(task.id, next)
    }
    if (canvasId && drag.nodes.length) {
      const canvas = useWorkspaceStore.getState().canvases.find((item) => item.id === canvasId)
      if (canvas) {
        const offsets = new Map(drag.nodes.map((node) => [node.id, node]))
        updateCanvas(canvasId, {
          imageNodes: (canvas.imageNodes ?? []).map((node) => {
            const origin = offsets.get(node.id)
            return origin ? { ...node, x: origin.x + drag.dx, y: origin.y + drag.dy } : node
          }),
        })
      }
    }
  }

  const alignSelection = (mode: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom' | 'space-x' | 'space-y' | 'row' | 'column' | 'grid') => {
    if (selectionCount < 2) return
    const items = [
      ...nodes.filter((node) => selectedIds.has(node.task.id)).map((node) => ({ kind: 'task' as const, id: node.task.id, x: node.x, y: node.y, w: node.width, h: node.height })),
      ...imageNodesRef.current.filter((node) => selectedImageIds.has(node.id)).map((node) => ({ kind: 'node' as const, id: node.id, x: node.x, y: node.y, w: node.w, h: node.h })),
    ]
    if (items.length < 2) return
    const before = capturePositions()
    const minX = Math.min(...items.map((item) => item.x))
    const maxRight = Math.max(...items.map((item) => item.x + item.w))
    const minY = Math.min(...items.map((item) => item.y))
    const maxBottom = Math.max(...items.map((item) => item.y + item.h))
    const updates = new Map<string, { x: number; y: number }>()
    if (mode === 'row' || mode === 'column' || mode === 'grid') {
      const gap = 24
      if (mode === 'grid') {
        const maxW = Math.max(...items.map((item) => item.w))
        const maxH = Math.max(...items.map((item) => item.h))
        const cols = Math.max(1, Math.ceil(Math.sqrt(items.length)))
        items.forEach((item, index) => {
          updates.set(`${item.kind}:${item.id}`, {
            x: minX + (index % cols) * (maxW + gap),
            y: minY + Math.floor(index / cols) * (maxH + gap),
          })
        })
      } else {
        const horizontal = mode === 'row'
        const sorted = [...items].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y)
        let cursor = horizontal ? minX : minY
        for (const item of sorted) {
          updates.set(`${item.kind}:${item.id}`, horizontal
            ? { x: cursor, y: minY }
            : { x: minX, y: cursor })
          cursor += (horizontal ? item.w : item.h) + gap
        }
      }
    } else if (mode === 'space-x' || mode === 'space-y') {
      const horizontal = mode === 'space-x'
      const sorted = [...items].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y)
      const start = horizontal ? minX : minY
      const end = horizontal ? maxRight : maxBottom
      const totalSize = sorted.reduce((sum, item) => sum + (horizontal ? item.w : item.h), 0)
      const gap = sorted.length > 1 ? (end - start - totalSize) / (sorted.length - 1) : 0
      let cursor = start
      for (const item of sorted) {
        updates.set(`${item.kind}:${item.id}`, horizontal ? { x: cursor, y: item.y } : { x: item.x, y: cursor })
        cursor += (horizontal ? item.w : item.h) + gap
      }
    } else {
      for (const item of items) {
        const x = mode === 'left' ? minX : mode === 'right' ? maxRight - item.w : (minX + maxRight) / 2 - item.w / 2
        const y = mode === 'top' ? minY : mode === 'bottom' ? maxBottom - item.h : (minY + maxBottom) / 2 - item.h / 2
        updates.set(`${item.kind}:${item.id}`, {
          x: mode === 'left' || mode === 'center-x' || mode === 'right' ? x : item.x,
          y: mode === 'top' || mode === 'center-y' || mode === 'bottom' ? y : item.y,
        })
      }
    }
    pushPositionUndo(before)
    for (const [key, position] of updates) {
      const [kind, id] = key.split(':')
      if (kind === 'task') void updateTaskCanvas(id, position)
    }
    if (canvasId) {
      const canvas = useWorkspaceStore.getState().canvases.find((item) => item.id === canvasId)
      if (canvas) {
        updateCanvas(canvasId, {
          imageNodes: (canvas.imageNodes ?? []).map((node) => {
            const position = updates.get(`node:${node.id}`)
            return position ? { ...node, x: position.x, y: position.y } : node
          }),
        })
      }
    }
    useStore.getState().showToast('已对齐', 'success')
  }

  const handleGroupPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || spaceDown || pickMode || selectionCount < 2) return
    const target = event.target as HTMLElement
    if (target.closest('button, input, textarea, select, [data-no-group-drag]')) return
    const taskId = target.closest('[data-canvas-node]')?.getAttribute('data-task-id')
    const nodeId = target.closest('[data-canvas-image-node]')?.getAttribute('data-image-node-id')
    if (!(taskId && selectedIds.has(taskId)) && !(nodeId && selectedImageIds.has(nodeId))) return
    const snapshot = capturePositions()
    const tasks = Object.entries(snapshot.tasks).map(([id, position]) => ({ id, ...position }))
    const imageNodes = Object.entries(snapshot.nodes).map(([id, position]) => ({ id, ...position }))
    if (tasks.length + imageNodes.length < 2) return
    const drag: GroupDragState = { startX: event.clientX, startY: event.clientY, dx: 0, dy: 0, moved: false, tasks, nodes: imageNodes }
    groupDragRef.current = drag
    setGroupDrag(drag)
    const onMove = (moveEvent: PointerEvent) => {
      const current = groupDragRef.current
      if (!current) return
      const dx = (moveEvent.clientX - current.startX) / Math.max(0.05, viewportRef.current.k)
      const dy = (moveEvent.clientY - current.startY) / Math.max(0.05, viewportRef.current.k)
      const next = {
        ...current,
        dx,
        dy,
        moved: current.moved || Math.abs(moveEvent.clientX - current.startX) + Math.abs(moveEvent.clientY - current.startY) > 3,
      }
      groupDragRef.current = next
      setGroupDrag(next)
    }
    const onUp = () => {
      const final = groupDragRef.current
      if (final?.moved) commitGroupDrag(final)
      groupDragRef.current = null
      setGroupDrag(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    event.stopPropagation()
    event.preventDefault()
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (box) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      const rect = event.currentTarget.getBoundingClientRect()
      const moved = Math.abs(box.x - box.startX) + Math.abs(box.y - box.startY) > 4
      if (!moved) {
        clearAllSelection()
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
      onPointerDownCapture={handleGroupPointerDown}
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
      <div className="absolute left-4 top-4 z-30" onPointerDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={undoPositions}
          disabled={undoDepth === 0 || undoing}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white/95 text-slate-600 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:bg-[#161822]/95 dark:text-slate-300"
          title={undoing ? '正在撤销…' : '撤销上一步移动/缩放/排列/删除'}
          aria-label="撤销"
        >
          <Undo2 size={15} />
        </button>
      </div>

      {selectionCount >= 2 && !pickMode && (
        <div className="absolute right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-0.5 rounded-xl border border-black/10 bg-white/95 p-1 text-caption shadow-lg backdrop-blur dark:border-white/10 dark:bg-[#161822]/95" onPointerDown={(event) => event.stopPropagation()}>
          <span className="px-1 py-0.5 text-center text-[10px] text-slate-400">已选 {selectionCount}</span>
          {([
            ['left', '左对齐', <AlignStartVertical key="left" size={14} />],
            ['center-x', '水平居中', <AlignCenterVertical key="center-x" size={14} />],
            ['right', '右对齐', <AlignEndVertical key="right" size={14} />],
            ['top', '上对齐', <AlignStartHorizontal key="top" size={14} />],
            ['center-y', '垂直居中', <AlignCenterHorizontal key="center-y" size={14} />],
            ['bottom', '下对齐', <AlignEndHorizontal key="bottom" size={14} />],
            ['space-x', '水平等距', <AlignHorizontalSpaceAround key="space-x" size={14} />],
            ['space-y', '垂直等距', <AlignVerticalSpaceAround key="space-y" size={14} />],
          ] as const).map(([mode, title, icon]) => (
            <button
              key={mode}
              type="button"
              onClick={() => alignSelection(mode)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 transition hover:bg-black/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.08]"
              title={title}
              aria-label={title}
            >
              {icon}
            </button>
          ))}
          <div className="my-0.5 h-px bg-black/[0.06] dark:bg-white/[0.08]" />
          {([
            ['row', '横排', <Rows3 key="row" size={13} />],
            ['column', '纵排', <Columns3 key="column" size={13} />],
            ['grid', '网格', <Grid2X2 key="grid" size={13} />],
          ] as const).map(([mode, title, icon]) => (
            <button
              key={mode}
              type="button"
              onClick={() => alignSelection(mode)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 transition hover:bg-black/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.08]"
              title={title}
              aria-label={title}
            >
              {icon}
            </button>
          ))}
        </div>
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
            setSelectedImageIds(new Set())
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
                data-image-node-id={node.id}
                className={`group absolute select-none overflow-visible rounded-lg border bg-white dark:bg-[#161822] ${selected ? 'z-20 border-black/30 ring-2 ring-black dark:border-white/40 dark:ring-white' : 'border-black/10 dark:border-white/10'}`}
                style={{ left: view.x + (selected && groupDrag ? groupDrag.dx : 0), top: view.y + (selected && groupDrag ? groupDrag.dy : 0), width: view.w, height: view.h }}
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
                    void downloadImage(node.imageId, nodeLabel).then((result) => {
                      if (result.canceled || result.successCount) return
                      useStore.getState().showToast(getDownloadErrorMessage(result.error), 'error')
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
          {renderedNodes.map(({ task, x, y, width, height }) => {
            const selected = selectedIds.has(task.id)
            const offsetX = selected && groupDrag ? groupDrag.dx : 0
            const offsetY = selected && groupDrag ? groupDrag.dy : 0
            return (
            <CanvasTaskNode
              key={task.id}
              task={task}
              x={x + offsetX}
              y={y + offsetY}
              width={width}
              height={height}
              scale={viewport.k}
              selected={selected}
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
                if (Math.abs(nextX - x) + Math.abs(nextY - y) < 0.5) return
                const meta = task.canvas
                pushPositionUndo({
                  tasks: { [id]: { x, y, w: width, h: height, userSized: meta?.userSized } },
                  nodes: {},
                })
                const next = meta?.userSized && meta.w != null && meta.h != null
                  ? { ...meta, x: nextX, y: nextY }
                  : { x: nextX, y: nextY }
                void updateTaskCanvas(id, next)
              }}
              onResize={(id, rect) => {
                userInteractedRef.current = true
                if (Math.abs(rect.x - x) + Math.abs(rect.y - y) + Math.abs(rect.width - width) + Math.abs(rect.height - height) < 0.5) return
                pushPositionUndo({
                  tasks: { [id]: { x, y, w: width, h: height, userSized: task.canvas?.userSized } },
                  nodes: {},
                })
                void updateTaskCanvas(id, { x: rect.x, y: rect.y, w: rect.width, h: rect.height, userSized: true })
              }}
            />
            )
          })}
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
              void deleteSelection({ nodeIds: [imageMenu.node.id], canvasId })
              setSelectedImageIds(new Set())
              setImageMenu(null)
            }}
          >
            删除素材
          </button>
        </div>
      )}

      <div
        data-canvas-zoom-controls
        className="absolute bottom-4 z-10 flex items-center gap-1 rounded-full border border-black/10 bg-white/95 px-2 py-1 text-body-sm text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#161822]/95 dark:text-slate-300"
        style={{ right: 16 + rightInset }}
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
