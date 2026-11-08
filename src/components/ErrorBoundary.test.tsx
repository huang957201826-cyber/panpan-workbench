// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

function Broken(): never {
  throw new Error('render exploded sk-12345678')
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('renders an actionable fallback and logs the error', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(
        <ErrorBoundary>
          <Broken />
        </ErrorBoundary>,
      )
    })

    expect(container.textContent).toContain('页面出现错误')
    expect(container.textContent).toContain('重新加载')
    expect(container.textContent).toContain('复制诊断')
    expect(container.textContent).not.toContain('sk-12345678')
    expect(consoleError).toHaveBeenCalled()
  })
})
