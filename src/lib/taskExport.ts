import type { TaskRecord } from '../types'
import {
  downloadFilesAsZip,
  downloadImageEntriesAsZip,
  downloadImageIds,
  fetchImageBlob,
  getImageZipEntries,
  type DownloadFileEntry,
  type DownloadImagesResult,
} from './downloadImages'
import { ensureImageCached } from './imageCache'
import { encodeImageAsSvg, encodeImagesAsGif } from './imageExport'
import { buildImageFileName, getImageExtensionFromMime, getNumberedFileNameBase, sanitizeFileNamePart } from './exportFileName'
import { trackDataTransfer } from './dataOperations'
import { isTauri } from './platform'
import { saveFile, saveFileToDir, type SaveDir } from './saveFile'

export type TaskLocalExportFormat = 'gif' | 'svg'

export interface TaskImagesExportOptions {
  fileNameBase?: string
  dir?: SaveDir | null
  zip?: boolean
  zipFileNameBase?: string
  onProgress?: (done: number, total: number) => void
}

export function getTaskLocalExportFormat(task: TaskRecord): TaskLocalExportFormat | null {
  return task.localExportFormat === 'gif' || task.localExportFormat === 'svg' ? task.localExportFormat : null
}

function taskFileNameBase(task: TaskRecord, fallback?: string) {
  return sanitizeFileNamePart(fallback || `task-${task.id}`) || `task-${task.id}`
}

async function buildTaskExportFiles(task: TaskRecord, imageIds: string[], fileNameBase: string): Promise<{ files: DownloadFileEntry[]; failed: number }> {
  const format = getTaskLocalExportFormat(task)
  if (!format) return { files: [], failed: 0 }
  const dataUrls: Array<string | undefined> = []
  for (const imageId of imageIds) {
    dataUrls.push(await ensureImageCached(imageId))
  }

  if (format === 'gif') {
    // GIF 是整段动画，缺任一帧就不生成半截文件
    if (dataUrls.some((dataUrl) => !dataUrl)) return { files: [], failed: imageIds.length }
    const encoded = await encodeImagesAsGif(dataUrls.filter((dataUrl): dataUrl is string => Boolean(dataUrl)))
    if (!encoded) return { files: [], failed: imageIds.length }
    return { files: [{ fileName: buildImageFileName(fileNameBase, 'gif'), bytes: encoded.bytes }], failed: 0 }
  }

  const files: DownloadFileEntry[] = []
  for (let index = 0; index < dataUrls.length; index++) {
    const dataUrl = dataUrls[index]
    if (!dataUrl) continue
    const bytes = await encodeImageAsSvg(dataUrl)
    if (bytes) {
      files.push({
        fileName: buildImageFileName(getNumberedFileNameBase(fileNameBase, index, imageIds.length), 'svg'),
        bytes,
      })
    }
  }
  return { files, failed: imageIds.length - files.length }
}

function localExportError(format: TaskLocalExportFormat, failed: number) {
  if (!failed) return undefined
  return format === 'gif'
    ? 'GIF 本地导出缺帧或编码失败，已取消该任务'
    : `SVG 本地导出缺少 ${failed} 张图片`
}

async function saveLocalFiles(files: DownloadFileEntry[], dir?: SaveDir | null): Promise<DownloadImagesResult> {
  if (!files.length) return { successCount: 0, failCount: 0 }
  return trackDataTransfer(async () => {
    let successCount = 0
    let failCount = 0
    let location: string | undefined
    let error: string | undefined
    for (const file of files) {
      try {
        const saved = dir ? await saveFileToDir(dir, file.bytes, file.fileName) : await saveFile(file.bytes, file.fileName)
        if (!saved) return { successCount, failCount, canceled: true }
        if (isTauri) location = dir?.path ?? saved
        successCount++
        if (files.length > 1 && !dir) await new Promise((resolve) => window.setTimeout(resolve, 100))
      } catch (err) {
        console.error(err)
        error = typeof err === 'string' ? err : err instanceof Error ? err.message : undefined
        failCount++
      }
    }
    return { successCount, failCount, location, error }
  })
}

/** 任务输出图下载：同一任务内按 localExportFormat 做 GIF 动画 / SVG 转换，ZIP 也写转换后的文件 */
export async function downloadTaskImages(
  task: TaskRecord,
  imageIds: string[],
  options: TaskImagesExportOptions = {},
): Promise<DownloadImagesResult> {
  const ids = imageIds.filter((id): id is string => Boolean(id))
  if (!ids.length) return { successCount: 0, failCount: 0 }
  const fileNameBase = taskFileNameBase(task, options.fileNameBase)
  const zipFileNameBase = sanitizeFileNamePart(options.zipFileNameBase || fileNameBase) || fileNameBase
  const localFormat = getTaskLocalExportFormat(task)

  if (!localFormat) {
    if (options.zip) return downloadImageEntriesAsZip(getImageZipEntries(ids, fileNameBase), zipFileNameBase, options.dir)
    return downloadImageIds(ids, fileNameBase, options.dir, { onProgress: options.onProgress })
  }

  const built = await buildTaskExportFiles(task, ids, fileNameBase)
  if (localFormat === 'gif' && built.failed > 0) {
    options.onProgress?.(ids.length, ids.length)
    return { successCount: 0, failCount: ids.length, error: localExportError(localFormat, built.failed) }
  }

  if (options.zip) {
    const result = await downloadFilesAsZip(built.files, zipFileNameBase, options.dir)
    return {
      ...result,
      failCount: result.failCount + built.failed,
      error: result.error ?? localExportError(localFormat, built.failed),
    }
  }

  const result = await saveLocalFiles(built.files, options.dir)
  options.onProgress?.(result.successCount + result.failCount + built.failed, ids.length)
  return {
    ...result,
    failCount: result.failCount + built.failed,
    error: result.error ?? localExportError(localFormat, built.failed),
  }
}

function mergeResults(results: DownloadImagesResult[]): DownloadImagesResult {
  const merged: DownloadImagesResult = { successCount: 0, failCount: 0 }
  for (const result of results) {
    merged.successCount += result.successCount
    merged.failCount += result.failCount
    if (result.canceled) merged.canceled = true
    if (result.location) merged.location = result.location
    if (result.error) merged.error = result.error
  }
  return merged
}

/** 多任务下载：每个任务按自己的 localExportFormat 转换；ZIP 时把所有任务的文件打进一个包 */
export async function downloadTasksImages(tasks: TaskRecord[], options: Omit<TaskImagesExportOptions, 'tasks'> = {}): Promise<DownloadImagesResult> {
  const valid = tasks.filter((task) => task.outputImages.length > 0)
  if (!valid.length) return { successCount: 0, failCount: 0 }
  const zipFileNameBase = sanitizeFileNamePart(options.zipFileNameBase || `batch-${Date.now()}`) || 'batch'

  if (options.zip) {
    const allNative = valid.every((task) => !getTaskLocalExportFormat(task))
    if (allNative) {
      return downloadImageEntriesAsZip(
        valid.flatMap((task) => getImageZipEntries(task.outputImages, taskFileNameBase(task))),
        zipFileNameBase,
        options.dir,
      )
    }
    const files: DownloadFileEntry[] = []
    let failed = 0
    for (const task of valid) {
      try {
        if (getTaskLocalExportFormat(task)) {
          const built = await buildTaskExportFiles(task, task.outputImages, taskFileNameBase(task))
          files.push(...built.files)
          failed += built.failed
          continue
        }
        const base = taskFileNameBase(task)
        for (let index = 0; index < task.outputImages.length; index++) {
          const blob = await fetchImageBlob(task.outputImages[index])
          const ext = getImageExtensionFromMime(blob.type) || 'png'
          files.push({
            fileName: buildImageFileName(getNumberedFileNameBase(base, index, task.outputImages.length), ext),
            bytes: new Uint8Array(await blob.arrayBuffer()),
          })
        }
      } catch (err) {
        console.error(err)
        failed += task.outputImages.length
      }
    }
    const result = await downloadFilesAsZip(files, zipFileNameBase, options.dir)
    return {
      ...result,
      failCount: result.failCount + failed,
      error: result.error ?? (failed ? `本地导出缺少 ${failed} 张图片` : undefined),
    }
  }

  const results: DownloadImagesResult[] = []
  let done = 0
  const total = valid.reduce((sum, task) => sum + task.outputImages.length, 0)
  for (const task of valid) {
    try {
      const result = await downloadTaskImages(task, task.outputImages, {
        dir: options.dir,
        fileNameBase: taskFileNameBase(task),
      })
      results.push(result)
      done += task.outputImages.length
      options.onProgress?.(done, total)
      if (result.canceled) break
    } catch (err) {
      console.error(err)
      results.push({ successCount: 0, failCount: task.outputImages.length, error: typeof err === 'string' ? err : undefined })
    }
  }
  return mergeResults(results)
}
