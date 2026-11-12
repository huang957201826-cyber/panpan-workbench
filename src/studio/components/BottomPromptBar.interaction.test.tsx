// @vitest-environment jsdom
/**
 * 组件级交互回归：v1.0.0 曾出现「下拉能弹出、但 22 个选项真实鼠标点击 100% 失效」的 P0 缺陷。
 * 根因是宿主的 document mousedown 外部点击监听把 portal 菜单当作「点在外面」，
 * 菜单在 click 之前被卸载。纯函数单测与「只验证弹出/字号」的脚本都测不到这个事件顺序，
 * 所以这里用真实事件序列把整条链路钉死。
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BottomPromptBar } from './BottomPromptBar'
import type { GenerationParams } from '../types'

const BASE_PARAMS: GenerationParams = {
  model: 'gpt-image-2.5',
  dimension: 'auto',
  quality: 'auto',
  count: 1,
  format: 'PNG',
  transparent: false,
  filter: 'auto',
}

type ParamsSpy = ReturnType<typeof vi.fn<(params: GenerationParams) => void>>

function mouse(el: EventTarget, type: string) {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }))
}

function key(el: EventTarget, name: string) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
}

function openMenu(): HTMLElement {
  const menu = document.body.querySelector<HTMLElement>('[role="menu"]')
  if (!menu) throw new Error('下拉菜单没有打开')
  return menu
}

function menuItems(): HTMLElement[] {
  return Array.from(openMenu().querySelectorAll<HTMLElement>('[role="menuitem"], button'))
}

/** 找到胶囊按钮：文案包含给定前缀 */
function capsule(text: string): HTMLElement {
  const button = Array.from(document.querySelectorAll<HTMLElement>('button'))
    .find((el) => el.textContent?.includes(text))
  if (!button) throw new Error(`找不到胶囊按钮：${text}`)
  return button
}

describe('BottomPromptBar 下拉交互（防 BUG-01 回归）', () => {
  let container: HTMLDivElement
  let root: Root
  let onParamsChange: ParamsSpy

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    onParamsChange = vi.fn()
    act(() => {
      root.render(
        <BottomPromptBar
          prompt="一张海报"
          onPromptChange={() => {}}
          onGenerate={() => {}}
          isGenerating={false}
          referenceImages={[]}
          params={BASE_PARAMS}
          onParamsChange={onParamsChange}
          modelOptions={[{ id: 'gpt-image-2.5', label: 'gpt-image-2.5' }]}
          aspectRatios={[
            { label: '自动', res: 'auto' },
            { label: '1:1', res: '1024x1024' },
          ]}
          countOptions={[1, 2, 4]}
          onToggleBatch={() => {}}
        />,
      )
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    document.body.querySelectorAll('[role="menu"]').forEach((el) => el.remove())
    vi.clearAllMocks()
  })

  it('真实鼠标事件序列点选质量 high：mousedown 后菜单仍存活，参数写回', () => {
    act(() => mouse(capsule('质量'), 'click'))
    const high = menuItems().find((el) => el.textContent?.trim() === 'high')
    expect(high).toBeTruthy()

    // 浏览器真实顺序：pointerdown → mousedown → mouseup → click
    act(() => mouse(high!, 'pointerdown'))
    act(() => mouse(high!, 'mousedown'))
    // 核心断言：菜单内容若被外部点击监听提前卸载，这一行会失败（旧版缺陷）
    expect(document.body.contains(high!)).toBe(true)

    act(() => {
      mouse(high!, 'mouseup')
      mouse(high!, 'click')
    })

    expect(onParamsChange).toHaveBeenCalledTimes(1)
    expect(onParamsChange.mock.calls[0][0]).toMatchObject({ quality: 'high' })
  })

  it('尺寸 / 数量 / 更多面板的选项也都能被真实鼠标选中', () => {
    act(() => mouse(capsule('尺寸'), 'click'))
    const ratio = menuItems().find((el) => el.textContent?.trim() === '1:1')
    expect(ratio).toBeTruthy()
    act(() => {
      mouse(ratio!, 'pointerdown')
      mouse(ratio!, 'mousedown')
      expect(document.body.contains(ratio!)).toBe(true)
      mouse(ratio!, 'mouseup')
      mouse(ratio!, 'click')
    })
    expect(onParamsChange.mock.calls[onParamsChange.mock.calls.length - 1]?.[0]).toMatchObject({ dimension: '1024x1024' })

    act(() => mouse(capsule('数量'), 'click'))
    const four = menuItems().find((el) => el.textContent?.trim() === '4 张')
    expect(four).toBeTruthy()
    act(() => {
      mouse(four!, 'pointerdown')
      mouse(four!, 'mousedown')
      mouse(four!, 'mouseup')
      mouse(four!, 'click')
    })
    expect(onParamsChange.mock.calls[onParamsChange.mock.calls.length - 1]?.[0]).toMatchObject({ count: 4 })

    act(() => mouse(capsule('更多'), 'click'))
    const webp = menuItems().find((el) => el.textContent?.trim() === 'WebP')
    expect(webp).toBeTruthy()
    act(() => {
      mouse(webp!, 'pointerdown')
      mouse(webp!, 'mousedown')
      mouse(webp!, 'mouseup')
      mouse(webp!, 'click')
    })
    expect(onParamsChange.mock.calls[onParamsChange.mock.calls.length - 1]?.[0]).toMatchObject({ format: 'WebP' })
  })

  it('键盘 ↑↓ / Enter 能激活选项（BUG-06）', () => {
    act(() => mouse(capsule('质量'), 'click'))
    const items = menuItems()
    expect(items.length).toBeGreaterThan(1)
    act(() => items[0].focus())
    act(() => key(openMenu(), 'ArrowDown'))
    expect(document.activeElement).toBe(items[1])
    act(() => key(openMenu(), 'Enter'))
    expect(onParamsChange.mock.calls[onParamsChange.mock.calls.length - 1]?.[0]).toMatchObject({ quality: items[1].textContent?.trim() })
  })

  it('点击菜单外的空白区域仍能正常关闭下拉', () => {
    act(() => mouse(capsule('更多'), 'click'))
    expect(openMenuSafe()).not.toBeNull()
    act(() => mouse(document.body, 'pointerdown'))
    expect(openMenuSafe()).toBeNull()
  })

  it('模型菜单提供直达模型配置的入口（BUG-03）', () => {
    const onManageModels = vi.fn()
    act(() => {
      root.render(
        <BottomPromptBar
          prompt=""
          onPromptChange={() => {}}
          onGenerate={() => {}}
          isGenerating={false}
          referenceImages={[]}
          params={BASE_PARAMS}
          onParamsChange={onParamsChange}
          modelOptions={[{ id: 'gpt-image-2.5', label: 'gpt-image-2.5' }]}
          onManageModels={onManageModels}
        />,
      )
    })
    act(() => mouse(capsule('gpt-image-2.5'), 'click'))
    const manage = menuItems().find((el) => el.textContent?.includes('管理模型列表'))
    expect(manage).toBeTruthy()
    act(() => {
      mouse(manage!, 'pointerdown')
      mouse(manage!, 'mousedown')
      mouse(manage!, 'mouseup')
      mouse(manage!, 'click')
    })
    expect(onManageModels).toHaveBeenCalledTimes(1)
  })
})

function openMenuSafe(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[role="menu"]')
}
