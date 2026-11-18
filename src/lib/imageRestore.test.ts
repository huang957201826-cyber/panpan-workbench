import { describe, expect, it } from 'vitest'
import { createImageRestoreMap, remapImageIdsDeep } from './imageRestore'

describe('image restore mapping', () => {
  it('never reuses an imported ID that could overwrite an existing image', () => {
    const remap = createImageRestoreMap(['same-id'], 'operation-1')
    expect(remap.get('same-id')).toBe('restore-image-operation-1-1')
    expect(remap.get('same-id')).not.toBe('same-id')
  })

  it('remaps image references across nested task, canvas, agent and workflow data', () => {
    const remap = createImageRestoreMap(['old'], 'operation-2')
    const value = {
      task: { inputImageIds: ['old'], outputImages: ['old'], nested: { maskImageId: 'old' } },
      canvas: { imageNodes: [{ imageId: 'old' }], referenceImageIds: ['old'] },
      agent: { rounds: [{ inputImageIds: ['old'] }] },
      workflow: { results: [{ imageId: 'old', inputImageId: 'old' }] },
      untouched: 'other',
    }
    expect(remapImageIdsDeep(value, remap)).toEqual({
      task: {
        inputImageIds: ['restore-image-operation-2-1'],
        outputImages: ['restore-image-operation-2-1'],
        nested: { maskImageId: 'restore-image-operation-2-1' },
      },
      canvas: {
        imageNodes: [{ imageId: 'restore-image-operation-2-1' }],
        referenceImageIds: ['restore-image-operation-2-1'],
      },
      agent: { rounds: [{ inputImageIds: ['restore-image-operation-2-1'] }] },
      workflow: {
        results: [{
          imageId: 'restore-image-operation-2-1',
          inputImageId: 'restore-image-operation-2-1',
        }],
      },
      untouched: 'other',
    })
  })
})
