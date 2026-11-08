import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskRecord, WorkspaceState } from '../types'

const invoke = vi.hoisted(() => vi.fn())
const saveFileToDir = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('./platform', () => ({ isTauri: true }))
vi.mock('./diskSpace', () => ({ ensureDiskSpace: vi.fn(async () => {}) }))
vi.mock('./saveFile', () => ({ saveFileToDir }))

import { collectTaskAssetImageIds, listDeleteSnapshots, pruneDeleteSnapshots, readDeleteSnapshotFile, trimWorkspaceForDelete, writeDeleteSnapshot } from './deleteSnapshot'

describe('delete snapshots', () => {
  beforeEach(() => {
    invoke.mockReset()
    saveFileToDir.mockReset()
  })

  it('collects only the deleted tasks input and output images', () => {
    const task = {
      inputImageIds: ['in-1', 'in-2'],
      maskTargetImageId: 'mask-target',
      maskImageId: 'mask',
      outputImages: ['out-1'],
      transparentOriginalImages: ['orig-1', ''],
      streamPartialImageIds: ['partial-1'],
    } as TaskRecord
    expect(collectTaskAssetImageIds([task]).sort()).toEqual([
      'in-1', 'in-2', 'mask', 'mask-target', 'orig-1', 'out-1', 'partial-1',
    ].sort())
  })

  it('trims unrelated projects and canvases from the snapshot workspace', () => {
    const workspace = {
      version: 1,
      projects: [
        { id: 'p1', name: 'P1', createdAt: 1, updatedAt: 1 },
        { id: 'p2', name: 'P2', createdAt: 2, updatedAt: 2 },
      ],
      canvases: [
        { id: 'c1', projectId: 'p1', name: 'C1', order: 0, createdAt: 1, updatedAt: 1 },
        { id: 'c2', projectId: 'p1', name: 'C2', order: 1, createdAt: 1, updatedAt: 1 },
        { id: 'c3', projectId: 'p2', name: 'C3', order: 0, createdAt: 1, updatedAt: 1 },
      ],
      activeProjectId: 'p2',
      activeCanvasId: 'c3',
      viewMode: 'grid',
      inputDockPosition: 'bottom',
    } as WorkspaceState
    const task = { projectId: 'p1', canvasId: 'c1' } as TaskRecord

    expect(trimWorkspaceForDelete(workspace, [task], { type: 'task' })).toMatchObject({
      projects: [{ id: 'p1' }],
      canvases: [{ id: 'c1' }],
      activeProjectId: 'p1',
      activeCanvasId: 'c1',
    })
    expect(trimWorkspaceForDelete(workspace, [], { type: 'canvas', canvasId: 'c1' })?.canvases.map((canvas) => canvas.id)).toEqual(['c1'])
    expect(trimWorkspaceForDelete(workspace, [], { type: 'project', projectId: 'p1' })?.canvases.map((canvas) => canvas.id)).toEqual(['c1', 'c2'])
  })

  it('lists only delete snapshots newest first', async () => {
    invoke.mockResolvedValue([
      { name: 'delete-1.zip', bytes: 1, modified: 1 },
      { name: 'other.zip', bytes: 2, modified: 2 },
      { name: 'delete-2.zip', bytes: 3, modified: 3 },
    ])
    expect(await listDeleteSnapshots()).toEqual([
      { name: 'delete-2.zip', bytes: 3, modified: 3 },
      { name: 'delete-1.zip', bytes: 1, modified: 1 },
    ])
  })

  it('writes a snapshot through the backups directory and prunes old files', async () => {
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'backups_dir_use') return { token: 1, path: 'data/backups' }
      if (cmd === 'backup_list') {
        return Array.from({ length: 6 }, (_, index) => ({ name: `delete-${index}.zip`, bytes: 1, modified: index }))
      }
      return null
    })
    saveFileToDir.mockResolvedValue('data/backups/delete-new.zip')

    expect(await writeDeleteSnapshot(new Uint8Array([1, 2, 3]))).toBe('data/backups/delete-new.zip')
    expect(saveFileToDir).toHaveBeenCalledOnce()
    expect(invoke).toHaveBeenCalledWith('backup_delete', { name: 'delete-0.zip' })
  })

  it('reads a snapshot as a File', async () => {
    invoke.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)
    const file = await readDeleteSnapshotFile('delete-1.zip')
    expect(file.name).toBe('delete-1.zip')
    expect(file.size).toBe(3)
  })
})
