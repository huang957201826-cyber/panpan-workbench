import { describe, expect, it } from 'vitest'
import type { WorkspaceState } from '../types'
import { collectWorkspaceDraftImageIds, createDefaultWorkspace, DEFAULT_CANVAS_ID, DEFAULT_PROJECT_ID, getPersistedWorkspace, getProjectDefaultCanvas, hasCanvasSnapshotChanged, mergeImportedWorkspace, migrateTasksToWorkspace, normalizeWorkspace, resolveTaskOwnership, splitNewTasks } from './workspaceState'

describe('workspaceState', () => {
  it('creates default project and canvas', () => {
    const workspace = createDefaultWorkspace(100)
    expect(workspace.projects).toEqual([{ id: DEFAULT_PROJECT_ID, name: '默认项目', createdAt: 100, updatedAt: 100 }])
    expect(workspace.canvases[0]).toMatchObject({ id: DEFAULT_CANVAS_ID, projectId: DEFAULT_PROJECT_ID, name: '画布 1', order: 0 })
    expect(workspace.activeProjectId).toBe(DEFAULT_PROJECT_ID)
    expect(workspace.activeCanvasId).toBe(DEFAULT_CANVAS_ID)
  })

  it('falls back to default workspace for invalid data', () => {
    expect(normalizeWorkspace(null, 100)).toEqual(createDefaultWorkspace(100))
    expect(normalizeWorkspace({ projects: 'bad' }, 100)).toEqual(createDefaultWorkspace(100))
  })

  it('new users start with the bottom prompt bar and infinite canvas', () => {
    expect(createDefaultWorkspace(100)).toMatchObject({ viewMode: 'canvas', inputDockPosition: 'bottom' })
    expect(normalizeWorkspace({ projects: 'bad' }, 100)).toMatchObject({ viewMode: 'canvas', inputDockPosition: 'bottom' })
  })

  it('keeps explicitly saved grid/right preferences for existing users', () => {
    const saved = { ...createDefaultWorkspace(1), viewMode: 'grid' as const, inputDockPosition: 'right' as const }
    expect(normalizeWorkspace(saved, 100)).toMatchObject({ viewMode: 'grid', inputDockPosition: 'right' })
  })

  it('keeps projects without auto-restoring default nodes', () => {
    const workspace = normalizeWorkspace({
      projects: [
        { id: 'p1', name: '项目一', createdAt: 1, updatedAt: 1 },
        { id: 'p2', name: '  ', createdAt: 2, updatedAt: 2 },
      ],
      canvases: [{ id: 'c1', projectId: 'p1', name: '主画布', order: 0, createdAt: 1, updatedAt: 1 }],
      activeProjectId: 'missing',
      activeCanvasId: 'missing',
    }, 100)

    expect(workspace.projects.map((project) => project.id)).toEqual(['p1', 'p2'])
    expect(workspace.projects[1].name).toBe('项目 2')
    expect(workspace.canvases.map((canvas) => canvas.id)).toEqual(['c1'])
    expect(workspace.activeProjectId).toBe('p1')
    expect(workspace.activeCanvasId).toBe('c1')
  })

  it('keeps a custom canvas without adding the default canvas', () => {
    const workspace = normalizeWorkspace({
      projects: [{ id: DEFAULT_PROJECT_ID, name: '默认项目', createdAt: 1, updatedAt: 1 }],
      canvases: [{ id: 'custom', projectId: DEFAULT_PROJECT_ID, name: '自定义画布', order: 0, createdAt: 1, updatedAt: 1 }],
      activeProjectId: DEFAULT_PROJECT_ID,
      activeCanvasId: 'custom',
    }, 100)

    expect(workspace.canvases.map((canvas) => canvas.id)).toEqual(['custom'])
    expect(workspace.activeProjectId).toBe(DEFAULT_PROJECT_ID)
    expect(workspace.activeCanvasId).toBe('custom')
  })

  it('does not let active canvas cross into another project', () => {
    const workspace = normalizeWorkspace({
      projects: [
        { id: 'a', name: 'A', createdAt: 1, updatedAt: 1 },
        { id: 'b', name: 'B', createdAt: 1, updatedAt: 1 },
      ],
      canvases: [{ id: 'b-canvas', projectId: 'b', name: 'B 画布', order: 0, createdAt: 1, updatedAt: 1 }],
      activeProjectId: 'a',
      activeCanvasId: 'b-canvas',
    }, 10)
    expect(workspace.activeProjectId).toBe('a')
    expect(workspace.activeCanvasId).toBe('')
  })

  it('keeps a valid project with no canvas when resolving task ownership', () => {
    const workspace = normalizeWorkspace({
      projects: [
        { id: 'a', name: 'A', createdAt: 1, updatedAt: 1 },
        { id: 'b', name: 'B', createdAt: 1, updatedAt: 1 },
      ],
      canvases: [{ id: 'b-canvas', projectId: 'b', name: 'B 画布', order: 0, createdAt: 1, updatedAt: 1 }],
      activeProjectId: 'b',
      activeCanvasId: 'b-canvas',
    }, 10)
    expect(resolveTaskOwnership({ projectId: 'a', canvasId: '' }, workspace)).toEqual({ projectId: 'a', canvasId: '' })
    expect(resolveTaskOwnership({ projectId: 'a', canvasId: 'b-canvas' }, workspace)).toEqual({ projectId: 'a', canvasId: '' })
  })

  it('does not auto-create canvases for imported projects', () => {
    const current = createDefaultWorkspace(1)
    const imported = {
      projects: [
        { id: 'a', name: 'A', createdAt: 1, updatedAt: 1 },
        { id: 'b', name: 'B', createdAt: 1, updatedAt: 1 },
      ],
      canvases: [{ id: 'b-canvas', projectId: 'b', name: 'B 画布', order: 0, createdAt: 1, updatedAt: 1 }],
      activeProjectId: 'a',
      activeCanvasId: '',
    }
    const merged = mergeImportedWorkspace(current, imported, [{ projectId: 'a', canvasId: 'b-canvas' }], 2)
    expect(merged.workspace.canvases.some((canvas) => canvas.projectId === 'a')).toBe(false)
    expect(merged.workspace.canvases.some((canvas) => canvas.id === 'b-canvas')).toBe(true)
    expect(merged.workspace.activeProjectId).toBe(current.activeProjectId)
    expect(merged.workspace.activeCanvasId).toBe(current.activeCanvasId)
    expect(merged.tasks[0]).toMatchObject({ projectId: 'a', canvasId: '' })
  })

  it('keeps an explicitly empty workspace empty', () => {
    const workspace = normalizeWorkspace({ projects: [], canvases: [], activeProjectId: '', activeCanvasId: '' }, 100)
    expect(workspace.projects).toEqual([])
    expect(workspace.canvases).toEqual([])
    expect(workspace.activeProjectId).toBe('')
    expect(workspace.activeCanvasId).toBe('')
  })

  it('normalizes canvas snapshots and clamps viewport', () => {
    const workspace = normalizeWorkspace({
      projects: [{ id: 'p1', name: 'P', createdAt: 1, updatedAt: 1 }],
      canvases: [{
        id: 'c1',
        projectId: 'p1',
        name: 'C',
        order: 0,
        viewport: { x: 10, y: 20, k: 0.001 },
        promptDraft: 'hello',
        paramsDraft: { quality: 'high', n: 2, unknown: 'drop' },
        referenceImageIds: ['a', 'a', 'b', 3],
        maskDraft: { targetImageId: 'a', maskDataUrl: 'data:image/png;base64,x', updatedAt: 3 },
        maskEditorImageId: 'b',
        createdAt: 1,
        updatedAt: 1,
      }],
      activeProjectId: 'p1',
      activeCanvasId: 'c1',
      viewMode: 'grid',
      inputDockPosition: 'right',
    }, 100)

    expect(workspace.canvases[0].viewport).toEqual({ x: 10, y: 20, k: 0.02 })
    expect(workspace.canvases[0].paramsDraft).toEqual({ quality: 'high', n: 2 })
    expect(workspace.canvases[0].referenceImageIds).toEqual(['a', 'b'])
    expect(workspace.canvases[0].maskDraft?.targetImageId).toBe('a')
  })

  it('keeps capability skill chip in the canvas snapshot and strips it when composer persistence is off', () => {
    const workspace = normalizeWorkspace({
      projects: [{ id: 'p1', name: 'P', createdAt: 1, updatedAt: 1 }],
      canvases: [{
        id: 'c1',
        projectId: 'p1',
        name: 'C',
        order: 0,
        activeSkillId: 'skill-1',
        skillSlotValues: { style: '极简', refs: ['img-1'], bad: { nested: true } },
        createdAt: 1,
        updatedAt: 1,
      }],
      activeProjectId: 'p1',
      activeCanvasId: 'c1',
    }, 100)

    const canvas = workspace.canvases[0]
    expect(canvas.activeSkillId).toBe('skill-1')
    expect(canvas.skillSlotValues).toEqual({ style: '极简', refs: ['img-1'] })
    expect(hasCanvasSnapshotChanged(canvas, { ...canvas, activeSkillId: 'skill-2' })).toBe(true)
    expect(hasCanvasSnapshotChanged(canvas, { ...canvas, skillSlotValues: { style: '复古' } })).toBe(true)

    const persisted = getPersistedWorkspace(workspace, false)
    expect(persisted.canvases[0].activeSkillId).toBeUndefined()
    expect(persisted.canvases[0].skillSlotValues).toBeUndefined()
  })

  it('migrates legacy tasks into the default project and canvas', () => {
    const workspace = createDefaultWorkspace(100)
    const { tasks, changed } = migrateTasksToWorkspace([
      { id: 't1' },
      { id: 't2', projectId: 'missing', canvasId: 'missing' },
    ], workspace)

    expect(changed).toBe(true)
    expect(tasks).toEqual([
      { id: 't1', projectId: DEFAULT_PROJECT_ID, canvasId: DEFAULT_CANVAS_ID },
      { id: 't2', projectId: DEFAULT_PROJECT_ID, canvasId: DEFAULT_CANVAS_ID },
    ])
  })

  it('keeps a valid task project and only fills canvas from the same project', () => {
    const workspace: WorkspaceState = {
      version: 1,
      projects: [
        { id: 'p1', name: 'P1', createdAt: 1, updatedAt: 1 },
        { id: 'p2', name: 'P2', createdAt: 1, updatedAt: 1 },
      ],
      canvases: [
        { id: 'c1', projectId: 'p1', name: 'C1', order: 0, createdAt: 1, updatedAt: 1 },
        { id: 'c2', projectId: 'p2', name: 'C2', order: 0, createdAt: 1, updatedAt: 1 },
      ],
      activeProjectId: 'p1',
      activeCanvasId: 'c1',
      viewMode: 'grid',
      inputDockPosition: 'right',
    }

    const { tasks } = migrateTasksToWorkspace([
      { id: 't1', projectId: 'p1', canvasId: 'c2' },
      { id: 't2', projectId: 'p2' },
    ], workspace)

    expect(tasks[0]).toMatchObject({ projectId: 'p1', canvasId: 'c1' })
    expect(tasks[1]).toMatchObject({ projectId: 'p2', canvasId: 'c2' })
  })

  it('clears invalid canvas positions', () => {
    const workspace = createDefaultWorkspace(100)
    const { tasks } = migrateTasksToWorkspace([
      { id: 't1', projectId: DEFAULT_PROJECT_ID, canvasId: DEFAULT_CANVAS_ID, canvas: { x: 1, y: 2, w: 0 } },
    ], workspace)

    expect(tasks[0].canvas).toBeUndefined()
  })

  it('collects draft image ids from every canvas', () => {
    const workspace: WorkspaceState = {
      version: 1,
      projects: [{ id: 'p1', name: 'P1', createdAt: 1, updatedAt: 1 }],
      canvases: [
        { id: 'c1', projectId: 'p1', name: 'C1', order: 0, referenceImageIds: ['a', 'b'], createdAt: 1, updatedAt: 1 },
        {
          id: 'c2',
          projectId: 'p1',
          name: 'C2',
          order: 1,
          referenceImageIds: ['c'],
          maskDraft: { targetImageId: 'd', maskDataUrl: 'data:image/png;base64,x', updatedAt: 1 },
          maskEditorImageId: 'e',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeProjectId: 'p1',
      activeCanvasId: 'c1',
      viewMode: 'grid',
      inputDockPosition: 'right',
    }

    expect([...collectWorkspaceDraftImageIds(workspace)].sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('returns the first canvas of a project as the migration target', () => {
    const workspace = createDefaultWorkspace(100)
    expect(getProjectDefaultCanvas(workspace, DEFAULT_PROJECT_ID)?.id).toBe(DEFAULT_CANVAS_ID)
    expect(getProjectDefaultCanvas(workspace, 'missing')).toBeNull()
  })

  it('merges imported default project and remaps conflicting non-default ids', () => {
    const current = createDefaultWorkspace(1)
    const imported: WorkspaceState = {
      version: 1,
      projects: [
        { id: DEFAULT_PROJECT_ID, name: '默认项目', createdAt: 2, updatedAt: 2 },
        { id: 'p1', name: '导入项目', createdAt: 2, updatedAt: 2 },
      ],
      canvases: [
        { id: DEFAULT_CANVAS_ID, projectId: DEFAULT_PROJECT_ID, name: '画布 1', order: 0, createdAt: 2, updatedAt: 2 },
        { id: 'c1', projectId: 'p1', name: '导入画布', order: 0, createdAt: 2, updatedAt: 2 },
      ],
      activeProjectId: 'p1',
      activeCanvasId: 'c1',
      viewMode: 'grid',
      inputDockPosition: 'right',
    }

    const first = mergeImportedWorkspace(current, imported, [
      { projectId: DEFAULT_PROJECT_ID, canvasId: DEFAULT_CANVAS_ID },
      { projectId: 'p1', canvasId: 'c1' },
    ], 100)
    expect(first.workspace.projects.map((project) => project.id)).toEqual([DEFAULT_PROJECT_ID, 'p1'])
    expect(first.workspace.canvases.map((canvas) => canvas.id)).toEqual([DEFAULT_CANVAS_ID, 'c1'])
    expect(first.tasks).toEqual([
      { projectId: DEFAULT_PROJECT_ID, canvasId: DEFAULT_CANVAS_ID },
      { projectId: 'p1', canvasId: 'c1' },
    ])

    const second = mergeImportedWorkspace(first.workspace, imported, [
      { projectId: 'p1', canvasId: 'c1' },
    ], 200)
    expect(second.workspace.projects.map((project) => project.id)).toEqual([DEFAULT_PROJECT_ID, 'p1', 'p1-imported'])
    expect(second.workspace.canvases.map((canvas) => canvas.id)).toEqual([DEFAULT_CANVAS_ID, 'c1', 'c1-imported'])
    expect(second.tasks).toEqual([{ projectId: 'p1-imported', canvasId: 'c1-imported' }])
    expect(second.workspace.activeProjectId).toBe(DEFAULT_PROJECT_ID)
    expect(second.workspace.activeCanvasId).toBe(DEFAULT_CANVAS_ID)
  })

  it('maps imported tasks to the current default workspace when backup has no workspace', () => {
    const current = createDefaultWorkspace(1)
    const { workspace, tasks } = mergeImportedWorkspace(current, undefined, [
      { projectId: 'unknown', canvasId: 'unknown' },
    ], 100)
    expect(workspace).toBe(current)
    expect(tasks).toEqual([{ projectId: DEFAULT_PROJECT_ID, canvasId: DEFAULT_CANVAS_ID }])
  })

  it('skips imported tasks whose ids already exist, including duplicates inside the backup', () => {
    const { fresh, skipped } = splitNewTasks([
      { id: 'a' },
      { id: 'b' },
      { id: 'a' },
      { id: 'c' },
    ], ['b'])

    expect(fresh).toEqual([{ id: 'a' }, { id: 'c' }])
    expect(skipped).toBe(2)
  })

  it('resolves a known project with a missing canvas to that project first canvas', () => {
    const workspace: WorkspaceState = {
      version: 1,
      projects: [
        { id: DEFAULT_PROJECT_ID, name: '默认项目', createdAt: 1, updatedAt: 1 },
        { id: 'p2', name: 'P2', createdAt: 1, updatedAt: 1 },
      ],
      canvases: [
        { id: DEFAULT_CANVAS_ID, projectId: DEFAULT_PROJECT_ID, name: '画布 1', order: 0, createdAt: 1, updatedAt: 1 },
        { id: 'c2', projectId: 'p2', name: 'C2', order: 1, createdAt: 1, updatedAt: 1 },
      ],
      activeProjectId: DEFAULT_PROJECT_ID,
      activeCanvasId: DEFAULT_CANVAS_ID,
      viewMode: 'grid',
      inputDockPosition: 'right',
    }

    expect(resolveTaskOwnership({ projectId: 'p2', canvasId: 'missing' }, workspace)).toEqual({ projectId: 'p2', canvasId: 'c2' })
    expect(mergeImportedWorkspace(workspace, undefined, [{ projectId: 'p2', canvasId: 'missing' }], 100).tasks).toEqual([
      { projectId: 'p2', canvasId: 'c2' },
    ])
  })

  it('keeps the task project when its canvas belongs to another project after import', () => {
    const current = createDefaultWorkspace(1)
    const imported: WorkspaceState = {
      version: 1,
      projects: [
        { id: DEFAULT_PROJECT_ID, name: '默认项目', createdAt: 2, updatedAt: 2 },
        { id: 'p1', name: 'P1', createdAt: 2, updatedAt: 2 },
        { id: 'p2', name: 'P2', createdAt: 2, updatedAt: 2 },
      ],
      canvases: [
        { id: DEFAULT_CANVAS_ID, projectId: DEFAULT_PROJECT_ID, name: '画布 1', order: 0, createdAt: 2, updatedAt: 2 },
        { id: 'c1', projectId: 'p1', name: 'C1', order: 1, createdAt: 2, updatedAt: 2 },
        { id: 'c2', projectId: 'p2', name: 'C2', order: 2, createdAt: 2, updatedAt: 2 },
      ],
      activeProjectId: DEFAULT_PROJECT_ID,
      activeCanvasId: DEFAULT_CANVAS_ID,
      viewMode: 'grid',
      inputDockPosition: 'right',
    }

    const result = mergeImportedWorkspace(current, imported, [{ projectId: 'p1', canvasId: 'c2' }], 100)
    expect(result.tasks).toEqual([{ projectId: 'p1', canvasId: 'c1' }])
  })

  it('merges imported default canvas snapshots without overwriting current content', () => {
    const current = createDefaultWorkspace(1)
    current.canvases[0] = {
      ...current.canvases[0],
      promptDraft: '当前提示词',
      paramsDraft: { quality: 'high' },
      referenceImageIds: ['current-image'],
    }
    const imported: WorkspaceState = {
      version: 1,
      projects: [{ id: DEFAULT_PROJECT_ID, name: '默认项目', createdAt: 2, updatedAt: 2 }],
      canvases: [{
        id: DEFAULT_CANVAS_ID,
        projectId: DEFAULT_PROJECT_ID,
        name: '画布 1',
        order: 0,
        promptDraft: '导入提示词',
        paramsDraft: { quality: 'low', n: 2 },
        referenceImageIds: ['imported-image'],
        maskDraft: { targetImageId: 'imported-image', maskDataUrl: 'data:image/png;base64,x', updatedAt: 2 },
        createdAt: 2,
        updatedAt: 2,
      }],
      activeProjectId: DEFAULT_PROJECT_ID,
      activeCanvasId: DEFAULT_CANVAS_ID,
      viewMode: 'grid',
      inputDockPosition: 'right',
    }

    const merged = mergeImportedWorkspace(current, imported, [], 100).workspace.canvases[0]
    expect(merged.promptDraft).toBe('当前提示词')
    expect(merged.paramsDraft).toEqual({ quality: 'high', n: 2 })
    expect(merged.referenceImageIds).toEqual(['current-image'])
    expect(merged.maskDraft?.targetImageId).toBe('imported-image')
  })

  it('strips composer snapshots when input persistence is disabled', () => {
    const workspace = createDefaultWorkspace(1)
    workspace.canvases[0] = {
      ...workspace.canvases[0],
      promptDraft: 'p',
      paramsDraft: { n: 2 },
      referenceImageIds: ['a'],
      maskDraft: { targetImageId: 'a', maskDataUrl: 'data:image/png;base64,x', updatedAt: 1 },
      maskEditorImageId: 'a',
      viewport: { x: 1, y: 2, k: 1 },
    }

    expect(getPersistedWorkspace(workspace, true).canvases[0].promptDraft).toBe('p')
    const stripped = getPersistedWorkspace(workspace, false).canvases[0]
    expect(stripped).not.toHaveProperty('promptDraft')
    expect(stripped).not.toHaveProperty('paramsDraft')
    expect(stripped).not.toHaveProperty('referenceImageIds')
    expect(stripped).not.toHaveProperty('maskDraft')
    expect(stripped).not.toHaveProperty('maskEditorImageId')
    expect(stripped.viewport).toEqual({ x: 1, y: 2, k: 1 })
  })

  it('detects default canvas snapshot changes', () => {
    const current = createDefaultWorkspace(1).canvases[0]
    expect(hasCanvasSnapshotChanged(current, { ...current })).toBe(false)
    expect(hasCanvasSnapshotChanged(current, { ...current, promptDraft: 'new' })).toBe(true)
    expect(hasCanvasSnapshotChanged(current, { ...current, referenceImageIds: ['a'] })).toBe(true)
    expect(hasCanvasSnapshotChanged(current, { ...current, viewport: { x: 1, y: 2, k: 1 } })).toBe(true)
    expect(hasCanvasSnapshotChanged(current, { ...current, imageNodes: [{ id: 'n1', imageId: 'img1', x: 0, y: 0, w: 100, h: 80 }] })).toBe(true)
  })

  it('normalizes and keeps canvas image nodes for each canvas', () => {
    const workspace = normalizeWorkspace({
      projects: [{ id: 'p1', name: '项目', createdAt: 1, updatedAt: 1 }],
      canvases: [
        { id: 'c1', projectId: 'p1', name: '画布 1', order: 0, imageNodes: [{ id: 'n1', imageId: 'img1', x: 10, y: 20, w: 100, h: 80 }], createdAt: 1, updatedAt: 1 },
        { id: 'c2', projectId: 'p1', name: '画布 2', order: 1, imageNodes: [{ id: 'n2', imageId: 'img2', x: 0, y: 0, w: 120, h: 90 }], createdAt: 2, updatedAt: 2 },
      ],
      activeProjectId: 'p1',
      activeCanvasId: 'c1',
    }, 10)
    expect(workspace.canvases.find((canvas) => canvas.id === 'c1')?.imageNodes?.[0].imageId).toBe('img1')
    expect(workspace.canvases.find((canvas) => canvas.id === 'c2')?.imageNodes?.[0].imageId).toBe('img2')
    expect([...collectWorkspaceDraftImageIds(workspace)].sort()).toEqual(['img1', 'img2'])
  })

  it('keeps image nodes when composer snapshots are stripped', () => {
    const workspace = createDefaultWorkspace(1)
    workspace.canvases[0] = {
      ...workspace.canvases[0],
      promptDraft: 'p',
      referenceImageIds: ['a'],
      imageNodes: [{ id: 'n1', imageId: 'img1', x: 0, y: 0, w: 100, h: 80 }],
    }
    const stripped = getPersistedWorkspace(workspace, false).canvases[0]
    expect(stripped).not.toHaveProperty('promptDraft')
    expect(stripped).not.toHaveProperty('referenceImageIds')
    expect(stripped.imageNodes).toEqual([{ id: 'n1', imageId: 'img1', x: 0, y: 0, w: 100, h: 80 }])
  })

  it('keeps image nodes when importing a canvas', () => {
    const current = createDefaultWorkspace(1)
    const imported = {
      projects: [{ id: 'default-project', name: '默认项目', createdAt: 1, updatedAt: 1 }],
      canvases: [{
        id: 'imported-canvas',
        projectId: 'default-project',
        name: '导入画布',
        order: 0,
        imageNodes: [{ id: 'node-1', imageId: 'img-1', x: 10, y: 20, w: 100, h: 80 }],
        referenceImageIds: ['img-1'],
        createdAt: 1,
        updatedAt: 1,
      }],
      activeProjectId: 'default-project',
      activeCanvasId: 'imported-canvas',
    }
    const merged = mergeImportedWorkspace(current, imported, [], 2).workspace
    const canvas = merged.canvases.find((item) => item.id === 'imported-canvas')
    expect(canvas?.imageNodes).toEqual([{ id: 'node-1', imageId: 'img-1', x: 10, y: 20, w: 100, h: 80 }])
    expect(canvas?.referenceImageIds).toEqual(['img-1'])
  })
})
