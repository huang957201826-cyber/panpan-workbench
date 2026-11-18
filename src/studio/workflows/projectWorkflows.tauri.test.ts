// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const call = vi.hoisted(() => vi.fn())
const getSavedWorkflows = vi.hoisted(() => vi.fn())
const replaceSavedWorkflows = vi.hoisted(() => vi.fn())

vi.mock('../../lib/platform', () => ({ isTauri: true }))
vi.mock('../../lib/dbTauri', () => ({
  call,
  getSavedWorkflows,
  replaceSavedWorkflows,
}))

describe('Tauri saved workflow migration marker', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    localStorage.clear()
    replaceSavedWorkflows.mockResolvedValue(undefined)
  })

  it('does not overwrite restored SQLite workflows with stale legacy localStorage', async () => {
    localStorage.setItem('panpan-project-workflows-v1', JSON.stringify([{
      id: 'stale-workflow',
      projectId: 'workflow',
      presetId: 'qwen-upscale',
      name: '旧数据',
      values: {},
      results: [],
      createdAt: 1,
      updatedAt: 1,
    }]))
    call.mockResolvedValue({ 'saved-workflows-migrated-v2': '1' })
    getSavedWorkflows.mockResolvedValue([{
      id: 'restored-workflow',
      workspaceProjectId: null,
      presetId: 'qwen-upscale',
      name: '恢复后的工作流',
      values: {},
      results: [],
      createdAt: 2,
      updatedAt: 2,
    }])
    const { initializeSavedWorkflows, listWorkflows } = await import('./projectWorkflows')
    await initializeSavedWorkflows()
    expect(listWorkflows().map((workflow) => workflow.id)).toEqual(['restored-workflow'])
    expect(replaceSavedWorkflows).not.toHaveBeenCalled()
  })
})
