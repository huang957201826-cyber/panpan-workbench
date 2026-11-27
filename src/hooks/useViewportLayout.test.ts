import { describe, expect, it } from 'vitest'
import { classifyLayoutTier } from './useViewportLayout'

describe('classifyLayoutTier', () => {
  it('classifies phones, foldable cover screens, and narrow Android tablet split-screen as phone', () => {
    expect(classifyLayoutTier(375)).toBe('phone')
    expect(classifyLayoutTier(393)).toBe('phone')
    expect(classifyLayoutTier(412)).toBe('phone')
    expect(classifyLayoutTier(679)).toBe('phone')
  })

  it('classifies iPad portrait/1:1 split and Android tablet 50/50 split as tablet', () => {
    expect(classifyLayoutTier(680)).toBe('tablet')
    expect(classifyLayoutTier(768)).toBe('tablet')
    expect(classifyLayoutTier(820)).toBe('tablet')
    expect(classifyLayoutTier(1079)).toBe('tablet')
  })

  it('classifies landscape tablets, macOS, and Windows desktops as desktop', () => {
    expect(classifyLayoutTier(1080)).toBe('desktop')
    expect(classifyLayoutTier(1280)).toBe('desktop')
    expect(classifyLayoutTier(1440)).toBe('desktop')
  })
})
