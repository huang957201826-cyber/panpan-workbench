/**
 * 保存的工作流：可关联工作区项目的一条可复用配置。
 * 与预置模板分开：预置只读，用户改动落在 ProjectWorkflow 上。
 */
import type { WorkflowHistoryRecord } from '../modules/workflow/types'
import { call, getSavedWorkflows, replaceSavedWorkflows } from '../../lib/dbTauri'
import { isTauri } from '../../lib/platform'

export interface ProjectWorkflowResult {
  /** 输出图在 IndexedDB 中的 id，重启后靠它还原缩略图与原图 */
  imageId: string
  inputImageId?: string
  /** 不含 blob 地址的完整运行记录，图片用上面的 id 还原 */
  record: Omit<WorkflowHistoryRecord, 'inputUrl' | 'outputUrl' | 'batchUrls'>
  createdAt: number
  missingImageIds?: string[]
}

export interface ProjectWorkflow {
  id: string
  workspaceProjectId: string | null
  presetId: string
  name: string
  values: Record<string, string | number | boolean>
  results: ProjectWorkflowResult[]
  lastRunAt?: number
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'panpan-project-workflows-v1'
export const SAVED_WORKFLOWS_MIGRATION_KEY = 'saved-workflows-migrated-v2'

let cache: ProjectWorkflow[] = []
let initialization: Promise<void> | null = null

type LegacyProjectWorkflow = Omit<ProjectWorkflow, 'workspaceProjectId'> & {
  projectId?: string
  workspaceProjectId?: string | null
}

function normalizeWorkflow(value: LegacyProjectWorkflow): ProjectWorkflow | null {
  if (!value || typeof value !== 'object') return null
  if (typeof value.id !== 'string' || !value.id) return null
  if (typeof value.name !== 'string' || typeof value.presetId !== 'string') return null
  const workspaceProjectId = typeof value.workspaceProjectId === 'string' && value.workspaceProjectId
    ? value.workspaceProjectId
    : value.projectId && value.projectId !== 'workflow' && value.projectId !== 'draft'
      ? value.projectId
      : null
  const now = Date.now()
  return {
    id: value.id,
    workspaceProjectId,
    presetId: value.presetId,
    name: value.name,
    values: value.values && typeof value.values === 'object' && !Array.isArray(value.values)
      ? value.values
      : {},
    results: Array.isArray(value.results) ? value.results.filter((result) => result && typeof result === 'object') : [],
    ...(typeof value.lastRunAt === 'number' && Number.isFinite(value.lastRunAt) ? { lastRunAt: value.lastRunAt } : {}),
    createdAt: typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : now,
  }
}

function normalizeWorkflows(value: unknown): ProjectWorkflow[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: ProjectWorkflow[] = []
  for (const item of value) {
    const workflow = normalizeWorkflow(item as LegacyProjectWorkflow)
    if (!workflow || seen.has(workflow.id)) continue
    seen.add(workflow.id)
    result.push(workflow)
  }
  return result
}

function readLegacyWorkflows(): ProjectWorkflow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return normalizeWorkflows(JSON.parse(raw))
  } catch {
    return []
  }
}

function writeLegacyWorkflows(list: ProjectWorkflow[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (err) {
    console.warn('保存工作流失败：', err)
  }
}

async function initializeTauriWorkflows() {
  const kv = await call<Record<string, string>>('kv_get_all')
  const workflows = normalizeWorkflows(await getSavedWorkflows<LegacyProjectWorkflow>())
  if (kv[SAVED_WORKFLOWS_MIGRATION_KEY] === '1') {
    cache = workflows
    return
  }
  const legacy = readLegacyWorkflows()
  const migrated = legacy.length ? legacy : workflows
  if (legacy.length) await replaceSavedWorkflows(migrated)
  await call('kv_set', { key: SAVED_WORKFLOWS_MIGRATION_KEY, value: '1' })
  cache = migrated
}

export function initializeSavedWorkflows(): Promise<void> {
  if (!isTauri) {
    cache = readLegacyWorkflows()
    return Promise.resolve()
  }
  if (!initialization) initialization = initializeTauriWorkflows()
  return initialization
}

async function persistAll(list: ProjectWorkflow[]) {
  cache = normalizeWorkflows(list)
  if (isTauri) await replaceSavedWorkflows(cache)
  else writeLegacyWorkflows(cache)
}

export function listWorkflows(): ProjectWorkflow[] {
  return [...cache].sort((a, b) => (b.lastRunAt ?? b.updatedAt) - (a.lastRunAt ?? a.updatedAt))
}

export function listByProject(projectId: string): ProjectWorkflow[] {
  return listWorkflows().filter((item) => item.workspaceProjectId === projectId)
}

export async function createWorkflow(input: {
  workspaceProjectId?: string | null
  presetId: string
  name: string
  values: Record<string, string | number | boolean>
}): Promise<ProjectWorkflow> {
  const now = Date.now()
  const entry: ProjectWorkflow = {
    id: `wf-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    workspaceProjectId: input.workspaceProjectId ?? null,
    presetId: input.presetId,
    name: input.name,
    values: input.values,
    results: [],
    createdAt: now,
    updatedAt: now,
  }
  await persistAll([entry, ...cache])
  return entry
}

export async function updateWorkflow(id: string, patch: Partial<ProjectWorkflow>): Promise<void> {
  const list = [...cache]
  const index = list.findIndex((item) => item.id === id)
  if (index < 0) return
  list[index] = { ...list[index], ...patch, updatedAt: Date.now() }
  await persistAll(list)
}

/** 追加一条运行结果；只保留最近 30 条，避免 localStorage 无限增长 */
export async function addWorkflowResult(id: string, result: ProjectWorkflowResult): Promise<void> {
  const list = [...cache]
  const index = list.findIndex((item) => item.id === id)
  if (index < 0) return
  const entry = list[index]
  const results = [result, ...(entry.results ?? [])].slice(0, 30)
  list[index] = { ...entry, results, lastRunAt: result.createdAt, updatedAt: Date.now() }
  await persistAll(list)
}

export async function removeWorkflowResult(id: string, recordId: string): Promise<ProjectWorkflowResult | undefined> {
  const list = [...cache]
  const index = list.findIndex((item) => item.id === id)
  if (index < 0) return
  const entry = list[index]
  const results = (entry.results ?? []).filter((result) => result.record?.id !== recordId)
  const removed = (entry.results ?? []).find((result) => result.record?.id === recordId)
  list[index] = { ...entry, results, updatedAt: Date.now() }
  await persistAll(list)
  return removed
}

export async function removeWorkflow(id: string): Promise<void> {
  await persistAll(cache.filter((item) => item.id !== id))
}

export async function renameWorkflow(id: string, name: string): Promise<void> {
  await updateWorkflow(id, { name: name.trim() || '未命名工作流' })
}

export async function replaceWorkflows(workflows: ProjectWorkflow[]): Promise<void> {
  await persistAll(workflows)
}

export function setSavedWorkflowCache(workflows: ProjectWorkflow[]) {
  cache = normalizeWorkflows(workflows)
}
