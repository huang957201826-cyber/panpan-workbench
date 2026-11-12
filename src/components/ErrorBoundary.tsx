import { Component, type ErrorInfo, type ReactNode } from 'react'
import { copyTextToClipboard } from '../lib/clipboard'
import { buildDiagnostics, sanitizeDiagnostics } from '../lib/diagnostics'
import { isTauri } from '../lib/platform'
import { openTauriLogDir } from '../lib/tauriLog'

interface State {
  error: Error | null
}

/** 顶层错误边界：渲染异常时保留可操作页面，而不是白屏。 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('React 渲染失败：', error, info.componentStack)
  }

  private copy = async () => {
    const text = buildDiagnostics(this.state.error, {
      版本: __APP_VERSION__,
      地址: location.href,
      客户端: isTauri ? 'Tauri' : 'Web',
    })
    try {
      await copyTextToClipboard(text)
      alert('诊断信息已复制（敏感字段已脱敏）。')
    } catch (err) {
      console.error('复制诊断失败：', err)
      alert('复制失败，请打开日志目录后反馈。')
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-gray-800 dark:bg-gray-950 dark:text-gray-100">
        <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
          <h1 className="text-lg font-bold">页面出现错误</h1>
          <p className="mt-2 text-body text-gray-500 dark:text-gray-400">
            可以直接重新加载。若反复出现，请打开日志目录并把日志或复制出的诊断信息发给维护者。
          </p>
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-gray-100 p-3 text-body-sm text-gray-600 dark:bg-black/30 dark:text-gray-300">
            {sanitizeDiagnostics(this.state.error.message)}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-body font-medium text-white" onClick={() => location.reload()}>
              重新加载
            </button>
            <button type="button" className="rounded-xl bg-gray-100 px-4 py-2 text-body font-medium dark:bg-white/10" onClick={this.copy}>
              复制诊断
            </button>
            {isTauri && (
              <button
                type="button"
                className="rounded-xl bg-gray-100 px-4 py-2 text-body font-medium dark:bg-white/10"
                onClick={() => void openTauriLogDir().catch((err) => alert(String(err)))}
              >
                打开日志
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
}
