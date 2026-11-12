import { beforeEach, describe, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => ({ isTauri: true, apiFetch: vi.fn() }))
const save = vi.hoisted(() => ({ saveFile: vi.fn(), saveFileToDir: vi.fn(), pickSaveDir: vi.fn() }))
const cache = vi.hoisted(() => ({ ensureImageCached: vi.fn() }))

vi.mock('./platform', () => platform)
vi.mock('./saveFile', () => save)
vi.mock('./imageCache', () => cache)
vi.mock('./dataOperations', () => ({ trackDataTransfer: (fn: () => Promise<unknown>) => fn() }))

import { downloadImageEntriesAsZip, downloadImageIds } from './downloadImages'

const pngBlob = () => new Blob(['x'], { type: 'image/png' })

describe('downloadImageIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    platform.isTauri = true
    platform.apiFetch.mockImplementation(async () => ({ ok: true, blob: async () => pngBlob() }))
    cache.ensureImageCached.mockImplementation(async (id: string) => `data:image/png;base64,${id}`)
  })

  it('单张下载走保存对话框，文件名已清洗', async () => {
    save.saveFile.mockResolvedValue('D:\\out\\a.png')
    const result = await downloadImageIds(['img-1'], 'CON')
    expect(result).toEqual({ successCount: 1, failCount: 0, location: 'D:\\out\\a.png' })
    expect(save.saveFile).toHaveBeenCalledTimes(1)
    expect(save.saveFile.mock.calls[0][1]).toBe('CON_.png')
  })

  it('未知 MIME 回退 png，不会把 octet-stream 写进文件名', async () => {
    platform.apiFetch.mockImplementation(async () => ({ ok: true, blob: async () => new Blob(['x'], { type: 'application/octet-stream' }) }))
    save.saveFile.mockResolvedValue('D:\\out\\a.png')
    await downloadImageIds(['img-1'], '未知')
    expect(save.saveFile.mock.calls[0][1]).toBe('未知.png')
  })

  it('超长提示词只截断主名，扩展名保留', async () => {
    save.saveFile.mockResolvedValue('D:\\out\\a.png')
    await downloadImageIds(['img-1'], 'x'.repeat(200))
    const name = save.saveFile.mock.calls[0][1] as string
    expect(name.endsWith('.png')).toBe(true)
    expect(name).toHaveLength(124)
  })

  it('取消保存对话框时静默返回，不算失败', async () => {
    save.saveFile.mockResolvedValue(null)
    expect(await downloadImageIds(['img-1'], 'a')).toEqual({ successCount: 0, failCount: 0, canceled: true })
  })

  it('读取失败时保留原因并计入失败', async () => {
    cache.ensureImageCached.mockResolvedValue(null)
    platform.apiFetch.mockResolvedValue({ ok: false, blob: async () => pngBlob() })
    const result = await downloadImageIds(['bad'], 'a')
    expect(result.successCount).toBe(0)
    expect(result.failCount).toBe(1)
    expect(result.error).toContain('读取图片失败')
  })

  it('多张下载只弹一次目录框，并逐张报告进度', async () => {
    save.pickSaveDir.mockResolvedValue({ token: 1, path: 'D:\\out' })
    save.saveFileToDir.mockImplementation(async (_dir, _blob, name: string) => `D:\\out\\${name}`)
    const progress: number[] = []
    const result = await downloadImageIds(['a', 'b'], 'batch', null, { onProgress: (done) => progress.push(done) })
    expect(save.pickSaveDir).toHaveBeenCalledTimes(1)
    expect(save.saveFileToDir).toHaveBeenCalledTimes(2)
    expect(progress).toEqual([1, 2])
    expect(result).toEqual({ successCount: 2, failCount: 0, location: 'D:\\out' })
  })

  it('已选目录时不再弹目录框', async () => {
    save.saveFileToDir.mockResolvedValue('D:\\out\\a.png')
    await downloadImageIds(['a', 'b'], 'batch', { token: 1, path: 'D:\\out' })
    expect(save.pickSaveDir).not.toHaveBeenCalled()
    expect(save.saveFileToDir).toHaveBeenCalledTimes(2)
  })

  it('目录选择被取消时不再写入', async () => {
    save.pickSaveDir.mockResolvedValue(null)
    expect(await downloadImageIds(['a', 'b'], 'batch')).toEqual({ successCount: 0, failCount: 0, canceled: true })
    expect(save.saveFileToDir).not.toHaveBeenCalled()
  })

  it('默认保存地址不可用时返回原因', async () => {
    save.pickSaveDir.mockRejectedValue('默认保存地址不可用')
    const result = await downloadImageIds(['a', 'b'], 'batch')
    expect(result.successCount).toBe(0)
    expect(result.failCount).toBe(0)
    expect(result.error).toBe('默认保存地址不可用')
  })

  it('网页版多张下载不弹目录框，逐张交给浏览器', async () => {
    platform.isTauri = false
    save.saveFile.mockResolvedValue('a.png')
    await downloadImageIds(['a', 'b'], 'batch')
    expect(save.pickSaveDir).not.toHaveBeenCalled()
    expect(save.saveFile).toHaveBeenCalledTimes(2)
  })
})

describe('downloadImageEntriesAsZip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    platform.isTauri = true
    platform.apiFetch.mockImplementation(async () => ({ ok: true, blob: async () => pngBlob() }))
    cache.ensureImageCached.mockImplementation(async (id: string) => `data:image/png;base64,${id}`)
  })

  it('目录不可写时返回原因，不抛异常', async () => {
    save.saveFileToDir.mockRejectedValue('目录不可写')
    const result = await downloadImageEntriesAsZip([{ imageId: 'a' }], 'zip', { token: 1, path: 'D:\\out' })
    expect(result).toEqual({ successCount: 0, failCount: 1, error: '目录不可写' })
  })
})
