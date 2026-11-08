import { createElement } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import type { InputImage } from '../types'
import { buildTaskSubmitInput, requestedImageIds, type McpWriteRequest } from './mcpWrite'

async function respond(id: string, approved: boolean, result?: unknown, error?: string) {
  await invoke('mcp_write_response', { id, approved, result: result ?? null, error: error ?? null })
}

function preview(images: InputImage[]) {
  if (!images.length) return null
  return createElement(
    'div',
    { className: 'flex flex-wrap gap-2 pt-1' },
    images.map((image) => createElement('img', {
      key: image.id,
      src: image.dataUrl,
      alt: '',
      className: 'h-12 w-12 rounded-lg object-cover ring-1 ring-black/10 dark:ring-white/10',
    })),
  )
}

async function handleWriteRequest(request: McpWriteRequest) {
  const { useStore, submitTask, withInputPending } = await import('../store')
  const { ensureImageCached } = await import('./imageCache')
  const { useWorkspaceStore } = await import('./workspaceStore')
  const isTask = request.tool === 'task.create'
  const imageIds = requestedImageIds(request)
  const images: InputImage[] = []
  for (const imageId of imageIds) {
    const dataUrl = await ensureImageCached(imageId)
    if (!dataUrl) {
      await respond(request.id, false, null, `参考图不存在：${imageId}`)
      return
    }
    images.push({ id: imageId, dataUrl })
  }
  if (isTask && !request.prompt?.trim()) {
    await respond(request.id, false, null, '提示词为空')
    return
  }
  const workspace = useWorkspaceStore.getState()
  const project = workspace.projects.find((item) => item.id === request.projectId)
  const canvas = workspace.canvases.find((item) => item.id === request.canvasId)
  const detail = [
    isTask ? `提示词：${request.prompt?.trim() || '（空）'}` : '操作：加入当前参考图',
    isTask ? `项目：${project?.name ?? (request.projectId || '当前项目')}` : '',
    isTask ? `画布：${canvas?.name ?? (request.canvasId || '当前画布')}` : '',
    `参考图：${images.length} 张`,
  ].filter(Boolean).join('\n')

  let approved = false
  let expired = false
  const dialog = {
    title: 'MCP 写入请求',
    message: `外部 MCP 客户端请求执行写入。\n\n${detail}`,
    content: preview(images) ?? undefined,
    confirmText: '允许',
    cancelText: '拒绝',
    tone: 'warning' as const,
    action: () => { approved = true },
  }
  const timer = window.setTimeout(() => {
    expired = true
    if (useStore.getState().confirmDialog === dialog) useStore.getState().setConfirmDialog(null)
  }, 60_000)
  useStore.getState().setConfirmDialog(dialog)
  await new Promise<void>((resolve) => {
    const unsubscribe = useStore.subscribe((next) => {
      if (next.confirmDialog === dialog) return
      unsubscribe()
      resolve()
    })
  })
  window.clearTimeout(timer)
  if (!approved || expired) {
    await respond(request.id, false, null, expired ? '写入确认超时' : '用户拒绝')
    return
  }
  try {
    if (isTask) {
      const taskIds = await submitTask({
        input: buildTaskSubmitInput(request, images),
        projectId: request.projectId ?? undefined,
        canvasId: request.canvasId ?? undefined,
      })
      if (!taskIds.length) {
        await respond(request.id, false, null, '提交被阻止：参考图正在加入或已从画布删除')
        return
      }
      await respond(request.id, true, { taskIds })
      return
    }
    await withInputPending(async () => {
      for (const image of images) useStore.getState().addInputImage(image)
    })
    await respond(request.id, true, { attached: images.map((image) => image.id) })
  } catch (err) {
    await respond(request.id, false, null, err instanceof Error ? err.message : String(err))
  }
}

/** 主窗口全局监听 MCP 写入请求；确认框复用现有 ConfirmDialog */
export function installMcpWriteBridge() {
  void listen<McpWriteRequest>('mcp-write-request', (event) => {
    void handleWriteRequest(event.payload).catch((err) => {
      console.error('处理 MCP 写入请求失败：', err)
      void respond(event.payload.id, false, null, '处理失败')
    })
  })
}
