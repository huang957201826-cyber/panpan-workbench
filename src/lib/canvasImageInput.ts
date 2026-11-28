import type { InputImage } from '../types'
import { createInputImageFromFile, useStore, withInputPending } from '../store'
import { useCanvasViewStore } from './canvasViewStore'
import { addCanvasImageNode, createCanvasImageNode, fitCanvasImageNodeSize } from './canvasImageNodes'
import { useWorkspaceStore } from './workspaceStore'

function centerWorld() {
  const view = useCanvasViewStore.getState()
  const width = view.size.width || (typeof window !== 'undefined' ? window.innerWidth : 1200) || 1200
  const height = view.size.height || (typeof window !== 'undefined' ? window.innerHeight : 800) || 800
  const effectiveBottomInset = view.bottomInset > 0
    ? view.bottomInset
    : Math.min(200, Math.round(height * 0.28))
  return {
    x: (width / 2 - view.viewport.x) / Math.max(0.05, view.viewport.k),
    y: (Math.max(1, height - effectiveBottomInset) / 2 - view.viewport.y) / Math.max(0.05, view.viewport.k),
  }
}

function focusViewportOnRect(rect: { x: number; y: number; w: number; h: number }) {
  const view = useCanvasViewStore.getState()
  const width = view.size.width || (typeof window !== 'undefined' ? window.innerWidth : 0)
  const height = view.size.height || (typeof window !== 'undefined' ? window.innerHeight : 0)
  if (width <= 0 || height <= 0) return
  const effectiveBottomInset = view.bottomInset > 0
    ? view.bottomInset
    : Math.min(200, Math.round(height * 0.28))
  const availW = Math.max(1, width)
  const availH = Math.max(1, height - effectiveBottomInset)
  const k = view.viewport.k < 0.35 || view.viewport.k > 2.2 ? 0.85 : view.viewport.k
  const screenLeft = rect.x * k + view.viewport.x
  const screenTop = rect.y * k + view.viewport.y
  const screenRight = (rect.x + rect.w) * k + view.viewport.x
  const screenBottom = (rect.y + rect.h) * k + view.viewport.y
  const margin = 32
  const outOfView =
    k !== view.viewport.k ||
    screenRight < margin ||
    screenLeft > availW - margin ||
    screenBottom < margin ||
    screenTop > availH - margin
  if (outOfView) {
    view.setViewport({
      k,
      x: availW / 2 - (rect.x + rect.w / 2) * k,
      y: availH / 2 - (rect.y + rect.h / 2) * k,
    })
  }
}

/** 确保已加入 inputImages 的参考图同步出现在当前画布节点中 */
export async function ensureInputImageOnCanvas(image: InputImage, canvasId?: string, position?: { x: number; y: number }) {
  const ws = useWorkspaceStore.getState()
  const targetCanvasId = canvasId || ws.activeCanvasId || ws.canvases[0]?.id || ''
  if (!targetCanvasId) return image
  const canvas = ws.canvases.find((item) => item.id === targetCanvasId)
  if (!canvas) return image
  const existing = canvas.imageNodes?.find((node) => node.imageId === image.id)
  if (existing) {
    if (canvas.removedImageIds?.includes(image.id)) {
      useWorkspaceStore.getState().updateCanvas(targetCanvasId, {
        removedImageIds: canvas.removedImageIds.filter((id) => id !== image.id),
      })
    }
    focusViewportOnRect(existing)
    return image
  }
  const size = await new Promise<{ width: number; height: number }>((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(fitCanvasImageNodeSize(0, 0))
      return
    }
    const probe = new Image()
    probe.onload = () => resolve(fitCanvasImageNodeSize(probe.naturalWidth, probe.naturalHeight))
    probe.onerror = () => resolve(fitCanvasImageNodeSize(0, 0))
    probe.src = image.dataUrl
  })
  const latestBeforeInsert = useWorkspaceStore.getState().canvases.find((item) => item.id === targetCanvasId) ?? canvas
  if (latestBeforeInsert.imageNodes?.some((node) => node.imageId === image.id)) return image
  const existingCount = latestBeforeInsert.imageNodes?.length ?? 0
  const anchor = position ?? centerWorld()
  const cascadeOffset = position ? 0 : (existingCount % 5) * 28
  const nodeLeft = anchor.x - size.width / 2 + cascadeOffset
  const nodeTop = anchor.y - size.height / 2 + cascadeOffset
  const node = createCanvasImageNode(image.id, nodeLeft, nodeTop, size.width, size.height)
  const latest = useWorkspaceStore.getState().canvases.find((item) => item.id === targetCanvasId) ?? canvas
  useWorkspaceStore.getState().updateCanvas(targetCanvasId, {
    imageNodes: addCanvasImageNode(latest.imageNodes ?? [], node),
    ...(latest.removedImageIds?.includes(image.id)
      ? { removedImageIds: latest.removedImageIds.filter((id) => id !== image.id) }
      : {}),
  })
  focusViewportOnRect(node)
  return image
}

/** 仅将文件加入待发送参考图框（inputImages），发送任务时再落入画布节点 */
export async function addInputImageFile(file: File) {
  return withInputPending(async () => {
    const image = await createInputImageFromFile(file)
    if (!image) return null
    useStore.getState().addInputImage(image)
    const ws = useWorkspaceStore.getState()
    const activeCanvas = ws.canvases.find((item) => item.id === ws.activeCanvasId)
    if (activeCanvas?.removedImageIds?.includes(image.id)) {
      ws.updateCanvas(activeCanvas.id, {
        removedImageIds: activeCanvas.removedImageIds.filter((id) => id !== image.id),
      })
    }
    return image
  })
}

/** 文件入库后同时加入输入选择与当前画布素材节点；同一图像只建一个节点。 */
export async function addImageFileToCanvas(canvasId: string, file: File, position?: { x: number; y: number }) {
  return withInputPending(async () => {
    const image = await createInputImageFromFile(file)
    if (!image) return null
    useStore.getState().addInputImage(image)
    return ensureInputImageOnCanvas(image, canvasId, position)
  })
}
