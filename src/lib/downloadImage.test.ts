import { describe, expect, it, vi } from 'vitest'
import { sanitizeFileNamePart } from './exportFileName'

vi.mock('./downloadImages', () => ({ downloadImageIds: vi.fn().mockResolvedValue({ successCount: 1, failCount: 0 }) }))

import { downloadImage } from './downloadImage'
import { downloadImageIds } from './downloadImages'

describe('download helpers', () => {
  it('cleans Windows-invalid characters, trailing dots and reserved names', () => {
    expect(sanitizeFileNamePart('  a<b>c:d/e\\f|g?h*  ')).toBe('a-b-c-d-e-f-g-h')
    expect(sanitizeFileNamePart('   ')).toBe('')
    expect(sanitizeFileNamePart('x'.repeat(200))).toHaveLength(120)
    expect(sanitizeFileNamePart('CON')).toBe('CON_')
    expect(sanitizeFileNamePart('nul.png')).toBe('nul_.png')
    expect(sanitizeFileNamePart('name.')).toBe('name')
    expect(sanitizeFileNamePart('name  ')).toBe('name')
  })

  it('adds the image index and falls back to a default base', async () => {
    await downloadImage('img-1', 'a<b>', 1)
    expect(downloadImageIds).toHaveBeenLastCalledWith(['img-1'], 'a-b-2')
    await downloadImage('img-2', '   ')
    expect(downloadImageIds).toHaveBeenLastCalledWith(['img-2'], 'panpan')
  })
})
