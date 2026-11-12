import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskRecord } from '../types'
import { clearCanvasUndo, createCanvasUndoEntry, getCanvasUndoDepth, pushCanvasUndo, runCanvasUndo } from './canvasUndo'
import { restoreTaskDeleteEntry, type TaskDeleteUndo } from './taskActions'

const mocks = vi.hoisted(() => {
  const storeImage = vi.fn()
  const putTask = vi.fn()
  const ensureImageCached = vi.fn()
  const getStoreState = vi.fn()
  const getWorkspaceState = vi.fn()
  return { storeImage, putTask, ensureImageCached, getStoreState, getWorkspaceState }
})

vi.mock('./db', () => ({ storeImage: mocks.storeImage, putTask: mocks.putTask }))
vi.mock('./imageCache', () => ({ ensureImageCached: mocks.ensureImageCached }))
vi.mock('./workspaceStore', () => ({ useWorkspaceStore: { getState: mocks.getWorkspaceState } }))
vi.mock('./downloadImages', () => ({
  downloadImageEntriesAsZip: vi.fn(),
  downloadImageIds: vi.fn(),
  getImageZipEntries: vi.fn(),
}))
vi.mock('./capabilitySkills', () => ({ skillCoverColor: vi.fn(() => '#000') }))
vi.mock('./capabilitySkillStore', () => ({ useCapabilitySkillStore: { getState: vi.fn() } }))
vi.mock('./canvasImageNodes', () => ({ removeCanvasImageNodes: vi.fn() }))
vi.mock('../store', () => ({
  useStore: { getState: mocks.getStoreState },
  editOutputs: vi.fn(),
  removeMultipleTasks: vi.fn(),
  removeTask: vi.fn(),
  reuseConfig: vi.fn(),
  retryTask: vi.fn(),
}))

const canvasId = 'canvas-delete-test'
const task = {
  id: 'task-1',
  canvasId,
  outputImages: ['image-1'],
  inputImageIds: [],
  status: 'done',
} as unknown as TaskRecord

const entry: TaskDeleteUndo = {
  tasks: [task],
  images: [{ id: 'image-1', dataUrl: 'data:image/png;base64,AA==' }],
  canvasId,
}

function setCanvasExists(exists: boolean) {
  mocks.getWorkspaceState.mockReturnValue({
    canvases: exists ? [{ id: canvasId }] : [],
    updateCanvas: vi.fn(),
  })
}

function deleteUndoEntry() {
  return createCanvasUndoEntry('delete', '删除', ({ isActive }) => restoreTaskDeleteEntry(entry, isActive))
}

describe('task delete undo failure handling', () => {
  beforeEach(() => {
    clearCanvasUndo(canvasId)
    vi.clearAllMocks()
    mocks.getStoreState.mockReturnValue({
      tasks: [],
      setTasks: vi.fn(),
      showToast: vi.fn(),
    })
    setCanvasExists(true)
  })

  it('keeps the delete entry when storeImage fails', async () => {
    mocks.storeImage.mockRejectedValue(new Error('磁盘已满'))
    const undo = deleteUndoEntry()
    pushCanvasUndo(canvasId, undo)

    const result = await runCanvasUndo(canvasId)
    expect(result.error).toBe('磁盘已满')
    expect(getCanvasUndoDepth(canvasId)).toBe(1)
    expect(mocks.putTask).not.toHaveBeenCalled()
    expect(mocks.getStoreState().setTasks).not.toHaveBeenCalled()
  })

  it('keeps the delete entry when dbPutTask fails', async () => {
    mocks.storeImage.mockResolvedValue(undefined)
    mocks.putTask.mockRejectedValue(new Error('数据库写入失败'))
    const undo = deleteUndoEntry()
    pushCanvasUndo(canvasId, undo)

    const result = await runCanvasUndo(canvasId)
    expect(result.error).toBe('数据库写入失败')
    expect(getCanvasUndoDepth(canvasId)).toBe(1)
    expect(mocks.getStoreState().setTasks).not.toHaveBeenCalled()
  })

  it('does not write tasks after the canvas was deleted during restore', async () => {
    let finish!: () => void
    mocks.storeImage.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    const undo = deleteUndoEntry()
    pushCanvasUndo(canvasId, undo)

    const running = runCanvasUndo(canvasId, undo.id, () => mocks.getWorkspaceState().canvases.length > 0)
    setCanvasExists(false)
    clearCanvasUndo(canvasId)
    finish()

    expect(await running).toEqual({ entry: null, cancelled: true })
    expect(mocks.getStoreState().setTasks).not.toHaveBeenCalled()
    expect(getCanvasUndoDepth(canvasId)).toBe(0)
  })

  it('stops before the next task write when cancelled after a partial write', async () => {
    mocks.storeImage.mockResolvedValue(undefined)
    let finish!: () => void
    mocks.putTask
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve }))
    const secondTask = { ...task, id: 'task-2' } as TaskRecord
    const thirdTask = { ...task, id: 'task-3' } as TaskRecord
    const partialEntry: TaskDeleteUndo = { tasks: [task, secondTask, thirdTask], images: [], canvasId }
    const undo = createCanvasUndoEntry('delete', '删除', ({ isActive }) => restoreTaskDeleteEntry(partialEntry, isActive))
    pushCanvasUndo(canvasId, undo)

    const running = runCanvasUndo(canvasId, undo.id, () => mocks.getWorkspaceState().canvases.length > 0)
    await vi.waitFor(() => expect(mocks.putTask).toHaveBeenCalledTimes(2))
    setCanvasExists(false)
    clearCanvasUndo(canvasId)
    finish()

    expect(await running).toEqual({ entry: null, cancelled: true })
    // 取消前已完成/进行中的两条写入无法回滚（known-limit），但不会再开始第三条
    expect(mocks.putTask).toHaveBeenCalledTimes(2)
    expect(mocks.getStoreState().setTasks).not.toHaveBeenCalled()
    expect(getCanvasUndoDepth(canvasId)).toBe(0)
  })
})
