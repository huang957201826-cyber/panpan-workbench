import { invoke } from '@tauri-apps/api/core'
import type { TaskRecord, WorkspaceState } from '../types'
import { ensureDiskSpace } from './diskSpace'
import { isTauri } from './platform'
import { saveFileToDir, type SaveDir } from './saveFile'

export const DELETE_SNAPSHOT_PREFIX = 'delete-'
export const DELETE_SNAPSHOT_KEEP = 5

export interface DeleteSnapshot {
  name: string
  bytes: number
  modified: number
}

export function isDeleteSnapshotName(name: string) {
  return name.startsWith(DELETE_SNAPSHOT_PREFIX) && name.endsWith('.zip')
}

/** 删除快照只带这些任务的输入/输出/遮罩/中间图，不扫整个图库。 */
export function collectTaskAssetImageIds(tasks: TaskRecord[]) {
  const ids = new Set<string>()
  for (const task of tasks) {
    for (const id of task.inputImageIds ?? []) ids.add(id)
    if (task.maskImageId) ids.add(task.maskImageId)
    if (task.maskTargetImageId) ids.add(task.maskTargetImageId)
    for (const id of task.outputImages ?? []) ids.add(id)
    for (const id of task.transparentOriginalImages ?? []) if (id) ids.add(id)
    for (const id of task.streamPartialImageIds ?? []) ids.add(id)
  }
  return [...ids]
}

export interface DeleteSnapshotScope {
  type: 'task' | 'canvas' | 'project'
  projectId?: string
  canvasId?: string
}

/** 删除快照只保留目标项目/画布，避免无关画布的草稿图和引用图进入快照。 */
export function trimWorkspaceForDelete(
  workspace: WorkspaceState | undefined,
  tasks: TaskRecord[],
  scope: DeleteSnapshotScope = { type: 'task' },
): WorkspaceState | undefined {
  if (!workspace) return undefined
  const keepProjects = new Set<string>()
  const keepCanvases = new Set<string>()
  if (scope.type === 'canvas' && scope.canvasId) {
    keepCanvases.add(scope.canvasId)
    const canvas = workspace.canvases.find((item) => item.id === scope.canvasId)
    if (canvas) keepProjects.add(canvas.projectId)
  } else if (scope.type === 'project' && scope.projectId) {
    keepProjects.add(scope.projectId)
    for (const canvas of workspace.canvases) {
      if (canvas.projectId === scope.projectId) keepCanvases.add(canvas.id)
    }
  } else {
    for (const task of tasks) {
      if (task.projectId) keepProjects.add(task.projectId)
      if (task.canvasId) keepCanvases.add(task.canvasId)
    }
  }
  if (!keepProjects.size && !keepCanvases.size) return undefined
  const projects = workspace.projects.filter((project) => keepProjects.has(project.id))
  const canvases = workspace.canvases.filter((canvas) => keepCanvases.has(canvas.id))
  if (!canvases.length) return undefined
  const activeCanvasId = keepCanvases.has(workspace.activeCanvasId ?? '')
    ? workspace.activeCanvasId
    : canvases[0]?.id ?? null
  const activeProjectId = canvases.find((canvas) => canvas.id === activeCanvasId)?.projectId
    ?? projects[0]?.id
    ?? null
  return {
    ...workspace,
    projects,
    canvases,
    activeProjectId,
    activeCanvasId,
  }
}

export async function listDeleteSnapshots(): Promise<DeleteSnapshot[]> {
  if (!isTauri) return []
  const files = await invoke<DeleteSnapshot[]>('backup_list')
  return files
    .filter((file) => isDeleteSnapshotName(file.name))
    .sort((a, b) => b.modified - a.modified)
}

export async function pruneDeleteSnapshots(keep = DELETE_SNAPSHOT_KEEP) {
  if (!isTauri) return
  const files = await listDeleteSnapshots()
  for (const file of files.slice(keep)) {
    await invoke('backup_delete', { name: file.name })
  }
}

export async function writeDeleteSnapshot(bytes: Uint8Array): Promise<string | null> {
  if (!isTauri) return null
  await ensureDiskSpace('创建删除快照', bytes.byteLength)
  const dir = await invoke<SaveDir>('backups_dir_use')
  const name = `${DELETE_SNAPSHOT_PREFIX}${Date.now()}.zip`
  const saved = await saveFileToDir(dir, bytes, name)
  await pruneDeleteSnapshots()
  return saved
}

export async function readDeleteSnapshotFile(name: string): Promise<File> {
  const buffer = await invoke<ArrayBuffer>('backup_read', { name })
  return new File([new Uint8Array(buffer)], name, { type: 'application/zip' })
}
