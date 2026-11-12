import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertCanvasUndoActive,
  clearCanvasUndo,
  createCanvasUndoEntry,
  getCanvasUndoDepth,
  isCanvasUndoing,
  pushCanvasUndo,
  runCanvasUndo,
} from './canvasUndo'

const canvasId = 'canvas-undo-test'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

describe('canvas undo registry', () => {
  beforeEach(() => {
    clearCanvasUndo(canvasId)
  })

  it('removes the entry only after restore succeeds', async () => {
    const restore = vi.fn()
    const entry = createCanvasUndoEntry('position', '移动', restore)
    pushCanvasUndo(canvasId, entry)
    expect(getCanvasUndoDepth(canvasId)).toBe(1)

    const result = await runCanvasUndo(canvasId)
    expect(result.entry?.id).toBe(entry.id)
    expect(restore).toHaveBeenCalledTimes(1)
    expect(getCanvasUndoDepth(canvasId)).toBe(0)
  })

  it('ignores a rapid second run while the first restore is pending', async () => {
    const gate = deferred()
    const restore = vi.fn(async ({ isActive }) => {
      await gate.promise
      assertCanvasUndoActive(isActive)
    })
    const entry = createCanvasUndoEntry('delete', '删除', restore)
    pushCanvasUndo(canvasId, entry)

    const first = runCanvasUndo(canvasId)
    const second = await runCanvasUndo(canvasId)
    expect(second).toEqual({ entry: null })
    expect(restore).toHaveBeenCalledTimes(1)
    expect(isCanvasUndoing(canvasId)).toBe(true)

    gate.resolve()
    expect((await first).entry?.id).toBe(entry.id)
    expect(isCanvasUndoing(canvasId)).toBe(false)
    expect(getCanvasUndoDepth(canvasId)).toBe(0)
  })

  it('does not run Toast and left-button undo at the same time', async () => {
    const gate = deferred()
    const older = vi.fn()
    const newer = vi.fn(async ({ isActive }) => {
      await gate.promise
      assertCanvasUndoActive(isActive)
    })
    const olderEntry = createCanvasUndoEntry('position', '移动', older)
    const newerEntry = createCanvasUndoEntry('delete', '删除', newer)
    pushCanvasUndo(canvasId, olderEntry)
    pushCanvasUndo(canvasId, newerEntry)

    const fromToast = runCanvasUndo(canvasId, newerEntry.id)
    const fromLeftButton = await runCanvasUndo(canvasId)
    expect(fromLeftButton).toEqual({ entry: null })
    expect(newer).toHaveBeenCalledTimes(1)
    expect(older).not.toHaveBeenCalled()

    gate.resolve()
    expect((await fromToast).entry?.id).toBe(newerEntry.id)
    expect(getCanvasUndoDepth(canvasId)).toBe(1)
    expect(isCanvasUndoing(canvasId)).toBe(false)
  })

  it('keeps the entry and reports an error when restore fails', async () => {
    let calls = 0
    const restore = vi.fn(async () => {
      calls += 1
      if (calls === 1) throw new Error('数据库写入失败')
    })
    const entry = createCanvasUndoEntry('delete', '删除', restore)
    pushCanvasUndo(canvasId, entry)

    const failed = await runCanvasUndo(canvasId)
    expect(failed.error).toBe('数据库写入失败')
    expect(failed.entry?.id).toBe(entry.id)
    expect(getCanvasUndoDepth(canvasId)).toBe(1)
    expect(isCanvasUndoing(canvasId)).toBe(false)

    const retried = await runCanvasUndo(canvasId)
    expect(retried.entry?.id).toBe(entry.id)
    expect(getCanvasUndoDepth(canvasId)).toBe(0)
  })

  it('cancels an in-flight restore when the canvas stack is cleared', async () => {
    const gate = deferred()
    let activeAtFinish = true
    const restore = vi.fn(async ({ isActive }) => {
      await gate.promise
      activeAtFinish = isActive()
      assertCanvasUndoActive(isActive)
    })
    pushCanvasUndo(canvasId, createCanvasUndoEntry('delete', '删除', restore))

    const running = runCanvasUndo(canvasId)
    expect(isCanvasUndoing(canvasId)).toBe(true)
    clearCanvasUndo(canvasId)
    gate.resolve()

    expect(await running).toEqual({ entry: null, cancelled: true })
    expect(activeAtFinish).toBe(false)
    expect(isCanvasUndoing(canvasId)).toBe(false)
    expect(getCanvasUndoDepth(canvasId)).toBe(0)
  })
})
