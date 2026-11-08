import { DEFAULT_PARAMS } from '../types'
import type { InputImage, TaskRecord } from '../types'
import { cleanupUnreferencedImages, createDeleteSnapshot, moveTasksToWorkspace, removeMultipleTasks, stopBatchPrompts, stopTask, useStore } from '../store'
import { ensureImageCached } from './imageCache'
import { useCanvasViewStore } from './canvasViewStore'
import { useWorkspaceStore } from './workspaceStore'
import { DEFAULT_CANVAS_ID, DEFAULT_PROJECT_ID } from './workspaceState'
import { FAVORITES_PROJECT_ID, isFavoritesCanvas } from './favorites'

const EMPTY_VIEWPORT = { x: 0, y: 0, k: 1 }
let switchGeneration = 0
let switchQueue: Promise<void> = Promise.resolve()

export function saveActiveCanvasSnapshot() {
  const workspace = useWorkspaceStore.getState()
  const canvasId = workspace.activeCanvasId
  // 收藏是派生视图，没有可写的画布快照
  if (!canvasId || isFavoritesCanvas(canvasId)) return
  const state = useStore.getState()
  workspace.updateCanvas(canvasId, {
    promptDraft: state.prompt,
    paramsDraft: state.params,
    referenceImageIds: state.inputImages.map((image) => image.id),
    maskDraft: state.maskDraft,
    maskEditorImageId: state.maskEditorImageId,
    viewport: useCanvasViewStore.getState().viewport,
  })
}

async function restoreCanvasSnapshot(canvasId: string, generation: number) {
  const canvas = useWorkspaceStore.getState().canvases.find((item) => item.id === canvasId)
  if (!canvas) return
  const isCurrent = () => switchGeneration === generation && useWorkspaceStore.getState().activeCanvasId === canvasId
  const images: InputImage[] = []
  for (const id of canvas.referenceImageIds ?? []) {
    const dataUrl = await ensureImageCached(id)
    if (!isCurrent()) return
    if (dataUrl) images.push({ id, dataUrl })
  }
  if (!isCurrent()) return
  const store = useStore.getState()
  store.setInputImages(images)
  store.setPrompt(canvas.promptDraft ?? '')
  if (canvas.paramsDraft) store.setParams({ ...DEFAULT_PARAMS, ...store.params, ...canvas.paramsDraft })
  if (canvas.maskDraft) store.setMaskDraft(canvas.maskDraft)
  else store.clearMaskDraft()
  store.setMaskEditorImageId(null)
  store.clearSelection()
  store.setDetailTaskId(null)
  useCanvasViewStore.getState().setViewport(canvas.viewport ?? EMPTY_VIEWPORT)
}

export async function restoreActiveCanvasSnapshot() {
  const generation = ++switchGeneration
  await restoreCanvasSnapshot(useWorkspaceStore.getState().activeCanvasId, generation)
}

async function doSwitchCanvas(canvasId: string) {
  const workspace = useWorkspaceStore.getState()
  if (canvasId === workspace.activeCanvasId) return
  // 收藏画布不在 canvases 里，直接切活动 ID，不做快照恢复
  if (isFavoritesCanvas(canvasId)) {
    saveActiveCanvasSnapshot()
    switchGeneration++
    useWorkspaceStore.setState({ activeCanvasId: canvasId, activeProjectId: FAVORITES_PROJECT_ID })
    const store = useStore.getState()
    store.clearSelection()
    store.setDetailTaskId(null)
    return
  }
  const target = workspace.canvases.find((canvas) => canvas.id === canvasId)
  if (!target) return
  saveActiveCanvasSnapshot()
  const generation = ++switchGeneration
  workspace.setActiveCanvas(canvasId)
  await restoreCanvasSnapshot(canvasId, generation)
}

export function switchCanvas(canvasId: string) {
  switchQueue = switchQueue.then(() => doSwitchCanvas(canvasId)).catch((err) => {
    console.error('切换画布失败', err)
  })
  return switchQueue
}

/** 新建/删除等需要读写 composer 的 workspace 操作，和切换快照共用一条队列 */
export function enqueueWorkspaceAction(action: () => Promise<void> | void) {
  switchQueue = switchQueue.then(() => action()).catch((err) => {
    console.error('workspace 操作失败', err)
  })
  return switchQueue
}

export async function switchProject(projectId: string) {
  const workspace = useWorkspaceStore.getState()
  const canvas = workspace.canvases.find((item) => item.projectId === projectId)
  if (!canvas) return
  if (workspace.activeProjectId === projectId && workspace.activeCanvasId === canvas.id) return
  await switchCanvas(canvas.id)
  useWorkspaceStore.getState().setActiveProject(projectId)
}

export function getCanvasTasks(canvasId: string) {
  return useStore.getState().tasks.filter((task) => task.canvasId === canvasId)
}

export function getProjectTasks(projectId: string) {
  return useStore.getState().tasks.filter((task) => task.projectId === projectId)
}

export function getRunningTasks(tasks: TaskRecord[]) {
  return tasks.filter((task) => task.status === 'running')
}

export async function stopTasks(tasks: TaskRecord[]) {
  const running = getRunningTasks(tasks)
  if (!running.length) return
  if (useStore.getState().batchProgress) stopBatchPrompts()
  await Promise.all(running.map((task) => stopTask(task.id)))
}

function boundingBox(tasks: TaskRecord[]) {
  const positioned = tasks.filter((task) => task.canvas)
  if (!positioned.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const task of positioned) {
    const canvas = task.canvas!
    minX = Math.min(minX, canvas.x)
    minY = Math.min(minY, canvas.y)
    maxX = Math.max(maxX, canvas.x + (canvas.w ?? 0))
    maxY = Math.max(maxY, canvas.y + (canvas.h ?? 0))
  }
  return { minX, minY, maxX, maxY }
}

export async function deleteCanvas(canvasId: string, mode: 'move' | 'delete') {
  const workspace = useWorkspaceStore.getState()
  const canvas = workspace.canvases.find((item) => item.id === canvasId)
  if (!canvas) return
  const tasks = getCanvasTasks(canvasId)
  let snapshot: string | null = null
  try {
    snapshot = await createDeleteSnapshot('删除画布', tasks.map((task) => task.id), { type: 'canvas', projectId: canvas.projectId, canvasId })
  } catch (err) {
    useStore.getState().showToast(`删除已中止：${err instanceof Error ? err.message : String(err)}`, 'error')
    return
  }
  await stopTasks(tasks)

  let failed: string[] = []
  if (mode === 'move') {
    let target = workspace.canvases.find((item) => item.projectId === canvas.projectId && item.id !== canvasId)
    if (!target) {
      const targetId = workspace.createCanvas(canvas.projectId, '画布 1')
      target = useWorkspaceStore.getState().canvases.find((item) => item.id === targetId)
    }
    if (target) {
      const sourceBox = boundingBox(tasks)
      const targetBox = boundingBox(getCanvasTasks(target.id))
      const offset = sourceBox && targetBox
        ? { x: targetBox.maxX + 48 - sourceBox.minX, y: targetBox.minY - sourceBox.minY }
        : { x: 0, y: 0 }
      const result = await moveTasksToWorkspace(tasks.map((task) => task.id), target.projectId, target.id, offset)
      failed = result.failed
    } else {
      useStore.getState().showToast('找不到可迁移的目标画布，画布未删除', 'error')
      return
    }
  } else {
    const deletion = await removeMultipleTasks(tasks.map((task) => task.id), { snapshot: false })
    if (deletion.failed.length) {
      useStore.getState().showToast(`有 ${deletion.failed.length} 个任务删除失败，画布未删除，请重试`, 'error')
      return
    }
  }

  if (failed.length) {
    useStore.getState().showToast(`有 ${failed.length} 个任务迁移失败，画布未删除，请重试`, 'error')
    return
  }
  saveActiveCanvasSnapshot()
  useWorkspaceStore.getState().removeCanvas(canvasId)
  await restoreActiveCanvasSnapshot()
  useStore.getState().clearSelection()
  if (snapshot) {
    useStore.getState().showToast(`已删除画布「${canvas.name}」`, 'success', { label: '查看快照', run: () => useStore.getState().setShowSettings(true, 'data') })
  } else {
    useStore.getState().showToast(`已删除画布「${canvas.name}」`, 'success')
  }
  await cleanupUnreferencedImages().catch((err) => console.error('清理画布图片失败', err))
}

export async function deleteProject(projectId: string, mode: 'move' | 'delete') {
  const workspace = useWorkspaceStore.getState()
  const project = workspace.projects.find((item) => item.id === projectId)
  if (!project) return
  const tasks = getProjectTasks(projectId)
  let snapshot: string | null = null
  try {
    snapshot = await createDeleteSnapshot('删除项目', tasks.map((task) => task.id), { type: 'project', projectId })
  } catch (err) {
    useStore.getState().showToast(`删除已中止：${err instanceof Error ? err.message : String(err)}`, 'error')
    return
  }
  await stopTasks(tasks)

  let failed: string[] = []
  if (mode === 'move') {
    const target = workspace.canvases.find((item) => item.projectId === DEFAULT_PROJECT_ID)
      ?? workspace.canvases.find((item) => item.projectId !== projectId)
    if (target) {
      const targetBox = boundingBox(getCanvasTasks(target.id))
      let cursorY = targetBox ? targetBox.maxY + 48 : 0
      const groups = new Map<string, TaskRecord[]>()
      for (const task of tasks) {
        const key = task.canvasId ?? canvasIdOf(task, projectId)
        groups.set(key, [...(groups.get(key) ?? []), task])
      }
      for (const group of groups.values()) {
        const box = boundingBox(group)
        const offset = box
          ? { x: (targetBox?.minX ?? 0) - box.minX, y: cursorY - box.minY }
          : { x: 0, y: 0 }
        const result = await moveTasksToWorkspace(group.map((task) => task.id), target.projectId, target.id, offset)
        failed.push(...result.failed)
        if (box) cursorY += box.maxY - box.minY + 48
      }
    } else {
      useStore.getState().showToast('找不到默认项目画布，项目未删除', 'error')
      return
    }
  } else {
    const deletion = await removeMultipleTasks(tasks.map((task) => task.id), { snapshot: false })
    if (deletion.failed.length) {
      useStore.getState().showToast(`有 ${deletion.failed.length} 个任务删除失败，项目未删除，请重试`, 'error')
      return
    }
  }

  if (failed.length) {
    useStore.getState().showToast(`有 ${failed.length} 个任务迁移失败，项目未删除，请重试`, 'error')
    return
  }
  saveActiveCanvasSnapshot()
  useWorkspaceStore.getState().removeProject(projectId)
  if (useWorkspaceStore.getState().activeProjectId === projectId) {
    useWorkspaceStore.getState().setActiveProject(DEFAULT_PROJECT_ID)
  }
  await restoreActiveCanvasSnapshot()
  useStore.getState().clearSelection()
  if (snapshot) {
    useStore.getState().showToast(`已删除项目「${project.name}」`, 'success', { label: '查看快照', run: () => useStore.getState().setShowSettings(true, 'data') })
  } else {
    useStore.getState().showToast(`已删除项目「${project.name}」`, 'success')
  }
  await cleanupUnreferencedImages().catch((err) => console.error('清理项目图片失败', err))
}

function canvasIdOf(task: TaskRecord, projectId: string) {
  const workspace = useWorkspaceStore.getState()
  return workspace.canvases.find((canvas) => canvas.projectId === projectId)?.id ?? task.canvasId ?? ''
}
