export function formatExportFileTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

export function getNumberedFileNameBase(fileNameBase: string, index: number, total: number) {
  return total > 1 ? `${fileNameBase}-${String(index + 1).padStart(2, '0')}` : fileNameBase
}

// Windows 不允许把设备名用作文件名，写入前统一加下划线
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

// 输出格式白名单：GIF/SVG 也在内，jpeg 在展示和文件名里统一成 jpg
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'])

export function avoidWindowsReservedName(name: string) {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  return WINDOWS_RESERVED_NAME.test(stem) ? `${stem}_${ext}` : name
}

/** 只清洗主名；长度截断只作用于主名，调用方随后单独拼接扩展名 */
export function sanitizeFileNamePart(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[.\s-]+$/, '')
    .slice(0, 120)
  return cleaned ? avoidWindowsReservedName(cleaned) : ''
}

/** MIME → 白名单扩展名；未知类型返回空串，绝不把 application/octet-stream 当扩展名 */
export function getImageExtensionFromMime(mime: string): string {
  const type = mime.split(';')[0].trim().toLowerCase()
  if (type === 'image/png') return 'png'
  if (type === 'image/jpeg' || type === 'image/jpg') return 'jpg'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/gif') return 'gif'
  if (type === 'image/svg+xml') return 'svg'
  return ''
}

/** 扩展名/格式统一小写；jpeg 一律映射为 jpg */
export function normalizeImageExtension(value: string): string {
  const ext = value.trim().toLowerCase().replace(/^\./, '')
  if (!ext) return ''
  if (ext === 'jpeg' || ext === 'jpg') return 'jpg'
  return IMAGE_EXTENSIONS.has(ext) ? ext : ''
}

/**
 * 默认图片文件名：主名单独清洗和截断，扩展名单独按 MIME/格式白名单拼接。
 * 主名里已有的图片扩展名先去掉，避免出现 a.png.png；未知 MIME 回退 png。
 */
export function buildImageFileName(stem: string, mimeOrExtension: string, fallbackStem = 'image'): string {
  const ext = getImageExtensionFromMime(mimeOrExtension) || normalizeImageExtension(mimeOrExtension) || 'png'
  const raw = stem.trim()
  const dot = raw.lastIndexOf('.')
  const withoutExtension = dot > 0 && normalizeImageExtension(raw.slice(dot + 1)) ? raw.slice(0, dot) : raw
  const cleanStem = sanitizeFileNamePart(withoutExtension) || fallbackStem
  return `${cleanStem}.${ext}`
}

/** 已有完整文件名再次清洗时仍保留扩展名；用于用户提示词等可能已带后缀的入口 */
export function sanitizeImageFileName(name: string, fallbackStem = 'image', fallbackExtension = 'png'): string {
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? normalizeImageExtension(name.slice(dot + 1)) : ''
  const stem = sanitizeFileNamePart(dot > 0 ? name.slice(0, dot) : name) || fallbackStem
  return `${stem}.${ext || normalizeImageExtension(fallbackExtension) || 'png'}`
}

/** 图片数据缺少扩展名时按 MIME 补上；非图片或已有扩展名时保持原样 */
export function ensureImageFileExtension(name: string, mime: string): string {
  const ext = getImageExtensionFromMime(mime)
  if (!ext || /\.[a-z0-9]+$/i.test(name)) return name
  return `${name}.${ext}`
}

/** 图片文件名中的 jpeg 统一成 jpg；非 jpeg 保持原样 */
export function normalizeImageFileName(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return name
  const ext = normalizeImageExtension(name.slice(dot + 1))
  return ext ? `${name.slice(0, dot)}.${ext}` : name
}
