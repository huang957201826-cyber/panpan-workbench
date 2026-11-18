// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  addWorkflowResult,
  createWorkflow,
  initializeSavedWorkflows,
  listWorkflows,
  removeWorkflow,
  removeWorkflowResult,
  renameWorkflow,
} from './projectWorkflows'
import type { WorkflowHistoryRecord } from '../modules/workflow/types'

function record(id: string): Omit<WorkflowHistoryRecord, 'inputUrl' | 'outputUrl' | 'batchUrls'> {
  return {
    id,
    toolId: 'upscale',
    toolLabel: '无损放大',
    title: `无损放大 · ${id}`,
    createdAt: '12:00',
    duration: '10s',
    resolution: '原图尺寸',
    summary: '无损放大 · 10s',
    paramsSnapshot: { flow: 'upscale', scale: 1 },
  }
}

beforeEach(async () => {
  localStorage.clear()
  await initializeSavedWorkflows()
})

describe('保存的工作流结果持久化', () => {
  it('normalizes legacy projectId into explicit workspace relationships', async () => {
    localStorage.setItem('panpan-project-workflows-v1', JSON.stringify([
      {
        id: 'workflow-draft',
        projectId: 'workflow',
        presetId: 'qwen-upscale',
        name: '旧工作流',
        values: {},
        results: [],
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'workflow-project',
        projectId: 'project-real',
        presetId: 'matte-cutout',
      name: '保存的工作流',
        values: {},
        results: [],
        createdAt: 2,
        updatedAt: 2,
      },
    ]))
    await initializeSavedWorkflows()
    expect(listWorkflows().map((workflow) => ({
      id: workflow.id,
      workspaceProjectId: workflow.workspaceProjectId,
    }))).toEqual([
      { id: 'workflow-project', workspaceProjectId: 'project-real' },
      { id: 'workflow-draft', workspaceProjectId: null },
    ])
  })

  it('写入结果后按时间排序，并保留原始记录字段', async () => {
    const project = await createWorkflow({
      workspaceProjectId: null,
      presetId: 'qwen-upscale',
      name: '工作流 A',
      values: { flow: 'upscale' },
    })
    await addWorkflowResult(project.id, {
      imageId: 'img-1',
      inputImageId: 'img-0',
      record: record('rec-1'),
      createdAt: 1000,
    })
    await addWorkflowResult(project.id, {
      imageId: 'img-2',
      record: record('rec-2'),
      createdAt: 2000,
    })

    const [saved] = listWorkflows()
    expect(saved.results).toHaveLength(2)
    expect(saved.results.map((result) => result.record.id)).toEqual(['rec-2', 'rec-1'])
    expect(saved.results[1].inputImageId).toBe('img-0')
    expect(saved.lastRunAt).toBe(2000)
  })

  it('删除记录时只移除对应结果', async () => {
    const project = await createWorkflow({
      workspaceProjectId: null,
      presetId: 'qwen-upscale',
      name: '工作流 B',
      values: {},
    })
    for (const id of ['rec-1', 'rec-2']) {
      await addWorkflowResult(project.id, {
        imageId: `img-${id}`,
        record: record(id),
        createdAt: Date.now(),
      })
    }
    await removeWorkflowResult(project.id, 'rec-1')
    const [saved] = listWorkflows()
    expect(saved.results.map((result) => result.record.id)).toEqual(['rec-2'])
  })

  it('最多保留最近 30 条结果', async () => {
    const project = await createWorkflow({
      workspaceProjectId: null,
      presetId: 'qwen-upscale',
      name: '工作流 C',
      values: {},
    })
    for (let index = 0; index < 35; index += 1) {
      await addWorkflowResult(project.id, {
        imageId: `img-${index}`,
        record: record(`rec-${index}`),
        createdAt: index,
      })
    }
    const [saved] = listWorkflows()
    expect(saved.results).toHaveLength(30)
    expect(saved.results[0].record.id).toBe('rec-34')
  })

  it('renames and deletes a saved workflow across restart hydration', async () => {
    const workflow = await createWorkflow({
      workspaceProjectId: null,
      presetId: 'qwen-upscale',
      name: '旧名称',
      values: { flow: 'upscale' },
    })

    await renameWorkflow(workflow.id, '新名称')
    await initializeSavedWorkflows()
    expect(listWorkflows()[0]).toMatchObject({ id: workflow.id, name: '新名称' })

    await removeWorkflow(workflow.id)
    await initializeSavedWorkflows()
    expect(listWorkflows().some((item) => item.id === workflow.id)).toBe(false)
  })
})
