// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultWorkspace, DEFAULT_CANVAS_ID, DEFAULT_PROJECT_ID } from './workspaceState'

const STORAGE_KEY = 'panpan-workspace-v1'

beforeEach(() => {
  window.localStorage.clear()
  vi.resetModules()
})

describe('workspaceStore persistence', () => {
  it('drops composer snapshots from storage after input persistence is disabled', async () => {
    const { useWorkspaceStore, setWorkspaceComposerPersistence } = await import('./workspaceStore')
    const workspace = createDefaultWorkspace(1)
    useWorkspaceStore.setState({
      canvases: [{
        ...workspace.canvases[0],
        promptDraft: '提示词',
        paramsDraft: { n: 2 },
        referenceImageIds: ['image-a'],
        maskDraft: { targetImageId: 'image-a', maskDataUrl: 'data:image/png;base64,x', updatedAt: 1 },
        maskEditorImageId: 'image-a',
        viewport: { x: 1, y: 2, k: 1 },
      }],
    })

    setWorkspaceComposerPersistence(false)

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)
    const canvas = stored.state.canvases[0]
    expect(canvas).not.toHaveProperty('promptDraft')
    expect(canvas).not.toHaveProperty('paramsDraft')
    expect(canvas).not.toHaveProperty('referenceImageIds')
    expect(canvas).not.toHaveProperty('maskDraft')
    expect(canvas).not.toHaveProperty('maskEditorImageId')
    expect(canvas.viewport).toEqual({ x: 1, y: 2, k: 1 })
  })

  it('resetWorkspace restores the fixed default project and canvas', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore')
    useWorkspaceStore.setState({
      projects: [{ id: 'p1', name: 'P1', createdAt: 1, updatedAt: 1 }],
      canvases: [{ id: 'c1', projectId: 'p1', name: 'C1', order: 0, createdAt: 1, updatedAt: 1 }],
      activeProjectId: 'p1',
      activeCanvasId: 'c1',
    })

    useWorkspaceStore.getState().resetWorkspace()

    const state = useWorkspaceStore.getState()
    expect(state.activeProjectId).toBe(DEFAULT_PROJECT_ID)
    expect(state.activeCanvasId).toBe(DEFAULT_CANVAS_ID)
    expect(state.projects).toEqual([expect.objectContaining({ id: DEFAULT_PROJECT_ID })])
    expect(state.canvases).toEqual([expect.objectContaining({ id: DEFAULT_CANVAS_ID, projectId: DEFAULT_PROJECT_ID })])
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)
    expect(stored.state.activeCanvasId).toBe(DEFAULT_CANVAS_ID)
  })

  it('repairs corrupt persisted workspaces on hydration', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { projects: 'bad', canvases: [] }, version: 1 }))
    const { useWorkspaceStore } = await import('./workspaceStore')

    const state = useWorkspaceStore.getState()
    expect(state.projects).toEqual([expect.objectContaining({ id: DEFAULT_PROJECT_ID })])
    expect(state.canvases).toEqual([expect.objectContaining({ id: DEFAULT_CANVAS_ID, projectId: DEFAULT_PROJECT_ID })])
    expect(state.activeProjectId).toBe(DEFAULT_PROJECT_ID)
    expect(state.activeCanvasId).toBe(DEFAULT_CANVAS_ID)
  })

  it('creates, renames and removes projects and canvases through the store', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore')
    const first = useWorkspaceStore.getState().createProject('项目 A')
    expect(useWorkspaceStore.getState().activeProjectId).toBe(first.projectId)
    expect(useWorkspaceStore.getState().activeCanvasId).toBe(first.canvasId)

    const secondCanvas = useWorkspaceStore.getState().createCanvas(first.projectId, '画布 2')
    expect(useWorkspaceStore.getState().activeCanvasId).toBe(secondCanvas)
    useWorkspaceStore.getState().renameCanvas(secondCanvas, '新画布')
    useWorkspaceStore.getState().renameProject(first.projectId, '新项目')
    expect(useWorkspaceStore.getState().canvases.find((canvas) => canvas.id === secondCanvas)?.name).toBe('新画布')
    expect(useWorkspaceStore.getState().projects.find((project) => project.id === first.projectId)?.name).toBe('新项目')

    useWorkspaceStore.getState().removeCanvas(secondCanvas)
    expect(useWorkspaceStore.getState().canvases.some((canvas) => canvas.id === secondCanvas)).toBe(false)
    expect(useWorkspaceStore.getState().activeCanvasId).toBe(first.canvasId)

    useWorkspaceStore.getState().removeProject(first.projectId)
    expect(useWorkspaceStore.getState().projects.some((project) => project.id === first.projectId)).toBe(false)
    expect(useWorkspaceStore.getState().activeProjectId).toBe(DEFAULT_PROJECT_ID)
    expect(useWorkspaceStore.getState().activeCanvasId).toBe(DEFAULT_CANVAS_ID)
  })

  it('allows removing default and last projects/canvases without auto-recreating', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore')
    useWorkspaceStore.getState().removeCanvas(DEFAULT_CANVAS_ID)
    expect(useWorkspaceStore.getState().canvases.some((canvas) => canvas.id === DEFAULT_CANVAS_ID)).toBe(false)
    expect(useWorkspaceStore.getState().activeCanvasId).toBe('')

    const project = useWorkspaceStore.getState().createProject('只有一个画布')
    useWorkspaceStore.getState().removeCanvas(project.canvasId)
    const canvases = useWorkspaceStore.getState().canvases.filter((canvas) => canvas.projectId === project.projectId)
    expect(canvases).toHaveLength(0)
    expect(useWorkspaceStore.getState().activeCanvasId).toBe('')

    useWorkspaceStore.getState().removeProject(DEFAULT_PROJECT_ID)
    expect(useWorkspaceStore.getState().projects.some((item) => item.id === DEFAULT_PROJECT_ID)).toBe(false)
  })
})
