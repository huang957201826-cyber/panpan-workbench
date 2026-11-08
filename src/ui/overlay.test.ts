// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { isTopmostOverlay, trapTabKey } from './overlay'

function overlay(id: string) {
  const el = document.createElement('div')
  el.id = id
  el.setAttribute('data-overlay', '')
  document.body.appendChild(el)
  return el
}

function tabEvent(shiftKey = false) {
  return new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
}

describe('isTopmostOverlay（Esc 只由栈顶消费）', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('没有浮层时任何节点都不是栈顶', () => {
    expect(isTopmostOverlay(null)).toBe(false)
    expect(isTopmostOverlay(document.createElement('div'))).toBe(false)
  })

  it('只有最后一个 data-overlay 节点响应 Esc', () => {
    const bottom = overlay('bottom')
    const top = overlay('top')
    expect(isTopmostOverlay(bottom)).toBe(false)
    expect(isTopmostOverlay(top)).toBe(true)
  })

  it('栈顶关闭后，下一层自动变成栈顶', () => {
    const bottom = overlay('bottom')
    const top = overlay('top')
    top.remove()
    expect(isTopmostOverlay(bottom)).toBe(true)
  })
})

describe('trapTabKey（Modal 焦点陷阱）', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('非 Tab 键不接管', () => {
    const dialog = overlay('dialog')
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true })
    expect(trapTabKey(event, dialog)).toBe(false)
    expect(event.defaultPrevented).toBe(false)
  })

  it('在最后一个可聚焦元素上按 Tab 回到第一个', () => {
    const dialog = overlay('dialog')
    const first = document.createElement('button')
    const last = document.createElement('button')
    dialog.append(first, last)
    last.focus()
    const event = tabEvent()
    expect(trapTabKey(event, dialog)).toBe(true)
    expect(document.activeElement).toBe(first)
  })

  it('在第一个可聚焦元素上按 Shift+Tab 跳到最后一个', () => {
    const dialog = overlay('dialog')
    const first = document.createElement('button')
    const last = document.createElement('button')
    dialog.append(first, last)
    first.focus()
    const event = tabEvent(true)
    expect(trapTabKey(event, dialog)).toBe(true)
    expect(document.activeElement).toBe(last)
  })

  it('弹层内没有可聚焦元素时把焦点留在容器上', () => {
    const dialog = overlay('dialog')
    dialog.tabIndex = -1
    const event = tabEvent()
    expect(trapTabKey(event, dialog)).toBe(true)
    expect(document.activeElement).toBe(dialog)
  })

  it('hidden 容器里的控件不参与循环', () => {
    const dialog = overlay('dialog')
    const hiddenWrap = document.createElement('div')
    hiddenWrap.hidden = true
    const hiddenButton = document.createElement('button')
    hiddenWrap.appendChild(hiddenButton)
    const visible = document.createElement('button')
    dialog.append(hiddenWrap, visible)
    visible.focus()
    const event = tabEvent()
    expect(trapTabKey(event, dialog)).toBe(true)
    expect(document.activeElement).toBe(visible)
  })
})
