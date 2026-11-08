import type { CanvasImageNode } from '../types'

const MIN_NODE_SIZE = 48
const DEFAULT_NODE_WIDTH = 320
const DEFAULT_NODE_HEIGHT = 240

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 旧数据里没有画布图片节点，缺省视为空数组 */
export function normalizeCanvasImageNodes(value: unknown): CanvasImageNode[] {
  if (!Array.isArray(value)) return []
  const nodes: CanvasImageNode[] = []
  const ids = new Set<string>()
  for (const item of value) {
    if (!isRecord(item)) continue
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id)) continue
    if (typeof item.imageId !== 'string' || !item.imageId) continue
    if (!finite(item.x) || !finite(item.y)) continue
    const w = finite(item.w) ? Math.max(MIN_NODE_SIZE, item.w) : DEFAULT_NODE_WIDTH
    const h = finite(item.h) ? Math.max(MIN_NODE_SIZE, item.h) : DEFAULT_NODE_HEIGHT
    ids.add(item.id)
    nodes.push({
      id: item.id,
      imageId: item.imageId,
      x: item.x,
      y: item.y,
      w,
      h,
      ...(finite(item.z) ? { z: item.z } : {}),
    })
  }
  return nodes
}

/** 同一图像记录只保留一个画布节点；已有节点返回原数组 */
export function addCanvasImageNode(nodes: CanvasImageNode[], node: CanvasImageNode): CanvasImageNode[] {
  if (nodes.some((item) => item.imageId === node.imageId)) return nodes
  return [...nodes, node]
}

export function removeCanvasImageNodes(nodes: CanvasImageNode[], ids: Iterable<string>): CanvasImageNode[] {
  const remove = new Set(ids)
  return nodes.filter((node) => !remove.has(node.id))
}

export function moveCanvasImageNode(nodes: CanvasImageNode[], id: string, x: number, y: number): CanvasImageNode[] {
  return nodes.map((node) => node.id === id ? { ...node, x, y } : node)
}

export function resizeCanvasImageNode(nodes: CanvasImageNode[], id: string, x: number, y: number, w: number, h: number): CanvasImageNode[] {
  return nodes.map((node) => node.id === id
    ? { ...node, x, y, w: Math.max(MIN_NODE_SIZE, w), h: Math.max(MIN_NODE_SIZE, h) }
    : node)
}

export function canvasImageIds(nodes: CanvasImageNode[]): string[] {
  return nodes.map((node) => node.imageId)
}

/** 画布当前真正存在的图片：图片节点 + 任务输出 */
export function collectCanvasContentImageIds(imageNodes: CanvasImageNode[], tasks: Array<{ outputImages: string[] }>): Set<string> {
  const ids = new Set<string>(canvasImageIds(imageNodes))
  for (const task of tasks) {
    for (const id of task.outputImages) ids.add(id)
  }
  return ids
}

/** 输入框里指向已删除素材的项：只标记，不自动移除 */
export function missingInputImageIds(inputIds: string[], contentIds: Set<string>): Set<string> {
  return new Set(inputIds.filter((id) => !contentIds.has(id)))
}

/** 已从画布删除的素材：输入框仍保留选择时显示缺失 */
export function removedInputImageIds(inputIds: string[], removedIds: string[]): Set<string> {
  const removed = new Set(removedIds)
  return new Set(inputIds.filter((id) => removed.has(id)))
}

export function createCanvasImageNode(imageId: string, x: number, y: number, width = DEFAULT_NODE_WIDTH, height = DEFAULT_NODE_HEIGHT): CanvasImageNode {
  return {
    id: crypto.randomUUID(),
    imageId,
    x,
    y,
    w: Math.max(MIN_NODE_SIZE, width),
    h: Math.max(MIN_NODE_SIZE, height),
  }
}

/** 按自然尺寸等比限制节点初始大小 */
export function fitCanvasImageNodeSize(width: number, height: number, maxWidth = DEFAULT_NODE_WIDTH, maxHeight = DEFAULT_NODE_HEIGHT) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT }
  }
  const scale = Math.min(maxWidth / width, maxHeight / height, 1)
  return { width: Math.max(MIN_NODE_SIZE, width * scale), height: Math.max(MIN_NODE_SIZE, height * scale) }
}

export { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, MIN_NODE_SIZE }
