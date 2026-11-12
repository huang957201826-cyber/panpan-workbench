import { applyPalette, GIFEncoder, quantize } from 'gifenc/dist/gifenc.esm.js'
import { buildImageFileName } from './exportFileName'
import { saveFile } from './saveFile'

/** GIF 本地转换的最长边上限；2K/4K 图会等比缩到这个范围内 */
export const GIF_MAX_SIDE = 2048

export interface EncodedGif {
  bytes: Uint8Array
  width: number
  height: number
  frameCount: number
  /** 至少一帧带透明像素，文件里写入了透明索引 */
  transparent: boolean
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  return image
}

function hasAlpha(data: Uint8ClampedArray) {
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) return true
  }
  return false
}

/** 把图片按顺序编码成 GIF：单图单帧，多图按顺序动画；透明 PNG 保留 1 位透明 */
export async function encodeImagesAsGif(dataUrls: string[], options: { maxSide?: number } = {}): Promise<EncodedGif | null> {
  if (!dataUrls.length) return null
  const images = await Promise.all(dataUrls.map(loadImage))
  const maxSide = Math.max(1, options.maxSide ?? GIF_MAX_SIDE)
  const sourceWidth = Math.max(...images.map((image) => image.naturalWidth || image.width))
  const sourceHeight = Math.max(...images.map((image) => image.naturalHeight || image.height))
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gif = GIFEncoder()
  let anyTransparent = false
  for (const image of images) {
    ctx.clearRect(0, 0, width, height)
    const imageWidth = image.naturalWidth || image.width
    const imageHeight = image.naturalHeight || image.height
    const ratio = Math.min(width / imageWidth, height / imageHeight)
    const drawWidth = Math.max(1, Math.round(imageWidth * ratio))
    const drawHeight = Math.max(1, Math.round(imageHeight * ratio))
    ctx.drawImage(image, Math.round((width - drawWidth) / 2), Math.round((height - drawHeight) / 2), drawWidth, drawHeight)
    let data = ctx.getImageData(0, 0, width, height).data
    if (hasAlpha(data)) {
      const palette = quantize(data, 256, { format: 'rgba4444', oneBitAlpha: true })
      const transparentIndex = palette.findIndex((color) => color[3] === 0)
      if (transparentIndex >= 0) {
        const mapped = applyPalette(data, palette, 'rgba4444')
        gif.writeFrame(mapped, width, height, {
          palette,
          delay: images.length > 1 ? 900 : 0,
          transparent: true,
          transparentIndex,
          dispose: 2,
        })
        anyTransparent = true
        continue
      }
    }

    // 不透明的图用白底补齐画布，避免等比留边变成黑边
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.globalCompositeOperation = 'source-over'
    data = ctx.getImageData(0, 0, width, height).data
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    gif.writeFrame(index, width, height, { palette, delay: images.length > 1 ? 900 : 0 })
  }
  gif.finish()
  return { bytes: gif.bytes(), width, height, frameCount: images.length, transparent: anyTransparent }
}

/** 把若干张图按顺序导出为真正的 GIF89a；单图即单帧，多图即动画 */
export async function exportImagesAsGif(dataUrls: string[], fileName: string, options: { maxSide?: number } = {}): Promise<string | null> {
  const encoded = await encodeImagesAsGif(dataUrls, options)
  if (!encoded) return null
  return saveFile(new Blob([encoded.bytes as unknown as BlobPart], { type: 'image/gif' }), buildImageFileName(fileName, 'gif'))
}

/** 导出真正的 .svg 文件；默认把位图包装进 SVG，保证任何生成图都能导出 */
export async function encodeImageAsSvg(dataUrl: string): Promise<Uint8Array | null> {
  if (!dataUrl) return null
  const image = await loadImage(dataUrl)
  const width = image.naturalWidth || image.width || 1024
  const height = image.naturalHeight || image.height || 1024
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  <image href="${dataUrl}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>\n</svg>\n`
  return new TextEncoder().encode(svg)
}

export async function exportImageAsSvg(dataUrl: string, fileName: string): Promise<string | null> {
  const bytes = await encodeImageAsSvg(dataUrl)
  if (!bytes) return null
  return saveFile(new Blob([bytes as unknown as BlobPart], { type: 'image/svg+xml' }), buildImageFileName(fileName, 'svg'))
}
