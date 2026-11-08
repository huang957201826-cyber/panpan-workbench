import { describe, expect, it } from 'vitest'
import { computeMenuPosition } from './Menu'

const viewport = { width: 1000, height: 700 }

describe('menu placement', () => {
  it('空间足够时向下展开', () => {
    const result = computeMenuPosition({ left: 100, top: 100, bottom: 132, width: 80, height: 32 }, { width: 180, height: 200 }, viewport)
    expect(result.placement).toBe('bottom')
    expect(result.top).toBe(138)
    expect(result.left).toBe(100)
  })

  it('下方空间不足时翻到上方', () => {
    const result = computeMenuPosition({ left: 100, top: 640, bottom: 672, width: 80, height: 32 }, { width: 180, height: 300 }, viewport)
    expect(result.placement).toBe('top')
    expect(result.top).toBeLessThan(640)
  })

  it('右侧贴边时把菜单往左钳制', () => {
    const result = computeMenuPosition({ left: 960, top: 100, bottom: 132, width: 32, height: 32 }, { width: 180, height: 120 }, viewport)
    expect(result.left).toBe(viewport.width - 180 - 8)
  })

  it('左侧越界时钳到边距', () => {
    const result = computeMenuPosition({ left: -20, top: 100, bottom: 132, width: 32, height: 32 }, { width: 180, height: 120 }, viewport)
    expect(result.left).toBe(8)
  })

  it('超长菜单按可用空间收敛高度，至少保留 96px', () => {
    const result = computeMenuPosition({ left: 100, top: 600, bottom: 632, width: 80, height: 32 }, { width: 180, height: 900 }, viewport)
    expect(result.maxHeight).toBeLessThanOrEqual(320)
    expect(result.maxHeight).toBeGreaterThanOrEqual(96)
  })
})
