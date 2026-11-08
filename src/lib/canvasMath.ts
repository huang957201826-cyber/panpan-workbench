import type { ViewportTransform } from '../types'

export interface WorldPoint {
  x: number
  y: number
}

export interface WorldRect extends WorldPoint {
  width: number
  height: number
}

export interface CanvasNodeRect extends WorldRect {
  id: string
}

export function screenToWorld(clientX: number, clientY: number, rect: { left: number; top: number }, viewport: ViewportTransform): WorldPoint {
  return {
    x: (clientX - rect.left - viewport.x) / viewport.k,
    y: (clientY - rect.top - viewport.y) / viewport.k,
  }
}

export function worldToScreen(worldX: number, worldY: number, rect: { left: number; top: number }, viewport: ViewportTransform): WorldPoint {
  return {
    x: worldX * viewport.k + viewport.x + rect.left,
    y: worldY * viewport.k + viewport.y + rect.top,
  }
}

export function clampZoom(zoom: number, min = 0.02, max = 3) {
  return Math.min(max, Math.max(min, zoom))
}

/** 以屏幕上某一点为锚点缩放，返回新的视�?*/
export function zoomAtPoint(viewport: ViewportTransform, screenX: number, screenY: number, factor: number, min = 0.02, max = 3): ViewportTransform {
  const nextK = clampZoom(viewport.k * factor, min, max)
  if (nextK === viewport.k) return viewport
  const worldX = (screenX - viewport.x) / viewport.k
  const worldY = (screenY - viewport.y) / viewport.k
  return {
    x: screenX - worldX * nextK,
    y: screenY - worldY * nextK,
    k: nextK,
  }
}

/** 近方形自动布局：列数取 sqrt(n)，避免任务多时排成一条很高的竖列 */
export function autoLayoutPositions(count: number, width: number, height: number, gap = 48): WorldPoint[] {
  const total = Math.max(0, count)
  const columns = Math.max(1, Math.ceil(Math.sqrt(total)))
  const positions: WorldPoint[] = []
  for (let i = 0; i < total; i += 1) {
    positions.push({
      x: (i % columns) * (width + gap),
      y: Math.floor(i / columns) * (height + gap),
    })
  }
  return positions
}

/** 让全部节点进入视口；没有节点时返�?null */
export function fitNodesViewport(nodes: CanvasNodeRect[], size: { width: number; height: number }, padding = 72): ViewportTransform | null {
  if (!nodes.length || size.width <= padding * 2 || size.height <= padding * 2) return null
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const node of nodes) {
    left = Math.min(left, node.x)
    top = Math.min(top, node.y)
    right = Math.max(right, node.x + node.width)
    bottom = Math.max(bottom, node.y + node.height)
  }
  const width = Math.max(1, right - left)
  const height = Math.max(1, bottom - top)
  const k = clampZoom(Math.min((size.width - padding * 2) / width, (size.height - padding * 2) / height))
  return {
    x: (size.width - width * k) / 2 - left * k,
    y: (size.height - height * k) / 2 - top * k,
    k,
  }
}

/** 节点是否与视口世界矩形相交（外扩 overscan�?*/
export function nodeInView(node: CanvasNodeRect, view: WorldRect): boolean {
  return (
    node.x < view.x + view.width &&
    node.x + node.width > view.x &&
    node.y < view.y + view.height &&
    node.y + node.height > view.y
  )
}
