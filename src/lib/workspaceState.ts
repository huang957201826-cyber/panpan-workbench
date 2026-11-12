import type { Project, ProjectCanvas, SkillSlotValue, TaskRecord, TaskParams, ViewportTransform, WorkspaceState } from '../types'
import { normalizeCanvasImageNodes } from './canvasImageNodes'

export const DEFAULT_PROJECT_ID = 'default-project'
export const DEFAULT_CANVAS_ID = 'default-canvas'
const DEFAULT_PROJECT_NAME = '默认项目'
const DEFAULT_CANVAS_NAME = '画布 1'
const MAX_NAME_LENGTH = 80

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeName(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const name = value.trim().slice(0, MAX_NAME_LENGTH)
  return name || fallback
}

function normalizeTimestamp(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeViewport(value: unknown): ViewportTransform | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.x !== 'number' || !Number.isFinite(value.x)) return undefined
  if (typeof value.y !== 'number' || !Number.isFinite(value.y)) return undefined
  if (typeof value.k !== 'number' || !Number.isFinite(value.k) || value.k <= 0) return undefined
  return { x: value.x, y: value.y, k: Math.min(3, Math.max(0.02, value.k)) }
}

function normalizeSkillSlotValues(value: unknown): Record<string, SkillSlotValue> | undefined {
  if (!isRecord(value)) return undefined
  const entries = Object.entries(value).filter(([key, item]) => {
    if (!key) return false
    if (typeof item === 'string' || typeof item === 'boolean') return true
    if (typeof item === 'number') return Number.isFinite(item)
    return Array.isArray(item) && item.every((part) => typeof part === 'string')
  })
  return entries.length ? Object.fromEntries(entries) as Record<string, SkillSlotValue> : undefined
}

function normalizeParamsDraft(value: unknown): Partial<TaskParams> | undefined {
  if (!isRecord(value)) return undefined
  const draft: Partial<TaskParams> = {}
  if (typeof value.size === 'string') draft.size = value.size
  if (value.quality === 'auto' || value.quality === 'low' || value.quality === 'medium' || value.quality === 'high' || value.quality === 'xhigh' || value.quality === 'max') draft.quality = value.quality
  if (value.output_format === 'png' || value.output_format === 'jpeg' || value.output_format === 'webp') draft.output_format = value.output_format
  if (value.output_compression === null || (typeof value.output_compression === 'number' && Number.isFinite(value.output_compression))) draft.output_compression = value.output_compression
  if (value.moderation === 'auto' || value.moderation === 'low') draft.moderation = value.moderation
  if (typeof value.n === 'number' && Number.isFinite(value.n)) draft.n = value.n
  if (typeof value.transparent_output === 'boolean') draft.transparent_output = value.transparent_output
  return Object.keys(draft).length ? draft : undefined
}

function normalizeCanvas(value: unknown, projects: Map<string, Project>, now: number): ProjectCanvas | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null
  if (typeof value.projectId !== 'string' || !projects.has(value.projectId)) return null
  const createdAt = normalizeTimestamp(value.createdAt, now)
  const viewport = normalizeViewport(value.viewport)
  const paramsDraft = normalizeParamsDraft(value.paramsDraft)
  const referenceImageIds = Array.isArray(value.referenceImageIds)
    ? [...new Set(value.referenceImageIds.filter((id): id is string => typeof id === 'string' && Boolean(id)))]
    : undefined
  const imageNodes = normalizeCanvasImageNodes(value.imageNodes)
  const removedImageIds = Array.isArray(value.removedImageIds)
    ? [...new Set(value.removedImageIds.filter((id): id is string => typeof id === 'string' && Boolean(id)))]
    : undefined
  const maskDraft = isRecord(value.maskDraft) && typeof value.maskDraft.targetImageId === 'string' && typeof value.maskDraft.maskDataUrl === 'string'
    ? {
        targetImageId: value.maskDraft.targetImageId,
        maskDataUrl: value.maskDraft.maskDataUrl,
        updatedAt: normalizeTimestamp(value.maskDraft.updatedAt, createdAt),
      }
    : null
  const activeSkillId = typeof value.activeSkillId === 'string' && value.activeSkillId ? value.activeSkillId : null
  const skillSlotValues = normalizeSkillSlotValues(value.skillSlotValues)
  return {
    id: value.id,
    projectId: value.projectId,
    name: normalizeName(value.name, DEFAULT_CANVAS_NAME),
    order: normalizeTimestamp(value.order, 0),
    ...(viewport ? { viewport } : {}),
    ...(typeof value.promptDraft === 'string' ? { promptDraft: value.promptDraft } : {}),
    ...(paramsDraft ? { paramsDraft } : {}),
    ...(referenceImageIds ? { referenceImageIds } : {}),
    ...(maskDraft ? { maskDraft } : {}),
    ...(typeof value.maskEditorImageId === 'string' ? { maskEditorImageId: value.maskEditorImageId } : {}),
    ...(imageNodes.length ? { imageNodes } : {}),
    ...(removedImageIds?.length ? { removedImageIds } : {}),
    ...(activeSkillId ? { activeSkillId } : {}),
    ...(skillSlotValues ? { skillSlotValues } : {}),
    createdAt,
    updatedAt: normalizeTimestamp(value.updatedAt, createdAt),
  }
}

export function createDefaultWorkspace(now = Date.now()): WorkspaceState {
  return {
    version: 1,
    projects: [{ id: DEFAULT_PROJECT_ID, name: DEFAULT_PROJECT_NAME, createdAt: now, updatedAt: now }],
    canvases: [{ id: DEFAULT_CANVAS_ID, projectId: DEFAULT_PROJECT_ID, name: DEFAULT_CANVAS_NAME, order: 0, createdAt: now, updatedAt: now }],
    activeProjectId: DEFAULT_PROJECT_ID,
    activeCanvasId: DEFAULT_CANVAS_ID,
    // 新用户首屏：底部浮岛输入栏 + 无限画布（产品需求）。
    viewMode: 'canvas',
    inputDockPosition: 'bottom',
  }
}

/** 清洗持久化的 workspace：补默认项目/画布、修正归属、去重、校正 active ID */
export function normalizeWorkspace(value: unknown, now = Date.now()): WorkspaceState {
  if (!isRecord(value) || !Array.isArray(value.projects)) return createDefaultWorkspace(now)

  let projects = new Map<string, Project>()
  const rawProjects = Array.isArray(value.projects) ? value.projects : []
  for (const [index, item] of rawProjects.entries()) {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id || projects.has(item.id)) continue
    const createdAt = normalizeTimestamp(item.createdAt, now)
    projects.set(item.id, {
      id: item.id,
      name: normalizeName(item.name, `项目 ${index + 1}`),
      createdAt,
      updatedAt: normalizeTimestamp(item.updatedAt, createdAt),
      ...(item.archived === true ? { archived: true } : {}),
    })
  }
  // 不再自动补回默认项目/画布；用户删除后保持空工作区

  const canvases: ProjectCanvas[] = []
  const canvasIds = new Set<string>()
  const rawCanvases = Array.isArray(value.canvases) ? value.canvases : []
  for (const item of rawCanvases) {
    const canvas = normalizeCanvas(item, projects, now)
    if (!canvas || canvasIds.has(canvas.id)) continue
    canvasIds.add(canvas.id)
    canvases.push(canvas)
  }

  canvases.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
  canvases.forEach((canvas, index) => { canvas.order = index })

  let activeProjectId = typeof value.activeProjectId === 'string' && projects.has(value.activeProjectId)
    ? value.activeProjectId
    : [...projects.keys()][0] ?? ''
  let activeCanvasId = typeof value.activeCanvasId === 'string' && canvases.some((canvas) => canvas.id === value.activeCanvasId && canvas.projectId === activeProjectId)
    ? value.activeCanvasId
    : canvases.find((canvas) => canvas.projectId === activeProjectId)?.id ?? ''
  if (!activeProjectId && activeCanvasId) {
    activeProjectId = canvases.find((canvas) => canvas.id === activeCanvasId)?.projectId ?? ''
    activeCanvasId = ''
  }

  return {
    version: 1,
    projects: [...projects.values()],
    canvases,
    activeProjectId,
    activeCanvasId,
    // 缺省/脏数据回落到新默认（canvas + bottom）；显式保存过的 grid/right 仍尊重老用户偏好。
    viewMode: value.viewMode === 'grid' ? 'grid' : 'canvas',
    inputDockPosition: value.inputDockPosition === 'right' ? 'right' : 'bottom',
  }
}

/** 统一任务归属：画布所属项目优先，其次项目第一个画布，最后默认项目/画布 */
export function resolveTaskOwnership(task: Pick<TaskRecord, 'projectId' | 'canvasId'>, workspace: WorkspaceState): { projectId: string; canvasId: string } {
  const canvasById = new Map(workspace.canvases.map((canvas) => [canvas.id, canvas]))
  const projectIds = new Set(workspace.projects.map((project) => project.id))
  const canvas = task.canvasId ? canvasById.get(task.canvasId) : undefined
  if (canvas && (!task.projectId || canvas.projectId === task.projectId)) {
    return { projectId: canvas.projectId, canvasId: canvas.id }
  }
  if (task.projectId && projectIds.has(task.projectId)) {
    const firstCanvas = workspace.canvases.find((item) => item.projectId === task.projectId)
    return { projectId: task.projectId, canvasId: firstCanvas?.id ?? '' }
  }
  const fallbackCanvas = workspace.canvases.find((item) => item.id === DEFAULT_CANVAS_ID)
    ?? workspace.canvases.find((item) => item.projectId === DEFAULT_PROJECT_ID)
    ?? workspace.canvases[0]
  if (fallbackCanvas) return { projectId: fallbackCanvas.projectId, canvasId: fallbackCanvas.id }
  const fallbackProject = workspace.projects.find((item) => item.id === DEFAULT_PROJECT_ID) ?? workspace.projects[0]
  return { projectId: fallbackProject?.id ?? '', canvasId: '' }
}

/** 旧任务补归属：未知画布按项目第一个画布，未知项目回到默认项目/画布，非法 canvas 清除 */
export function migrateTasksToWorkspace<T extends Pick<TaskRecord, 'id' | 'projectId' | 'canvasId' | 'canvas'>>(tasks: T[], workspace: WorkspaceState): { tasks: T[]; changed: boolean } {
  let changed = false
  const next = tasks.map((task) => {
    const ownership = resolveTaskOwnership(task, workspace)
    const invalidCanvas = task.canvas != null && (
      typeof task.canvas.x !== 'number' || !Number.isFinite(task.canvas.x) ||
      typeof task.canvas.y !== 'number' || !Number.isFinite(task.canvas.y) ||
      (task.canvas.w != null && (typeof task.canvas.w !== 'number' || !Number.isFinite(task.canvas.w) || task.canvas.w <= 0)) ||
      (task.canvas.h != null && (typeof task.canvas.h !== 'number' || !Number.isFinite(task.canvas.h) || task.canvas.h <= 0))
    )
    if (task.projectId === ownership.projectId && task.canvasId === ownership.canvasId && !invalidCanvas) return task
    changed = true
    const nextTask = { ...task, ...ownership } as T & { canvas?: TaskRecord['canvas'] }
    if (invalidCanvas) delete nextTask.canvas
    return nextTask as T
  })
  return { tasks: next, changed }
}

/** 所有画布草稿引用到的图片，供启动/删除/隐私/清空时的 GC 使用 */
export function collectWorkspaceDraftImageIds(workspace: WorkspaceState): Set<string> {
  const ids = new Set<string>()
  for (const canvas of workspace.canvases) {
    for (const id of canvas.referenceImageIds ?? []) ids.add(id)
    for (const node of canvas.imageNodes ?? []) ids.add(node.imageId)
    if (canvas.maskDraft?.targetImageId) ids.add(canvas.maskDraft.targetImageId)
    if (canvas.maskEditorImageId) ids.add(canvas.maskEditorImageId)
  }
  return ids
}

/** workspace 持久化内容；关闭“重启保留输入”时剔除所有 composer 快照 */
export function getPersistedWorkspace(state: WorkspaceState, includeComposer: boolean): WorkspaceState {
  if (includeComposer) {
    return {
      version: state.version,
      projects: state.projects,
      canvases: state.canvases,
      activeProjectId: state.activeProjectId,
      activeCanvasId: state.activeCanvasId,
      viewMode: state.viewMode,
      inputDockPosition: state.inputDockPosition,
    }
  }
  return {
    version: state.version,
    projects: state.projects,
    canvases: state.canvases.map(({ promptDraft, paramsDraft, referenceImageIds, maskDraft, maskEditorImageId, activeSkillId, skillSlotValues, ...canvas }) => canvas),
    activeProjectId: state.activeProjectId,
    activeCanvasId: state.activeCanvasId,
    viewMode: state.viewMode,
    inputDockPosition: state.inputDockPosition,
  }
}

/** 默认画布快照是否有变化；用于导入时决定是否写回 workspace */
export function hasCanvasSnapshotChanged(current: ProjectCanvas | undefined, merged: ProjectCanvas | undefined) {
  if (!merged) return false
  if (!current) return true
  return current.promptDraft !== merged.promptDraft
    || current.activeSkillId !== merged.activeSkillId
    || JSON.stringify(current.skillSlotValues) !== JSON.stringify(merged.skillSlotValues)
    || current.maskEditorImageId !== merged.maskEditorImageId
    || JSON.stringify(current.paramsDraft) !== JSON.stringify(merged.paramsDraft)
    || JSON.stringify(current.referenceImageIds) !== JSON.stringify(merged.referenceImageIds)
    || JSON.stringify(current.imageNodes) !== JSON.stringify(merged.imageNodes)
    || JSON.stringify(current.removedImageIds) !== JSON.stringify(merged.removedImageIds)
    || JSON.stringify(current.maskDraft) !== JSON.stringify(merged.maskDraft)
    || JSON.stringify(current.viewport) !== JSON.stringify(merged.viewport)
}

export function getProjectCanvases(workspace: WorkspaceState, projectId: string) {
  return workspace.canvases.filter((canvas) => canvas.projectId === projectId)
}

/** 删除画布时的迁移目标：当前项目第一个画布 */
export function getProjectDefaultCanvas(workspace: WorkspaceState, projectId: string) {
  return getProjectCanvases(workspace, projectId)[0] ?? null
}

function uniqueId(base: string, used: Set<string>) {
  let id = base
  let suffix = 2
  while (used.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  used.add(id)
  return id
}

/** 导入任务时同 ID 不覆盖；返回可写入的新任务和被跳过的数量 */
export function splitNewTasks<T extends { id: string }>(tasks: T[], existingIds: Iterable<string>): { fresh: T[]; skipped: number } {
  const seen = new Set(existingIds)
  const fresh: T[] = []
  let skipped = 0
  for (const task of tasks) {
    if (seen.has(task.id)) {
      skipped += 1
      continue
    }
    seen.add(task.id)
    fresh.push(task)
  }
  return { fresh, skipped }
}

/** 默认画布导入时的快照合并：当前已有内容优先，空字段由导入值补齐 */
function mergeCanvasSnapshot(current: ProjectCanvas, imported: ProjectCanvas): ProjectCanvas {
  const promptDraft = current.promptDraft?.trim() ? current.promptDraft : imported.promptDraft ?? current.promptDraft
  const paramsDraft = current.paramsDraft || imported.paramsDraft
    ? { ...imported.paramsDraft, ...current.paramsDraft }
    : undefined
  const referenceImageIds = current.referenceImageIds?.length ? current.referenceImageIds : imported.referenceImageIds
  const imageNodes = (() => {
    const merged = [...(current.imageNodes ?? [])]
    const imageIds = new Set(merged.map((node) => node.imageId))
    for (const node of imported.imageNodes ?? []) {
      if (imageIds.has(node.imageId)) continue
      imageIds.add(node.imageId)
      merged.push(node)
    }
    return merged
  })()
  const removedImageIds = [...new Set([...(current.removedImageIds ?? []), ...(imported.removedImageIds ?? [])])]
  const activeSkillId = current.activeSkillId ?? imported.activeSkillId ?? null
  const skillSlotValues = current.activeSkillId ? current.skillSlotValues : imported.skillSlotValues ?? current.skillSlotValues
  return {
    ...current,
    ...(promptDraft !== undefined ? { promptDraft } : {}),
    ...(activeSkillId ? { activeSkillId } : {}),
    ...(skillSlotValues && Object.keys(skillSlotValues).length ? { skillSlotValues } : {}),
    ...(paramsDraft ? { paramsDraft } : {}),
    ...(referenceImageIds ? { referenceImageIds } : {}),
    ...(current.maskDraft ?? imported.maskDraft ? { maskDraft: current.maskDraft ?? imported.maskDraft } : {}),
    ...(current.maskEditorImageId ?? imported.maskEditorImageId ? { maskEditorImageId: current.maskEditorImageId ?? imported.maskEditorImageId } : {}),
    ...(imageNodes.length ? { imageNodes } : {}),
    ...(removedImageIds.length ? { removedImageIds } : {}),
    ...(current.viewport ?? imported.viewport ? { viewport: current.viewport ?? imported.viewport } : {}),
    updatedAt: Math.max(current.updatedAt, imported.updatedAt),
  }
}

/**
 * 导入备份中的项目/画布：默认项目/画布并入当前，其余 ID 冲突时重映射；
 * 返回的 tasks 已同步新的 projectId/canvasId。
 */
export function mergeImportedWorkspace<T extends Pick<TaskRecord, 'projectId' | 'canvasId'>>(current: WorkspaceState, imported: unknown, tasks: T[], now = Date.now()): { workspace: WorkspaceState; tasks: T[] } {
  if (!isRecord(imported)) {
    return {
      workspace: current,
      tasks: tasks.map((task) => ({ ...task, ...resolveTaskOwnership(task, current) })),
    }
  }

  const source = normalizeWorkspace(imported, now)
  const projects = current.projects.map((project) => ({ ...project }))
  const canvases = current.canvases.map((canvas) => ({ ...canvas }))
  const usedProjectIds = new Set(projects.map((project) => project.id))
  const usedCanvasIds = new Set(canvases.map((canvas) => canvas.id))
  const projectIdMap = new Map<string, string>()

  for (const project of source.projects) {
    // 默认项目始终并入当前默认项目，避免产生第二个“默认项目”
    if (project.id === DEFAULT_PROJECT_ID && usedProjectIds.has(DEFAULT_PROJECT_ID)) {
      projectIdMap.set(project.id, DEFAULT_PROJECT_ID)
      continue
    }
    const id = usedProjectIds.has(project.id) ? uniqueId(`${project.id}-imported`, usedProjectIds) : project.id
    projectIdMap.set(project.id, id)
    usedProjectIds.add(id)
    projects.push({ ...project, id })
  }

  const canvasIdMap = new Map<string, string>()
  for (const canvas of source.canvases) {
    const projectId = projectIdMap.get(canvas.projectId) ?? DEFAULT_PROJECT_ID
    const isCurrentDefault = canvas.id === DEFAULT_CANVAS_ID && usedCanvasIds.has(DEFAULT_CANVAS_ID) && projectId === DEFAULT_PROJECT_ID
    const id = isCurrentDefault ? DEFAULT_CANVAS_ID : usedCanvasIds.has(canvas.id) ? uniqueId(`${canvas.id}-imported`, usedCanvasIds) : canvas.id
    canvasIdMap.set(canvas.id, id)
    if (isCurrentDefault) {
      const index = canvases.findIndex((item) => item.id === DEFAULT_CANVAS_ID && item.projectId === DEFAULT_PROJECT_ID)
      if (index >= 0) canvases[index] = mergeCanvasSnapshot(canvases[index], { ...canvas, id: DEFAULT_CANVAS_ID, projectId: DEFAULT_PROJECT_ID })
      continue
    }
    usedCanvasIds.add(id)
    canvases.push({ ...canvas, id, projectId })
  }

  // 导入时不自动为每个项目补画布：项目可以没有画布，保留空状态

  const activeProjectId = projects.some((project) => project.id === current.activeProjectId) ? current.activeProjectId : projects[0]?.id ?? ''
  const activeCanvasId = canvases.some((canvas) => canvas.id === current.activeCanvasId && canvas.projectId === activeProjectId)
    ? current.activeCanvasId
    : canvases.find((canvas) => canvas.projectId === activeProjectId)?.id ?? ''
  const workspace: WorkspaceState = { version: 1, projects, canvases, activeProjectId, activeCanvasId, viewMode: current.viewMode, inputDockPosition: current.inputDockPosition }

  const remappedTasks = tasks.map((task) => {
    const mappedProjectId = task.projectId ? projectIdMap.get(task.projectId) : undefined
    const mappedCanvasId = task.canvasId ? canvasIdMap.get(task.canvasId) : undefined
    return {
      ...task,
      ...resolveTaskOwnership({ projectId: mappedProjectId, canvasId: mappedCanvasId }, workspace),
    }
  })

  return { workspace, tasks: remappedTasks }
}
