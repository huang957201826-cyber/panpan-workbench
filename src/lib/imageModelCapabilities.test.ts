import { describe, expect, it } from 'vitest'
import { getImageModelCapabilities, getSupportedSizeTiers, supportsQualityExtremes } from './imageModelCapabilities'

describe('imageModelCapabilities', () => {
  it('2.6 与 Gemini 支持 4K', () => {
    expect(getSupportedSizeTiers('gpt-image-2.6-sunburst')).toEqual(['1K', '2K', '4K'])
    expect(getSupportedSizeTiers('gemini-2.5-flash-image-preview')).toEqual(['1K', '2K', '4K'])
    expect(supportsQualityExtremes('gpt-image-2.6-sunburst')).toBe(true)
  })

  it('2.5 只到 2K，未知模型保守只给 1K', () => {
    expect(getSupportedSizeTiers('gpt-image-2.5-sunburst')).toEqual(['1K', '2K'])
    expect(getSupportedSizeTiers('vendor/custom-image')).toEqual(['1K'])
    expect(getImageModelCapabilities('').maxSide).toBe(2048)
  })
})
