import { useMemo } from 'react'
import type { CanvasImageNode, InputImage, TaskParams, TaskRecord } from '../types'
import type { Artboard, GenerationParams, ReferenceImage } from './types'
import { getCachedImage } from '../lib/imageCache'

export const STUDIO_SIZE_OPTIONS = [
  { label: '自动', res: 'auto' },
  { label: '1K 16:9 · 1280×720', res: '1280x720' },
  { label: '1K 9:16 · 720×1280', res: '720x1280' },
  { label: '2K 16:9 · 2560×1440', res: '2560x1440' },
]

const SIZE_RATIOS: Record<string, string> = {
  '1024x1024': '1:1',
  '1536x1024': '3:2',
  '1024x1536': '2:3',
  '2048x2048': '1:1',
  '2048x1152': '16:9',
  '1152x2048': '9:16',
  '1280x720': '16:9',
  '720x1280': '9:16',
  '2560x1440': '16:9',
}

export function getAspectRatio(size: string) {
  return SIZE_RATIOS[size] ?? (size === 'auto' ? '1:1' : '1:1')
}

export function taskToArtboard(task: TaskRecord, imageId: string, imageUrl: string, imageIndex?: number): Artboard {
  const size = task.params.size
  return {
    id: `${task.id}:${imageId}`,
    title: task.prompt.trim().slice(0, 28) || '未命名生成',
    imageUrl,
    aspectRatio: getAspectRatio(size),
    resolution: size === 'auto' ? 'auto' : size.replace('x', '×'),
    model: task.apiModel || task.apiProfileName || '默认模型',
    renderTime: task.elapsed ? `${(task.elapsed / 1000).toFixed(1)}s` : undefined,
    x: 0,
    y: 0,
    width: 360,
    height: 280,
    prompt: task.prompt,
    quality: task.params.quality,
    format: task.params.output_format.toUpperCase(),
    transparent: task.params.transparent_output,
    filter: task.params.moderation,
    count: task.params.n,
    createdAt: new Date(task.createdAt).toLocaleString('zh-CN'),
    taskId: task.id,
    imageId,
    imageIndex,
    status: task.status === 'running' ? 'running' : task.status === 'error' ? 'error' : 'done',
    errorMessage: task.error ?? undefined,
    isStarred: task.isFavorite,
  }
}

export function getGenerationParams(params: TaskParams, model: string): GenerationParams {
  return {
    model,
    dimension: params.size,
    quality: params.quality,
    count: params.n,
    format: params.output_format === 'jpeg' ? 'JPEG' : params.output_format === 'webp' ? 'WebP' : 'PNG',
    transparent: params.transparent_output,
    compression: params.output_compression,
    filter: params.moderation === 'low' ? 'standard' : 'auto',
  }
}

export function toTaskParams(params: GenerationParams): Partial<TaskParams> {
  return {
    size: params.dimension,
    quality: params.quality as TaskParams['quality'],
    n: params.count,
    output_format: params.format === 'JPEG' ? 'jpeg' : params.format === 'WebP' ? 'webp' : 'png',
    output_compression: params.format === 'PNG' ? null : params.compression ?? null,
    transparent_output: params.transparent,
    moderation: params.filter === 'standard' ? 'low' : 'auto',
  }
}

export function toReferenceImages(inputImages: InputImage[], missingIds?: Set<string>): ReferenceImage[] {
  return inputImages.map((image, index) => ({
    id: image.id,
    url: image.dataUrl || getCachedImage(image.id) || '',
    name: `图${index + 1}`,
    tagNumber: index + 1,
    weight: 0.75,
    role: 'ref',
    ...(missingIds?.has(image.id) ? { missing: true } : {}),
  }))
}

/**
 * 把任务解析成 Studio 卡片：多图任务拆成多张卡，还没出图的任务也占一格（生成中 / 失败），
 * 否则点生成后页面毫无变化，失败也没有痕迹。纯函数，便于单测，hook 只负责 memo。
 */
export function tasksToArtboards(tasks: TaskRecord[]) {
  return tasks.flatMap((task) => {
    if (task.outputImages.length === 0) {
      return task.status === 'running' || task.status === 'error' ? [taskToArtboard(task, '', '')] : []
    }
    return task.outputImages.map((imageId, index) => taskToArtboard(task, imageId, getCachedImage(imageId) ?? '', task.outputImages.length > 1 ? index : undefined))
  })
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** 素材节点保持的是图片真实比例（fitCanvasImageNodeSize），化简成最接近的整数比展示 */
export function assetAspectRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '1:1'
  const divisor = gcd(Math.round(width), Math.round(height)) || 1
  const w = Math.round(width / divisor)
  const h = Math.round(height / divisor)
  return w > 40 || h > 40 ? '1:1' : `${w}:${h}`
}

/**
 * 把画布里的参考图素材节点也映射成九宫格卡片，补齐「素材只存在于画布与输入台」的缺口。
 * 产物被拖回画布当素材时不再重复占一格（taskImageIds 里已出现过）。
 */
export function assetNodesToArtboards(nodes: CanvasImageNode[], taskImageIds: Set<string>): Artboard[] {
  const seen = new Set<string>()
  return nodes
    .filter((node) => {
      if (!node.imageId || taskImageIds.has(node.imageId) || seen.has(node.imageId)) return false
      seen.add(node.imageId)
      return true
    })
    .map((node, index) => ({
      id: `asset:${node.id}`,
      title: `素材 图${index + 1}`,
      imageUrl: '',
      imageId: node.imageId,
      aspectRatio: assetAspectRatio(node.w, node.h),
      resolution: `素材 图${index + 1}`,
      model: '参考图素材',
      x: node.x,
      y: node.y,
      width: node.w,
      height: node.h,
      status: 'done' as const,
      isAsset: true,
      assetNumber: index + 1,
    }))
}

/**
 * 图片由卡片按需加载，避免一次性读取全部输出图。
 * 素材卡排在生成结果前面，形成「输入 → 输出」的阅读顺序；收藏视图没有真实画布，自然为空。
 */
const EMPTY_IMAGE_NODES: CanvasImageNode[] = []

export function useArtboards(tasks: TaskRecord[], imageNodes: CanvasImageNode[] = EMPTY_IMAGE_NODES) {
  return useMemo(() => {
    const taskBoards = tasksToArtboards(tasks)
    if (imageNodes.length === 0) return taskBoards
    const taskImageIds = new Set(tasks.flatMap((task) => task.outputImages))
    return [...assetNodesToArtboards(imageNodes, taskImageIds), ...taskBoards]
  }, [tasks, imageNodes])
}
