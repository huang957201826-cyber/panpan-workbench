// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Toast from './Toast'
import { useStore } from '../store'
import { clearCanvasUndo, createCanvasUndoEntry, pushCanvasUndo, runCanvasUndo } from '../lib/canvasUndo'

const canvasId = 'toast-undo-canvas'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

describe('Toast undo disabled state', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    clearCanvasUndo(canvasId)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => {
      useStore.setState({
        toast: {
          message: '已删除',
          type: 'success',
          action: { label: '撤销', run: () => {}, undoCanvasId: canvasId },
        },
      })
      root.render(<Toast />)
    })
  })

  afterEach(() => {
    act(() => {
      root.unmount()
      useStore.setState({ toast: null })
    })
    clearCanvasUndo(canvasId)
    container.remove()
  })

  it('hides when the shared undo entry is cleared', () => {
    const entry = createCanvasUndoEntry('delete', '删除', () => {})
    pushCanvasUndo(canvasId, entry)
    act(() => {
      useStore.setState({
        toast: {
          message: '已删除',
          type: 'success',
          action: { label: '撤销', run: () => {}, undoCanvasId: canvasId, undoEntryId: entry.id },
        },
      })
    })
    expect(container.querySelector('button')).not.toBeNull()

    act(() => {
      clearCanvasUndo(canvasId)
    })
    expect(container.querySelector('button')).toBeNull()
  })

  it('disables the undo action while the shared restore is running', async () => {
    const button = () => container.querySelector<HTMLButtonElement>('button')
    expect(button()?.disabled).toBe(false)

    const gate = deferred()
    const entry = createCanvasUndoEntry('delete', '删除', async () => { await gate.promise })
    pushCanvasUndo(canvasId, entry)
    let undo!: Promise<unknown>
    act(() => {
      undo = runCanvasUndo(canvasId)
    })
    expect(button()?.disabled).toBe(true)

    await act(async () => {
      gate.resolve()
      await undo
    })
    expect(button()?.disabled).toBe(false)
  })
})
