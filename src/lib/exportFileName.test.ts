import { describe, expect, it } from 'vitest'
import { buildImageFileName, ensureImageFileExtension, normalizeImageFileName, sanitizeImageFileName } from './exportFileName'

describe('export file name contract', () => {
  it('maps output formats to the whitelist and normalizes jpeg to jpg', () => {
    expect(buildImageFileName('a', 'image/png')).toBe('a.png')
    expect(buildImageFileName('a', 'image/jpeg')).toBe('a.jpg')
    expect(buildImageFileName('a', 'JPEG')).toBe('a.jpg')
    expect(buildImageFileName('a', 'image/webp')).toBe('a.webp')
    expect(buildImageFileName('a', 'image/gif')).toBe('a.gif')
    expect(buildImageFileName('a', 'image/svg+xml')).toBe('a.svg')
  })

  it('never turns an unknown MIME into an extension', () => {
    expect(buildImageFileName('a', 'application/octet-stream')).toBe('a.png')
    expect(buildImageFileName('a', 'binary/octet-stream')).toBe('a.png')
    expect(buildImageFileName('a', '')).toBe('a.png')
  })

  it('truncates only the stem so the extension always survives', () => {
    const name = buildImageFileName('x'.repeat(200), 'image/png')
    expect(name).toHaveLength(124)
    expect(name.endsWith('.png')).toBe(true)
    expect(buildImageFileName('a.png', 'image/webp')).toBe('a.webp')
  })

  it('sanitizes a complete image name without cutting the extension', () => {
    expect(sanitizeImageFileName(`${'x'.repeat(200)}.jpeg`)).toBe(`${'x'.repeat(120)}.jpg`)
    expect(sanitizeImageFileName('nul.png')).toBe('nul_.png')
  })

  it('fills a missing image extension but leaves known and non-image names alone', () => {
    expect(ensureImageFileExtension('photo', 'image/jpeg')).toBe('photo.jpg')
    expect(ensureImageFileExtension('photo.png', 'image/jpeg')).toBe('photo.png')
    expect(ensureImageFileExtension('backup.zip', 'application/zip')).toBe('backup.zip')
    expect(normalizeImageFileName('photo.jpeg')).toBe('photo.jpg')
    expect(normalizeImageFileName('backup.zip')).toBe('backup.zip')
  })
})
