import { describe, expect, it } from 'vitest'
import { imageExtension, sanitizeDownloadName } from './downloadImage'

describe('download helpers', () => {
  it('cleans Windows-invalid characters and keeps readable length', () => {
    expect(sanitizeDownloadName('  a<b>c:d/e\\f|g?h*  ')).toBe('a b c d e f g h')
    expect(sanitizeDownloadName('   ', 'panpan')).toBe('panpan')
    expect(sanitizeDownloadName('x'.repeat(80))).toHaveLength(48)
  })

  it('detects image extensions', () => {
    expect(imageExtension('data:image/png;base64,x')).toBe('png')
    expect(imageExtension('data:image/jpeg;base64,x')).toBe('jpg')
    expect(imageExtension('data:image/webp;base64,x')).toBe('webp')
  })
})
