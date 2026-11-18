import { beforeEach, describe, expect, it, vi } from 'vitest'

const listRestoreJournals = vi.fn()
const deleteRestoreJournal = vi.fn()
const deleteImage = vi.fn()
const deleteResultImages = vi.fn()

vi.mock('./db', () => ({
  deleteImage: (...args: unknown[]) => deleteImage(...args),
}))
vi.mock('./dbTauri', () => ({
  listRestoreJournals: (...args: unknown[]) => listRestoreJournals(...args),
  deleteRestoreJournal: (...args: unknown[]) => deleteRestoreJournal(...args),
}))
vi.mock('./platform', () => ({ isTauri: true }))
vi.mock('../studio/workflows/resultImageStore', () => ({
  deleteResultImages: (...args: unknown[]) => deleteResultImages(...args),
}))

import { recoverPendingRestoreJournals } from './restoreRecovery'

describe('recoverPendingRestoreJournals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteRestoreJournal.mockResolvedValue(undefined)
    deleteImage.mockResolvedValue(undefined)
    deleteResultImages.mockResolvedValue(undefined)
  })

  it('deletes staged regular images, thumbnails and workflow images for interrupted restores', async () => {
    listRestoreJournals.mockResolvedValue([{
      id: 'restore-1',
      state: 'staging',
      data: JSON.stringify({
        stagedImageIds: ['image-1', 'image-shared'],
        stagedThumbnailIds: ['thumb-1', 'image-shared'],
        stagedWorkflowImageIds: ['wfi-1', 'wfi-2'],
      }),
      updatedAt: 1,
    }])
    await recoverPendingRestoreJournals()
    expect(deleteImage).toHaveBeenCalledWith('image-1')
    expect(deleteImage).toHaveBeenCalledWith('thumb-1')
    expect(deleteImage).toHaveBeenCalledWith('image-shared')
    expect(deleteImage).toHaveBeenCalledTimes(3)
    expect(deleteResultImages).toHaveBeenCalledWith(['wfi-1', 'wfi-2'])
    expect(deleteRestoreJournal).toHaveBeenCalledWith('restore-1')
  })

  it('keeps committed image references and only removes the journal', async () => {
    listRestoreJournals.mockResolvedValue([{
      id: 'restore-2',
      state: 'committed',
      data: JSON.stringify({ stagedImageIds: ['wfi-kept'] }),
      updatedAt: 2,
    }])
    await recoverPendingRestoreJournals()
    expect(deleteResultImages).not.toHaveBeenCalled()
    expect(deleteImage).not.toHaveBeenCalled()
    expect(deleteRestoreJournal).toHaveBeenCalledWith('restore-2')
  })
})
