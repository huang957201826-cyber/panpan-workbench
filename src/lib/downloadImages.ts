import { zipSync } from 'fflate'
import type { TaskRecord } from '../types'
import { trackDataTransfer } from './dataOperations'
import { buildImageFileName, getNumberedFileNameBase, getImageExtensionFromMime, sanitizeFileNamePart } from './exportFileName'
import { ensureImageCached } from './imageCache'
import { apiFetch, isTauri } from './platform'
import { pickSaveDir, saveFile, saveFileToDir, type SaveDir } from './saveFile'

export interface DownloadImagesResult {
  successCount: number
  failCount: number
  /** 客户端中用户取消了保存对话框，调用方应静默返回 */
  canceled?: boolean
  /** 客户端中的保存位置：保存到目录时为目录，否则为文件路径 */
  location?: string
  /** 最后一个写入失败的原因（Rust 命令的错误），例如默认保存地址不可用 */
  error?: string
}

export interface DownloadImageZipEntry {
  imageId: string
  fileNameBase?: string
}

/** 已生成好的文件条目，fileName 需要带扩展名；用于本地转换后的 ZIP */
export interface DownloadFileEntry {
  fileName: string
  bytes: Uint8Array
}

type TaskOutputZipTask = Pick<TaskRecord, 'id' | 'createdAt' | 'outputImages'>

export { formatExportFileTime } from './exportFileName'

/** 客户端的下载成功提示附上保存位置，便于找到文件 */
export function withSaveLocation(msg: string, location?: string) {
  return location ? `${msg}，已保存到 ${location}` : msg
}

/** Rust 命令的错误是字符串（例如默认保存地址不可用），附上原因；其他错误只提示下载失败 */
export function getDownloadErrorMessage(err: unknown) {
  if (typeof err === 'string') return `下载失败，${err}`
  if (err instanceof Error && err.message) return `下载失败，${err.message}`
  return '下载失败'
}

export interface DownloadImagesOptions {
  /** 每处理完一张图片调用一次，done 从 1 开始 */
  onProgress?: (done: number, total: number) => void
}

/** dir 为客户端中已选好的保存目录；未传入时，客户端下载多张会先弹出一次目录选择框，单张弹出保存对话框（“默认地址”模式下都直接写入默认保存地址） */
export async function downloadImageIds(imageIds: string[], fileNameBase = 'images', dir?: SaveDir | null, opts?: DownloadImagesOptions): Promise<DownloadImagesResult> {
  if (imageIds.length === 0) return { successCount: 0, failCount: 0 }

  let successCount = 0
  let failCount = 0
  let location: string | undefined
  let error: string | undefined
  const multiple = imageIds.length > 1
  let targetDir = dir
  if (isTauri && multiple && !targetDir) {
    try {
      targetDir = await pickSaveDir()
    } catch (err) {
      console.error(err)
      return { successCount, failCount, error: typeof err === 'string' ? err : undefined }
    }
    if (!targetDir) return { successCount, failCount, canceled: true }
  }

  // 逐张写入期间计入进行中的数据操作，客户端关闭窗口时会先确认
  return trackDataTransfer(async () => {
    for (let index = 0; index < imageIds.length; index++) {
      try {
        const blob = await getImageBlob(imageIds[index])
        const order = String(index + 1).padStart(2, '0')
        const base = multiple ? `${fileNameBase}-${order}` : fileNameBase
        // 主名与扩展名分开清洗：长提示词不会把 .png/.jpg 截掉，未知 MIME 也只会回退 png
        const name = buildImageFileName(base, blob.type)
        const saved = targetDir ? await saveFileToDir(targetDir, blob, name) : await saveFile(blob, name)
        if (!saved) {
          opts?.onProgress?.(index + 1, imageIds.length)
          return { successCount, failCount, canceled: true }
        }
        if (isTauri) location = targetDir?.path ?? saved
        successCount++
        if (multiple && !targetDir) await delay(100)
      } catch (err) {
        console.error(err)
        error = errorReason(err)
        failCount++
      }
      opts?.onProgress?.(index + 1, imageIds.length)
    }

    return { successCount, failCount, location, error }
  })
}

/** dir 为客户端中已选好的保存目录；未传入时客户端弹出保存对话框 */
export async function downloadImageEntriesAsZip(entries: DownloadImageZipEntry[], zipFileNameBase = 'images', dir?: SaveDir | null): Promise<DownloadImagesResult> {
  if (entries.length === 0) return { successCount: 0, failCount: 0 }
  // 打包期间计入进行中的数据操作，客户端关闭窗口时会先确认
  return trackDataTransfer(async () => {
    let failCount = 0
    const files: DownloadFileEntry[] = []
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index]
      try {
        const blob = await getImageBlob(entry.imageId)
        const order = String(index + 1).padStart(2, '0')
        const ext = getImageExtensionFromMime(blob.type) || 'png'
        const fileName = buildImageFileName(entry.fileNameBase || `image-${order}`, ext)
        files.push({ fileName, bytes: new Uint8Array(await blob.arrayBuffer()) })
      } catch (err) {
        console.error(err)
        failCount++
      }
    }
    const result = await zipEntries(files, zipFileNameBase, dir)
    return { ...result, failCount: result.failCount + failCount }
  })
}

/** 把已生成好的文件打包下载；本地转换的 GIF/SVG 走这里，和普通图片 ZIP 保持同一套命名/保存规则 */
export async function downloadFilesAsZip(entries: DownloadFileEntry[], zipFileNameBase = 'images', dir?: SaveDir | null): Promise<DownloadImagesResult> {
  if (entries.length === 0) return { successCount: 0, failCount: 0 }
  return trackDataTransfer(() => zipEntries(entries, zipFileNameBase, dir))
}

async function zipEntries(entries: DownloadFileEntry[], zipFileNameBase: string, dir?: SaveDir | null): Promise<DownloadImagesResult> {
  const zipFiles: Record<string, [Uint8Array, { mtime: Date }]> = {}
  const usedNames = new Set<string>()
  for (const entry of entries) {
    const fileName = uniqueZipName(usedNames, entry.fileName)
    zipFiles[fileName] = [entry.bytes, { mtime: new Date() }]
  }
  const successCount = entries.length
  try {
    const zipped = zipSync(zipFiles, { level: 6 })
    const fileName = `${sanitizeFileNamePart(zipFileNameBase) || 'images'}.zip`
    let location: string | undefined
    if (dir) {
      await saveFileToDir(dir, zipped, fileName)
      location = dir.path
    } else if (isTauri) {
      const saved = await saveFile(zipped, fileName)
      if (!saved) return { successCount: 0, failCount: successCount, canceled: true }
      location = saved
    } else {
      const buffer = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer
      await saveFile(new Blob([buffer], { type: 'application/zip' }), fileName)
    }
    return { successCount, failCount: 0, location }
  } catch (err) {
    console.error(err)
    return { successCount: 0, failCount: successCount, error: errorReason(err) }
  }
}

function uniqueZipName(usedNames: Set<string>, fileName: string) {
  if (!usedNames.has(fileName)) {
    usedNames.add(fileName)
    return fileName
  }
  const dot = fileName.lastIndexOf('.')
  const base = dot > 0 ? fileName.slice(0, dot) : fileName
  const ext = dot > 0 ? fileName.slice(dot) : ''
  let duplicateIndex = 2
  while (usedNames.has(`${base}-${String(duplicateIndex).padStart(2, '0')}${ext}`)) duplicateIndex++
  const next = `${base}-${String(duplicateIndex).padStart(2, '0')}${ext}`
  usedNames.add(next)
  return next
}

export function getTaskOutputImageZipEntries(tasks: TaskOutputZipTask[]): DownloadImageZipEntry[] {
  return [...tasks]
    .sort((a, b) => b.createdAt - a.createdAt)
    .flatMap((task) => getImageZipEntries(task.outputImages || [], `task-${task.id}`))
}

export function getImageZipEntries(imageIds: string[], fileNameBase = 'image'): DownloadImageZipEntry[] {
  return imageIds.map((imageId, index) => ({
    imageId,
    fileNameBase: getNumberedFileNameBase(fileNameBase, index, imageIds.length),
  }))
}

export async function fetchImageBlob(imageIdOrUrl: string): Promise<Blob> {
  return getImageBlob(imageIdOrUrl)
}

async function getImageBlob(imageIdOrUrl: string): Promise<Blob> {
  let src = imageIdOrUrl
  if (!imageIdOrUrl.startsWith('data:') && !imageIdOrUrl.startsWith('http://') && !imageIdOrUrl.startsWith('https://')) {
    src = await ensureImageCached(imageIdOrUrl) ?? imageIdOrUrl
  }

  const res = await apiFetch(src)
  if (!res.ok && !src.startsWith('data:')) throw new Error(`读取图片失败：${imageIdOrUrl}`)
  return await res.blob()
}

function errorReason(err: unknown) {
  if (typeof err === 'string') return err
  if (err instanceof Error && err.message) return err.message
  return undefined
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

