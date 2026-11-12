import type { DownloadImagesResult } from './downloadImages'
import { downloadImageIds } from './downloadImages'
import { exportImageAsSvg, exportImagesAsGif } from './imageExport'
import { ensureImageCached } from './imageCache'
import { sanitizeFileNamePart } from './exportFileName'

/** 单图下载：支持 imageId、data: 与 http(s)；序号用于多图任务区分文件名；GIF/SVG 在本地转换 */
export function downloadImage(imageRef: string, fileNameBase: string, index?: number, localFormat?: 'gif' | 'svg'): Promise<DownloadImagesResult> {
  const base = sanitizeFileNamePart(fileNameBase) || 'panpan'
  const name = index === undefined ? base : `${base}-${index + 1}`
  if (localFormat) {
    return (async () => {
      const dataUrl = imageRef.startsWith('data:') ? imageRef : await ensureImageCached(imageRef)
      if (!dataUrl) return downloadImageIds([imageRef], name)
      const location = localFormat === 'svg'
        ? await exportImageAsSvg(dataUrl, name)
        : await exportImagesAsGif([dataUrl], name)
      if (!location) return { successCount: 0, failCount: 0, canceled: true }
      return { successCount: 1, failCount: 0, location }
    })()
  }
  return downloadImageIds([imageRef], name)
}
