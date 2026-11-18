import { apiFetch } from './platform'
import { getEngineUrl } from './comfyEngine'

export interface ComfyOutputImage {
  filename: string
  subfolder: string
  type: string
}

interface PromptResponse {
  prompt_id?: string
  error?: { message?: string; details?: string }
  node_errors?: Record<string, { errors?: Array<{ message?: string }> }>
}

interface HistoryEntry {
  outputs?: Record<string, { images?: ComfyOutputImage[] }>
  status?: { completed?: boolean; status_str?: string; messages?: unknown }
}

function baseUrl(): string {
  return getEngineUrl().replace(/\/+$/, '')
}

/** 从 ComfyUI 的错误响应里挑出最能说明问题的一句话 */
function describePromptError(payload: PromptResponse): string {
  if (payload.error?.message) {
    const details = payload.error.details ? `：${payload.error.details}` : ''
    return `${payload.error.message}${details}`
  }
  const nodeErrors = Object.entries(payload.node_errors ?? {})
  for (const [nodeId, value] of nodeErrors) {
    const first = value.errors?.[0]?.message
    if (first) return `节点 ${nodeId} 报错：${first}`
  }
  return '引擎拒绝了这次提交，通常是工作流里缺少模型或节点'
}

/** 提交 workflow（API 格式）到队列，返回 prompt_id */
export async function enqueuePrompt(prompt: Record<string, unknown>): Promise<string> {
  const response = await apiFetch(`${baseUrl()}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, client_id: crypto.randomUUID() }),
  })
  const payload = (await response.json().catch(() => ({}))) as PromptResponse
  if (!response.ok) {
    throw new Error(describePromptError(payload))
  }
  if (!payload.prompt_id) {
    throw new Error(describePromptError(payload))
  }
  return payload.prompt_id
}

export interface WaitOptions {
  timeoutMs?: number
  pollMs?: number
  signal?: AbortSignal
  onTick?: (elapsedMs: number) => void
}

/** 轮询 history 直到任务完成；超时或取消会抛错，取消时抛 AbortError */
export async function waitForPrompt(promptId: string, options: WaitOptions = {}): Promise<ComfyOutputImage[]> {
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000
  const pollMs = options.pollMs ?? 1000
  const startedAt = Date.now()
  for (;;) {
    if (options.signal?.aborted) throw new DOMException('已取消', 'AbortError')
    const elapsed = Date.now() - startedAt
    if (elapsed > timeoutMs) {
      throw new Error(`生成超时：超过 ${Math.round(timeoutMs / 60000)} 分钟仍未完成`)
    }
    options.onTick?.(elapsed)
    const response = await apiFetch(`${baseUrl()}/history/${promptId}`, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`读取任务状态失败（HTTP ${response.status}）`)
    }
    const history = (await response.json()) as Record<string, HistoryEntry>
    const entry = history[promptId]
    if (entry) {
      if (entry.status?.status_str === 'error') {
        throw new Error('生成失败：引擎执行工作流时报错，请到 ComfyUI 控制台查看具体节点')
      }
      const images = Object.values(entry.outputs ?? {}).flatMap((output) => output.images ?? [])
      if (images.length > 0) return images
      if (entry.status?.completed) {
        throw new Error('工作流执行完成但没有产生图片，请确认工作流里有保存图像的节点')
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
}

/** 按 /view 取回图像字节 */
export async function fetchOutputImage(image: ComfyOutputImage): Promise<Blob> {
  const query = new URLSearchParams({
    filename: image.filename,
    subfolder: image.subfolder ?? '',
    type: image.type ?? 'output',
  })
  const response = await apiFetch(`${baseUrl()}/view?${query.toString()}`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`取回图片失败（HTTP ${response.status}）`)
  }
  return await response.blob()
}

/** 上传参考图，返回引擎侧的图片名（可直接写进 LoadImage.image） */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${file.name || 'input.png'}`
  form.append('image', file, unique)
  form.append('overwrite', 'true')
  const response = await apiFetch(`${baseUrl()}/upload/image`, { method: 'POST', body: form })
  if (!response.ok) {
    throw new Error(`上传参考图失败（HTTP ${response.status}）`)
  }
  const payload = (await response.json()) as { name?: string; subfolder?: string }
  if (!payload.name) throw new Error('上传参考图失败：引擎没有返回文件名')
  return payload.subfolder ? `${payload.subfolder}/${payload.name}` : payload.name
}

/** 中断当前正在执行的任务 */
export async function interruptEngine(): Promise<void> {
  await apiFetch(`${baseUrl()}/interrupt`, { method: 'POST' }).catch((err) => {
    console.warn('中断任务失败：', err)
  })
}

export interface ObjectInfoNode {
  input?: { required?: Record<string, unknown>; optional?: Record<string, unknown> }
  input_order?: { required?: string[]; optional?: string[] }
}

/** 读取引擎的节点定义，用于把 UI 格式工作流转成 API 格式 */
export async function fetchObjectInfo(): Promise<Record<string, ObjectInfoNode>> {
  const response = await apiFetch(`${baseUrl()}/object_info`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`读取节点定义失败（HTTP ${response.status}）`)
  return (await response.json()) as Record<string, ObjectInfoNode>
}
