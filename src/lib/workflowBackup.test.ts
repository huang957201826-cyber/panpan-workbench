import { describe, expect, it } from 'vitest'
import type { SavedWorkflowBackup } from '../types'
import { planWorkflowRestore } from './workflowBackup'

function workflow(imageId: string, inputImageId?: string): SavedWorkflowBackup {
  return {
    id: 'workflow-1',
    workspaceProjectId: null,
    presetId: 'qwen-upscale',
    name: '测试',
    values: { flow: 'upscale' },
    results: [{
      imageId,
      inputImageId,
      record: { id: 'record-1', title: '测试' },
      createdAt: 1,
    }],
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('planWorkflowRestore', () => {
  it('stages immutable image IDs and remaps workflow references', () => {
    const plan = planWorkflowRestore(
      [workflow('old-output', 'old-input')],
      {
        'old-output': 'data:image/png;base64,AAECAw==',
        'old-input': 'data:image/png;base64,BAUGBw==',
      },
      'operation-1',
    )
    expect(plan.stagedImages).toHaveLength(2)
    expect(plan.stagedImages.every((image) => image.id.startsWith('wfi-restore-operation-1-'))).toBe(true)
    const result = plan.workflows[0].results[0]
    expect(result.imageId).not.toBe('old-output')
    expect(result.inputImageId).not.toBe('old-input')
    expect(plan.missingImageIds).toEqual([])
  })

  it('keeps records whose result image is missing and marks unavailable images', () => {
    const plan = planWorkflowRestore(
      [workflow('missing-output')],
      {},
      'operation-2',
    )
    expect(plan.workflows[0].results).toHaveLength(1)
    expect(plan.workflows[0].results[0]).toMatchObject({
      imageId: 'missing-output',
      missingImageIds: ['missing-output'],
    })
    expect(plan.missingImageIds).toEqual(['missing-output'])
  })
})
