import type { TaskRecord } from '../types'

const NODE_WIDTH = 360
const MIN_HEIGHT = 180
const MAX_HEIGHT = 640
const GAP = 48

function parseSize(value: string | undefined) {
  const match = value?.match(/^(\d+)x(\d+)$/)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return { width, height }
}

/**
 * 节点尺寸：用户手动缩放过的按持久化尺寸，否则按真实图片比例（actualParams 回来的是实际像素）。
 * 拖动只改位置、不写死尺寸，避免拖一下就把比例永久锁在当时的值上。
 */
export function getTaskNodeSize(task: Pick<TaskRecord, 'canvas' | 'params' | 'actualParams' | 'outputImages' | 'inputImageIds' | 'status'>) {
  if (task.canvas?.userSized && task.canvas.w && task.canvas.h) {
    return { width: Math.max(160, task.canvas.w), height: Math.max(120, task.canvas.h) }
  }
  const size = parseSize(task.actualParams?.size) ?? parseSize(task.params.size)
  // 生成中/失败没有最终图时也用请求 size 做占位框
  if (!task.outputImages?.length && !task.inputImageIds?.length && !size) {
    return { width: 280, height: task.status === 'error' ? 150 : 140 }
  }
  const ratio = size ? size.height / size.width : 0.75
  return {
    width: NODE_WIDTH,
    height: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, NODE_WIDTH * ratio)),
  }
}

/** 行式自动布局：每行高度取该行最大节点高度 */
export function autoLayoutCanvasNodes(nodes: Array<{ width: number; height: number }>, gap = GAP) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, nodes.length))))
  const positions: Array<{ x: number; y: number }> = []
  let y = 0
  for (let start = 0; start < nodes.length; start += columns) {
    const row = nodes.slice(start, start + columns)
    const rowHeight = Math.max(...row.map((node) => node.height))
    let x = 0
    for (const node of row) {
      positions.push({ x, y })
      x += node.width + gap
    }
    y += rowHeight + gap
  }
  return positions
}

export interface CanvasNodeRect {
  id: string
  x: number
  y: number
  width: number
  height: number
}

/** 与画布渲染一致的节点矩形：优先持久化坐标，旧任务按自动布局补位 */
export function getCanvasNodeRects(tasks: TaskRecord[]): CanvasNodeRect[] {
  const sorted = [...tasks].sort((a, b) => a.createdAt - b.createdAt)
  const sizes = sorted.map((task) => getTaskNodeSize(task))
  const auto = autoLayoutCanvasNodes(sizes)
  return sorted.map((task, index) => ({
    id: task.id,
    x: task.canvas?.x ?? auto[index]?.x ?? 0,
    y: task.canvas?.y ?? auto[index]?.y ?? 0,
    width: sizes[index].width,
    height: sizes[index].height,
  }))
}

/** 新节点插入位置：选中节点所在行下方；无选中时最后一行下方 */
export function getCanvasInsertPosition(
  nodes: CanvasNodeRect[],
  anchorId?: string | null,
  gap = GAP,
): { x: number; y: number } {
  if (!nodes.length) return { x: 0, y: 0 }
  const anchor = anchorId ? nodes.find((node) => node.id === anchorId) : undefined
  if (anchor) {
    let rowBottom = anchor.y + anchor.height
    for (const node of nodes) {
      if (node.y < anchor.y + anchor.height && node.y + node.height > anchor.y) {
        rowBottom = Math.max(rowBottom, node.y + node.height)
      }
    }
    return { x: anchor.x, y: rowBottom + gap }
  }
  let bottom = -Infinity
  for (const node of nodes) bottom = Math.max(bottom, node.y + node.height)
  let left = Infinity
  for (const node of nodes) {
    if (Math.abs(node.y + node.height - bottom) < 1) left = Math.min(left, node.x)
  }
  return { x: Number.isFinite(left) ? left : 0, y: bottom + gap }
}

export type CanvasNodeCorner = 'nw' | 'ne' | 'sw' | 'se'

/** 四角等比缩放：按角点方向调整宽高和 x/y，宽 160–720 */
export function resizeNodeFromCorner(
  rect: { x: number; y: number; width: number; height: number },
  corner: CanvasNodeCorner,
  deltaX: number,
  scale: number,
) {
  const delta = deltaX / Math.max(0.0001, scale)
  const nextWidth = Math.min(720, Math.max(160, corner === 'sw' || corner === 'nw' ? rect.width - delta : rect.width + delta))
  const nextHeight = nextWidth * (rect.height / rect.width)
  return {
    x: corner === 'sw' || corner === 'nw' ? rect.x + rect.width - nextWidth : rect.x,
    y: corner === 'ne' || corner === 'nw' ? rect.y + rect.height - nextHeight : rect.y,
    width: nextWidth,
    height: nextHeight,
  }
}

/** 框选命中：返回与矩形相交的节点 ID */
export function nodeIdsInRect(
  rects: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  rect: { x: number; y: number; width: number; height: number },
) {
  return rects
    .filter((node) => node.x < rect.x + rect.width
      && node.x + node.width > rect.x
      && node.y < rect.y + rect.height
      && node.y + node.height > rect.y)
    .map((node) => node.id)
}
