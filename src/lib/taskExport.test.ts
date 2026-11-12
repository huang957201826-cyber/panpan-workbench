import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskRecord } from '../types'

const mocks = vi.hoisted(() => ({
  downloadFilesAsZip: vi.fn(),
  downloadImageEntriesAsZip: vi.fn(),
  downloadImageIds: vi.fn(),
  fetchImageBlob: vi.fn(),
  getImageZipEntries: vi.fn(),
  ensureImageCached: vi.fn(),
  encodeImagesAsGif: vi.fn(),
  encodeImageAsSvg: vi.fn(),
  saveFile: vi.fn(),
  saveFileToDir: vi.fn(),
}))

vi.mock('./downloadImages', () => ({
  downloadFilesAsZip: mocks.downloadFilesAsZip,
  downloadImageEntriesAsZip: mocks.downloadImageEntriesAsZip,
  downloadImageIds: mocks.downloadImageIds,
  fetchImageBlob: mocks.fetchImageBlob,
  getImageZipEntries: mocks.getImageZipEntries,
}))
vi.mock('./imageCache', () => ({ ensureImageCached: mocks.ensureImageCached }))
vi.mock('./imageExport', () => ({ encodeImagesAsGif: mocks.encodeImagesAsGif, encodeImageAsSvg: mocks.encodeImageAsSvg }))
vi.mock('./saveFile', () => ({ saveFile: mocks.saveFile, saveFileToDir: mocks.saveFileToDir }))
vi.mock('./platform', () => ({ isTauri: false }))
vi.mock('./dataOperations', () => ({ trackDataTransfer: (run: () => unknown) => run() }))

import { downloadTaskImages, downloadTasksImages } from './taskExport'

const gifTask = {
  id: 'g1',
  outputImages: ['a', 'b'],
  localExportFormat: 'gif',
} as unknown as TaskRecord

const svgTask = {
  id: 's1',
  outputImages: ['a', 'b'],
  localExportFormat: 'svg',
} as unknown as TaskRecord

const pngTask = {
  id: 'p1',
  outputImages: ['c'],
} as unknown as TaskRecord

describe('task local export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ensureImageCached.mockImplementation(async (id: string) => `data:image/png;base64,${id}`)
    mocks.encodeImagesAsGif.mockResolvedValue({
      bytes: new Uint8Array([7]),
      width: 2,
      height: 2,
      frameCount: 2,
      transparent: false,
    })
    mocks.encodeImageAsSvg.mockResolvedValue(new Uint8Array([9]))
    mocks.saveFile.mockResolvedValue('saved')
    mocks.fetchImageBlob.mockResolvedValue({
      type: 'image/png',
      arrayBuffer: async () => new Uint8Array([8]).buffer,
    })
    mocks.downloadFilesAsZip.mockImplementation(async (files: unknown[]) => ({ successCount: files.length, failCount: 0 }))
  })

  it('ZIP 打包时把 GIF 任务转成单个动画文件，普通任务保留原图', async () => {
    const result = await downloadTasksImages([gifTask, pngTask], { zip: true, zipFileNameBase: 'batch' })

    expect(result).toEqual({ successCount: 2, failCount: 0 })
    expect(mocks.encodeImagesAsGif).toHaveBeenCalledWith([
      'data:image/png;base64,a',
      'data:image/png;base64,b',
    ])
    const [files, zipBase] = mocks.downloadFilesAsZip.mock.calls[0]
    expect(zipBase).toBe('batch')
    expect(files.map((file: { fileName: string }) => file.fileName)).toEqual(['task-g1.gif', 'task-p1.png'])
  })

  it('GIF 缺任一帧时整任务失败，不生成半截动画', async () => {
    mocks.ensureImageCached.mockImplementation(async (id: string) => id === 'a' ? 'data:image/png;base64,a' : null)

    const result = await downloadTaskImages(gifTask, ['a', 'b'])

    expect(result.successCount).toBe(0)
    expect(result.failCount).toBe(2)
    expect(result.error).toContain('GIF')
    expect(mocks.encodeImagesAsGif).not.toHaveBeenCalled()
    expect(mocks.saveFile).not.toHaveBeenCalled()
  })

  it('SVG 缺图时仍导出已缓存图片，缺失计入失败数', async () => {
    mocks.ensureImageCached.mockImplementation(async (id: string) => id === 'a' ? 'data:image/png;base64,a' : null)

    const result = await downloadTaskImages(svgTask, ['a', 'b'])

    expect(result.successCount).toBe(1)
    expect(result.failCount).toBe(1)
    expect(result.error).toContain('SVG')
    expect(mocks.encodeImageAsSvg).toHaveBeenCalledTimes(1)
    expect(mocks.saveFile).toHaveBeenCalledTimes(1)
  })

  it('批量 ZIP 中单个任务缺图时累加失败数，其他任务照常打包', async () => {
    mocks.ensureImageCached.mockImplementation(async (id: string) => id === 'b' ? null : `data:image/png;base64,${id}`)

    const result = await downloadTasksImages([gifTask, pngTask], { zip: true, zipFileNameBase: 'batch' })

    expect(result.successCount).toBe(1)
    expect(result.failCount).toBe(2)
    expect(result.error).toContain('缺少')
    const [files] = mocks.downloadFilesAsZip.mock.calls[0]
    expect(files.map((file: { fileName: string }) => file.fileName)).toEqual(['task-p1.png'])
  })

  it('全部图片缺失时不产生文件，失败数覆盖整组', async () => {
    mocks.ensureImageCached.mockResolvedValue(null)

    const result = await downloadTasksImages([gifTask], { zip: true, zipFileNameBase: 'batch' })

    expect(result.successCount).toBe(0)
    expect(result.failCount).toBe(2)
    expect(result.error).toContain('缺少')
    expect(mocks.downloadFilesAsZip).toHaveBeenCalledWith([], 'batch', undefined)
  })
})
