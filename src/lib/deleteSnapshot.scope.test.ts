import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PARAMS, type TaskRecord } from '../types'
import { createDefaultWorkspace } from './workspaceState'
import { useWorkspaceStore } from './workspaceStore'
import { getAllImageIds, getAllTasks } from './db'
import { readExportImages } from './exportImages'
import { buildExportZip } from './exportZip'
import { writeDeleteSnapshot } from './deleteSnapshot'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => 'dpapi:v1:x'), isTauri: () => true }))
vi.mock('./platform', async (importOriginal) => ({
  ...await importOriginal<typeof import('./platform')>(),
  isTauri: true,
}))
vi.mock('./db', async (importOriginal) => ({
  ...await importOriginal<typeof import('./db')>(),
  getAllTasks: vi.fn(),
  getAllImageIds: vi.fn(),
}))
vi.mock('./exportImages', () => ({
  getExportImageSizes: vi.fn(async (ids: string[]) => ids.map((id) => ({ id, bytes: 1 }))),
  readExportImages: vi.fn(async (ids: string[]) => ({
    images: ids.map((id) => ({ id, dataUrl: `data:image/png;base64,${id}` })),
    thumbnailsByImageId: {},
  })),
}))
vi.mock('./exportZip', async (importOriginal) => ({
  ...await importOriginal<typeof import('./exportZip')>(),
  buildExportZip: vi.fn(async () => ({ bytes: new Uint8Array([1, 2, 3]) })),
}))
vi.mock('./deleteSnapshot', async (importOriginal) => ({
  ...await importOriginal<typeof import('./deleteSnapshot')>(),
  writeDeleteSnapshot: vi.fn(async () => 'data/backups/delete-test.zip'),
}))

import { createDeleteSnapshot, useStore } from '../store'

function task(id: string, images: { input?: string[]; output?: string[] } = {}): TaskRecord {
  return {
    id,
    prompt: id,
    params: { ...DEFAULT_PARAMS },
    inputImageIds: images.input ?? [],
    maskTargetImageId: null,
    maskImageId: null,
    outputImages: images.output ?? [],
    status: 'error',
    error: null,
    createdAt: 1,
    finishedAt: 2,
    elapsed: 1,
    sourceMode: 'gallery',
  }
}

describe('delete snapshot scope', () => {
  beforeEach(() => {
    vi.mocked(writeDeleteSnapshot).mockClear()
    vi.mocked(buildExportZip).mockClear()
    vi.mocked(readExportImages).mockClear()
    useWorkspaceStore.setState(createDefaultWorkspace(1))
    useStore.setState({
      tasks: [],
      inputImages: [],
      galleryInputDraft: null,
      agentConversations: [],
      agentInputDrafts: {},
      favoriteCollections: [],
      defaultFavoriteCollectionId: null,
    })
  })

  it('allows deleting one task while the gallery has an unrelated 300MB image', async () => {
    vi.mocked(getAllTasks).mockResolvedValue([task('t1', { input: ['in-1'], output: ['out-1'] })])
    vi.mocked(getAllImageIds).mockResolvedValue(['in-1', 'out-1', 'unrelated-300mb'])
    await createDeleteSnapshot('单任务', ['t1'])
    expect(vi.mocked(readExportImages).mock.calls[0][0].sort()).toEqual(['in-1', 'out-1'])
    expect(writeDeleteSnapshot).toHaveBeenCalledOnce()
  })

  it('keeps image node assets in a canvas-only delete snapshot', async () => {
    useWorkspaceStore.setState({
      canvases: [{
        id: 'canvas-images',
        projectId: 'default-project',
        name: '素材画布',
        order: 0,
        imageNodes: [{ id: 'node-1', imageId: 'node-img', x: 10, y: 20, w: 320, h: 240 }],
        createdAt: 1,
        updatedAt: 1,
      }],
      activeCanvasId: 'canvas-images',
    })
    vi.mocked(getAllTasks).mockResolvedValue([])
    vi.mocked(getAllImageIds).mockResolvedValue(['node-img'])

    await createDeleteSnapshot('删除画布', [], { type: 'canvas', projectId: 'default-project', canvasId: 'canvas-images' })

    expect(vi.mocked(readExportImages).mock.calls[0][0]).toEqual(['node-img'])
    const params = vi.mocked(buildExportZip).mock.calls[0][0]
    expect(params.tasks).toEqual([])
    expect(params.workspace?.canvases[0].imageNodes?.[0]).toMatchObject({ id: 'node-1', imageId: 'node-img' })
  })

  it('rejects a snapshot when an image node asset is missing', async () => {
    useWorkspaceStore.setState({
      canvases: [{
        id: 'canvas-images',
        projectId: 'default-project',
        name: '素材画布',
        order: 0,
        imageNodes: [{ id: 'node-1', imageId: 'node-img', x: 10, y: 20, w: 320, h: 240 }],
        createdAt: 1,
        updatedAt: 1,
      }],
      activeCanvasId: 'canvas-images',
    })
    vi.mocked(getAllTasks).mockResolvedValue([])
    vi.mocked(getAllImageIds).mockResolvedValue([])

    await expect(createDeleteSnapshot('删除画布', [], { type: 'canvas', projectId: 'default-project', canvasId: 'canvas-images' }))
      .rejects.toThrow('删除快照会缺图')
    expect(writeDeleteSnapshot).not.toHaveBeenCalled()
  })

  it.each([
    ['single task', ['t1']],
    ['canvas task set', ['t1', 't2']],
    ['project task set', ['t1', 't2', 't4']],
    ['agent round task', ['t3']],
    ['agent message task', ['t4']],
  ])('exports only the selected tasks and their images for %s', async (_name, ids) => {
    const tasks = [
      task('t1', { input: ['in-1'], output: ['out-1'] }),
      task('t2', { input: ['in-2'], output: ['out-2'] }),
      task('t3', { input: ['in-3'], output: ['out-3'] }),
      task('t4', { input: ['in-4'], output: ['out-4'] }),
      task('t5', { input: ['in-5'], output: ['out-5'] }),
    ]
    vi.mocked(getAllTasks).mockResolvedValue(tasks)
    vi.mocked(getAllImageIds).mockResolvedValue(['in-1', 'out-1', 'in-2', 'out-2', 'in-3', 'out-3', 'in-4', 'out-4', 'in-5', 'out-5', 'unrelated-large'])

    await createDeleteSnapshot('测试删除', ids)

    expect(writeDeleteSnapshot).toHaveBeenCalledOnce()
    expect(readExportImages).toHaveBeenCalledOnce()
    const exportedImages = vi.mocked(readExportImages).mock.calls[0][0]
    expect(exportedImages).not.toContain('unrelated-large')
    expect(exportedImages.sort()).toEqual(ids.flatMap((id) => [`in-${id.slice(1)}`, `out-${id.slice(1)}`]).sort())
    const params = vi.mocked(buildExportZip).mock.calls[0][0]
    expect(params.tasks.map((item) => item.id).sort()).toEqual([...ids].sort())
  })
})
