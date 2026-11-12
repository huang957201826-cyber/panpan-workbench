export type CanvasUndoKind = 'position' | 'delete'

export interface CanvasUndoContext {
  /** 画布被切换、删除或栈被清空后返回 false，restore 必须在每个 await 后检查 */
  isActive: () => boolean
}

export interface CanvasUndoEntry {
  id: string
  kind: CanvasUndoKind
  label: string
  restore: (context: CanvasUndoContext) => void | Promise<void>
}

export interface CanvasUndoResult {
  entry: CanvasUndoEntry | null
  error?: string
  cancelled?: boolean
}

/** 画布已被切换/删除时中断恢复，不当作失败保留 */
export class CanvasUndoCancelled extends Error {
  constructor() {
    super('撤销已取消')
  }
}

export function assertCanvasUndoActive(isActive: () => boolean) {
  if (!isActive()) throw new CanvasUndoCancelled()
}

const MAX_CANVAS_UNDO = 20
const stacks = new Map<string, CanvasUndoEntry[]>()
const activeTokens = new Map<string, { active: boolean }>()
const listeners = new Map<string, Set<() => void>>()

function notify(canvasId: string) {
  for (const listener of listeners.get(canvasId) ?? []) listener()
}

export function subscribeCanvasUndo(canvasId: string, listener: () => void) {
  if (!canvasId) return () => {}
  const group = listeners.get(canvasId) ?? new Set<() => void>()
  group.add(listener)
  listeners.set(canvasId, group)
  return () => {
    group.delete(listener)
    if (!group.size) listeners.delete(canvasId)
  }
}

export function getCanvasUndoDepth(canvasId: string) {
  return stacks.get(canvasId)?.length ?? 0
}

export function isCanvasUndoEntryAlive(canvasId: string, entryId: string) {
  return stacks.get(canvasId)?.some((entry) => entry.id === entryId) ?? false
}

export function isCanvasUndoing(canvasId: string) {
  return activeTokens.has(canvasId)
}

export function createCanvasUndoEntry(
  kind: CanvasUndoKind,
  label: string,
  restore: CanvasUndoEntry['restore'],
): CanvasUndoEntry {
  return { id: crypto.randomUUID(), kind, label, restore }
}

export function pushCanvasUndo(canvasId: string, entry: CanvasUndoEntry) {
  if (!canvasId) return
  const stack = stacks.get(canvasId) ?? []
  stack.push(entry)
  if (stack.length > MAX_CANVAS_UNDO) stack.shift()
  stacks.set(canvasId, stack)
  notify(canvasId)
}

function removeEntry(canvasId: string, entryId: string) {
  const stack = stacks.get(canvasId)
  if (!stack?.length) return
  const index = stack.findIndex((entry) => entry.id === entryId)
  if (index < 0) return
  stack.splice(index, 1)
  if (!stack.length) stacks.delete(canvasId)
  notify(canvasId)
}

function errorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message
  return String(err)
}

/**
 * 同一画布同时只跑一次撤销：快速双击、Toast 与左上按钮并发时后来者直接忽略。
 * 恢复成功后才移除条目；失败保留条目，由调用方提示。
 */
export async function runCanvasUndo(
  canvasId: string,
  entryId?: string,
  isCanvasAlive: () => boolean = () => true,
): Promise<CanvasUndoResult> {
  if (!canvasId || activeTokens.has(canvasId) || !isCanvasAlive()) return { entry: null }
  const stack = stacks.get(canvasId)
  if (!stack?.length) return { entry: null }
  const index = entryId ? stack.findIndex((entry) => entry.id === entryId) : stack.length - 1
  if (index < 0) return { entry: null }
  const entry = stack[index]
  const token = { active: true }
  activeTokens.set(canvasId, token)
  notify(canvasId)
  try {
    await entry.restore({ isActive: () => token.active })
    if (!token.active || !isCanvasAlive()) return { entry: null, cancelled: true }
    removeEntry(canvasId, entry.id)
    return { entry }
  } catch (err) {
    if (err instanceof CanvasUndoCancelled || !token.active) return { entry: null, cancelled: true }
    return { entry, error: errorMessage(err) }
  } finally {
    if (activeTokens.get(canvasId) === token) activeTokens.delete(canvasId)
    notify(canvasId)
  }
}

/** 清栈同时取消进行中的恢复，避免切画布后继续写入旧画布 */
export function clearCanvasUndo(canvasId: string) {
  const token = activeTokens.get(canvasId)
  if (token) token.active = false
  activeTokens.delete(canvasId)
  if (!stacks.delete(canvasId) && !token) return
  notify(canvasId)
}

/** 删除画布/项目后清掉不再存在的画布栈 */
export function retainCanvasUndo(canvasIds: Iterable<string>) {
  const keep = new Set(canvasIds)
  for (const canvasId of [...stacks.keys()]) {
    if (!keep.has(canvasId)) clearCanvasUndo(canvasId)
  }
}
