import { ensureImageCached } from './imageCache'

/** 去掉 Windows 非法字符并限制长度，保留可读提示词 */
export function sanitizeDownloadName(value: string, fallback = 'panpan') {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48)
  return cleaned || fallback
}

export function imageExtension(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9.+-]+)[;,]/)
  const type = match?.[1]?.toLowerCase()
  if (type === 'jpeg' || type === 'jpg') return 'jpg'
  if (type === 'webp') return 'webp'
  return 'png'
}

export async function downloadImage(imageId: string, prompt: string, index?: number) {
  const url = await ensureImageCached(imageId)
  if (!url) return false
  const suffix = index === undefined ? '' : `-${index + 1}`
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeDownloadName(prompt)}${suffix}.${imageExtension(url)}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  return true
}
