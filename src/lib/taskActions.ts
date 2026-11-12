import type { CanvasImageNode, Skill, TaskRecord } from '../types'
import { editOutputs, removeMultipleTasks, removeTask, reuseConfig, retryTask, useStore } from '../store'
import { putTask as dbPutTask, storeImage } from './db'
import { ensureImageCached } from './imageCache'
import { skillCoverColor } from './capabilitySkills'
import { useCapabilitySkillStore } from './capabilitySkillStore'
import { removeCanvasImageNodes } from './canvasImageNodes'
import { assertCanvasUndoActive, CanvasUndoCancelled, createCanvasUndoEntry, pushCanvasUndo, runCanvasUndo } from './canvasUndo'
import { useWorkspaceStore } from './workspaceStore'
import {
  downloadImageEntriesAsZip,
  downloadImageIds,
  getImageZipEntries,
  type DownloadImagesResult,
} from './downloadImages'
import type { SaveDir } from './saveFile'

export type TaskOutputVariant = 'current' | 'original' | 'all' | 'partial' | 'zip-all' | 'zip-partial'

export function downloadImageRefs(refs: string[], fileNameBase: string, dir?: SaveDir | null) {
  return downloadImageIds(refs, fileNameBase, dir)
}

/** 任务输出图的统一下载入口；current/original 需要 index，其余变体按整组处理 */
export function downloadTaskOutputs(
  task: TaskRecord,
  variant: TaskOutputVariant,
  opts: { index?: number; dir?: SaveDir | null } = {},
): Promise<DownloadImagesResult> {
  const index = opts.index ?? 0
  const base = `task-${task.id}`
  if (variant === 'current') {
    const imageId = task.outputImages[index]
    return imageId ? downloadImageIds([imageId], base, opts.dir) : Promise.resolve({ successCount: 0, failCount: 0 })
  }
  if (variant === 'original') {
    const imageId = task.transparentOriginalImages?.[index]
    return imageId ? downloadImageIds([imageId], `${base}-orig`, opts.dir) : Promise.resolve({ successCount: 0, failCount: 0 })
  }
  if (variant === 'partial') {
    const imageIds = task.streamPartialImageIds ?? []
    return imageIds.length ? downloadImageIds(imageIds, `${base}-partial`, opts.dir) : Promise.resolve({ successCount: 0, failCount: 0 })
  }
  if (variant === 'zip-all') {
    return downloadImageEntriesAsZip(getImageZipEntries(task.outputImages, base), base, opts.dir)
  }
  if (variant === 'zip-partial') {
    const imageIds = task.streamPartialImageIds ?? []
    return imageIds.length
      ? downloadImageEntriesAsZip(getImageZipEntries(imageIds, `${base}-partial`), `${base}-partial`, opts.dir)
      : Promise.resolve({ successCount: 0, failCount: 0 })
  }
  return downloadImageIds(task.outputImages, base, opts.dir)
}

/** 删除任务与画布素材；nodeIds 是画布节点 id，不是 imageId */
export async function deleteSelection(input: { taskIds?: string[]; nodeIds?: string[]; canvasId?: string }) {
  const taskIds = input.taskIds ?? []
  const nodeIds = input.nodeIds ?? []
  const undo = await captureTaskDeleteUndo(taskIds, input.canvasId, nodeIds)
  if (input.canvasId && nodeIds.length) {
    const workspace = useWorkspaceStore.getState()
    const canvas = workspace.canvases.find((item) => item.id === input.canvasId)
    if (canvas) {
      const removedNodes = (canvas.imageNodes ?? []).filter((node) => nodeIds.includes(node.id))
      workspace.updateCanvas(input.canvasId, {
        imageNodes: removeCanvasImageNodes(canvas.imageNodes ?? [], nodeIds),
        removedImageIds: [...new Set([...(canvas.removedImageIds ?? []), ...removedNodes.map((node) => node.imageId)])],
      })
    }
  }
  if (taskIds.length) await removeMultipleTasks(taskIds)
  if (undo) {
    showDeleteUndoToast(`已删除 ${taskIds.length} 个任务 / ${nodeIds.length} 个素材`, undo, input.canvasId)
  }
}

/** 把任务首图加入参考图；返回结果由视图决定提示文案 */
export async function addTaskAsReference(task: TaskRecord): Promise<'added' | 'exists' | 'missing'> {
  const imageId = task.outputImages[0] ?? task.inputImageIds[0]
  if (!imageId) return 'missing'
  if (useStore.getState().inputImages.some((image) => image.id === imageId)) return 'exists'
  const dataUrl = await ensureImageCached(imageId)
  if (!dataUrl) return 'missing'
  useStore.getState().addInputImage({ id: imageId, dataUrl })
  return 'added'
}

export function openTaskDetail(taskId: string | null) {
  useStore.getState().setDetailTaskId(taskId)
}

export interface TaskDeleteUndo {
  tasks: TaskRecord[]
  images: Array<{ id: string; dataUrl: string }>
  nodes?: CanvasImageNode[]
  canvasId?: string
}

function taskReferencedImageIds(task: TaskRecord) {
  return [
    ...task.outputImages,
    ...task.inputImageIds,
    task.maskImageId,
    ...(task.transparentOriginalImages ?? []),
    ...(task.streamPartialImageIds ?? []),
  ].filter((id): id is string => Boolean(id))
}

async function captureTaskDeleteUndo(taskIds: string[], canvasId?: string, nodeIds: string[] = []): Promise<TaskDeleteUndo | null> {
  const wanted = new Set(taskIds)
  const tasks = useStore.getState().tasks.filter((task) => wanted.has(task.id))
  const canvas = canvasId ? useWorkspaceStore.getState().canvases.find((item) => item.id === canvasId) : undefined
  const nodes = canvas && nodeIds.length
    ? (canvas.imageNodes ?? []).filter((node) => nodeIds.includes(node.id))
    : []
  if (!tasks.length && !nodes.length) return null
  const images: Array<{ id: string; dataUrl: string }> = []
  const imageIds = new Set([
    ...tasks.flatMap(taskReferencedImageIds),
    ...nodes.map((node) => node.imageId),
  ])
  for (const id of imageIds) {
    const dataUrl = await ensureImageCached(id)
    if (dataUrl) images.push({ id, dataUrl })
  }
  const taskCanvasIds = new Set(tasks.map((task) => task.canvasId).filter((id): id is string => Boolean(id)))
  const targetCanvasId = canvasId || (taskCanvasIds.size === 1 ? [...taskCanvasIds][0] : undefined)
  return { tasks, images, ...(nodes.length ? { nodes } : {}), canvasId: targetCanvasId }
}

/** 删除与位置变更共用同一画布撤销栈；Toast 与左上按钮拿到的是同一条记录 */
function showDeleteUndoToast(message: string, entry: TaskDeleteUndo, canvasId?: string) {
  const targetCanvasId = canvasId || entry.canvasId
  // 跨画布批量删除拿不到唯一 canvasId 时退回 Toast-only，不进入共享栈
  if (!targetCanvasId) {
    useStore.getState().showToast(message, 'success', {
      label: '撤销',
      run: () => {
        void restoreTaskDeleteEntry(entry, () => true).catch((err) => {
          useStore.getState().showToast(`撤销失败：${undoErrorMessage(err)}`, 'error')
        })
      },
    })
    return
  }
  const undoEntry = createCanvasUndoEntry('delete', '删除任务或素材', ({ isActive }) => restoreTaskDeleteEntry(entry, isActive))
  pushCanvasUndo(targetCanvasId, undoEntry)
  useStore.getState().showToast(message, 'success', {
    label: '撤销',
    undoCanvasId: targetCanvasId,
    undoEntryId: undoEntry.id,
    run: () => {
      void runCanvasUndo(targetCanvasId, undoEntry.id, () => canvasExists(targetCanvasId)).then((result) => {
        if (result.error) useStore.getState().showToast(`撤销失败：${result.error}，已保留撤销记录`, 'error')
      })
    },
  })
}

function undoErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message
  return String(err)
}

function canvasExists(canvasId: string) {
  return useWorkspaceStore.getState().canvases.some((canvas) => canvas.id === canvasId)
}

/**
 * 恢复一次任务/素材删除；每个 await 后确认画布仍存在且撤销未被切换/删除取消。
 * known-limit：取消前已完成或已开始的单条图片/任务写库不回滚，只保证不再开始后续写入。
 */
export async function restoreTaskDeleteEntry(entry: TaskDeleteUndo, isActive: () => boolean = () => true) {
  const assertAlive = () => {
    assertCanvasUndoActive(isActive)
    if (entry.canvasId && !useWorkspaceStore.getState().canvases.some((canvas) => canvas.id === entry.canvasId)) {
      throw new CanvasUndoCancelled()
    }
  }
  assertAlive()
  for (const image of entry.images) {
    await storeImage(image.dataUrl, 'generated')
    assertAlive()
  }
  for (const task of entry.tasks) {
    await dbPutTask(task)
    assertAlive()
  }
  const workspace = useWorkspaceStore.getState()
  const canvas = entry.canvasId ? workspace.canvases.find((item) => item.id === entry.canvasId) : undefined
  if (entry.canvasId && !canvas) throw new CanvasUndoCancelled()
  assertAlive()
  const current = useStore.getState().tasks
  const restoredIds = new Set(entry.tasks.map((task) => task.id))
  useStore.getState().setTasks([...entry.tasks, ...current.filter((task) => !restoredIds.has(task.id))])
  if (entry.canvasId && entry.nodes?.length && canvas) {
    const restoredNodeIds = new Set(entry.nodes.map((node) => node.id))
    const restoredImageIds = new Set(entry.nodes.map((node) => node.imageId))
    workspace.updateCanvas(entry.canvasId, {
      imageNodes: [...(canvas.imageNodes ?? []).filter((node) => !restoredNodeIds.has(node.id)), ...entry.nodes],
      removedImageIds: (canvas.removedImageIds ?? []).filter((id) => !restoredImageIds.has(id)),
    })
  }
  if (!isActive()) return
  useStore.getState().showToast(`已恢复 ${entry.tasks.length} 个任务 / ${entry.nodes?.length ?? 0} 个素材`, 'success')
}

export async function deleteTask(task: TaskRecord) {
  const undo = await captureTaskDeleteUndo([task.id], task.canvasId)
  await removeTask(task)
  if (undo) {
    showDeleteUndoToast('任务已删除', undo, task.canvasId)
  }
}

export async function deleteTasks(taskIds: string[]) {
  if (!taskIds.length) return { deleted: 0, failed: [] as string[] }
  const undo = await captureTaskDeleteUndo(taskIds)
  const result = await removeMultipleTasks(taskIds)
  if (result.deleted > 0 && undo) {
    showDeleteUndoToast(`已删除 ${result.deleted} 个任务`, undo, undo.canvasId)
  }
  return result
}

/** 把任务沉淀为「我的技能」；带 skillContext 时保留槽位与本次值 */
export function saveTaskAsSkill(task: TaskRecord): Skill {
  const context = task.skillContext
  const now = Date.now()
  const id = crypto.randomUUID()
  const firstLine = task.prompt.trim().split(/\r?\n/)[0]?.slice(0, 40)
  const skill: Skill = {
    id,
    name: context?.name ? `${context.name}（副本）` : firstLine || '任务技能',
    description: context ? '从任务保存的技能副本' : '从任务提示词保存',
    category: '我的',
    coverColor: skillCoverColor(id),
    coverImageId: task.outputImages[0],
    basePrompt: context?.basePrompt ?? task.prompt,
    slots: context?.slots.map((slot) => ({
      ...slot,
      defaultValue: context.slotValues[slot.key] ?? slot.defaultValue,
    })) ?? [],
    source: 'mine',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
  useCapabilitySkillStore.getState().addMine(skill)
  return skill
}

export const reuseTaskConfig = reuseConfig
export const editTaskOutputs = editOutputs
export const retryTaskAction = retryTask
