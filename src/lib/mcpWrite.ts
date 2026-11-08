import type { InputImage } from '../types'

export interface McpWriteRequest {
  id: string
  tool: 'task.create' | 'image.attach' | string
  prompt?: string
  imageIds?: string[]
  canvasId?: string | null
  projectId?: string | null
}

/** 只使用 MCP 请求显式给出的参考图，不读取当前输入台 */
export function requestedImageIds(request: McpWriteRequest): string[] {
  return Array.isArray(request.imageIds) ? request.imageIds.filter((id): id is string => typeof id === 'string') : []
}

export function buildTaskSubmitInput(request: McpWriteRequest, images: InputImage[]) {
  return {
    prompts: [request.prompt?.trim() ?? ''],
    inputImages: images,
  }
}
