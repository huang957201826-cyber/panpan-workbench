import { useEffect, useState } from 'react'
import { openExternal } from '../../lib/platform'
import {
  DEFAULT_ENGINE_ROOT,
  DEFAULT_ENGINE_URL,
  ensureEngine,
  getEngineRoot,
  getEngineUrl,
  probeEngine,
  readEngineProcess,
  setEngineRoot,
  setEngineUrl,
  type EngineProbe,
} from '../../lib/comfyEngine'

const DOWNLOAD_URL = 'https://github.com/comfyanonymous/ComfyUI/releases'

export interface EngineStatusState {
  probe: EngineProbe | null
  detail: string
  checking: boolean
  starting: boolean
  startError: string
  refresh: (silent?: boolean) => Promise<void>
  start: () => Promise<void>
}

/** 引擎状态：每 5 秒复检，页面隐藏时暂停；聚焦、恢复可见或运行失败时立即重探 */
export function useEngineStatus(): EngineStatusState {
  const [probe, setProbe] = useState<EngineProbe | null>(null)
  const [detail, setDetail] = useState('')
  const [checking, setChecking] = useState(true)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')

  const refresh = async (silent = false) => {
    if (!silent) setChecking(true)
    try {
      const [next, process] = await Promise.all([probeEngine(), readEngineProcess().catch(() => null)])
      setProbe(next)
      setDetail(process?.detail ?? '')
    } catch (err) {
      setProbe({ ok: false, error: err instanceof Error ? err.message : String(err) })
      setDetail('')
    } finally {
      if (!silent) setChecking(false)
    }
  }

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      if (document.hidden) return
      void refresh(true)
    }, 5000)
    const onFocus = () => void refresh(true)
    const onRecheck = () => void refresh(true)
    const onVisible = () => {
      if (!document.hidden) void refresh(true)
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('panpan-engine-recheck', onRecheck)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('panpan-engine-recheck', onRecheck)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const start = async () => {
    setStarting(true)
    setStartError('')
    try {
      const next = await ensureEngine()
      setProbe(next)
      if (!next.ok) setStartError(next.error ?? '启动失败')
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err))
    } finally {
      setStarting(false)
    }
  }

  return { probe, detail, checking, starting, startError, refresh, start }
}

function deviceLabel(probe: EngineProbe | null) {
  const device = probe?.devices?.[0]
  return device ? `${device.name} · ${device.vramTotalGb}GB` : ''
}

/** 左栏里的一行引擎状态 */
export function EngineRow({
  engine,
  onConfigure,
}: {
  engine: EngineStatusState
  onConfigure?: () => void
}) {
  if (engine.checking && !engine.probe) {
    return (
      <div className="rounded-xl bg-[#f8f9fc] dark:bg-white/[0.03] px-3 py-2 text-[11px] text-slate-400">
        正在检测本地引擎…
      </div>
    )
  }

  if (engine.probe?.ok) {
    return (
      <div className="rounded-xl bg-[#f8f9fc] dark:bg-white/[0.03] px-3 py-2 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-700 dark:text-slate-200 min-w-0">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate">本地引擎运行中</span>
            {engine.probe.version && <span className="font-mono text-[10.5px] text-slate-400">v{engine.probe.version}</span>}
          </div>
          {onConfigure && (
            <button
              type="button"
              onClick={onConfigure}
              className="shrink-0 text-[10.5px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
            >
              地址
            </button>
          )}
        </div>
        <div className="text-[10.5px] text-slate-400 truncate">{deviceLabel(engine.probe) || getEngineUrl()}</div>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-[#f8f9fc] dark:bg-white/[0.03] px-3 py-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-700 dark:text-slate-200">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          引擎未运行
        </div>
        <div className="text-[10.5px] text-slate-400 truncate">
          {engine.detail || engine.probe?.error || getEngineRoot()}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onConfigure && (
          <button
            type="button"
            onClick={onConfigure}
            className="h-6.5 px-2 rounded-full bg-black/[0.06] dark:bg-white/[0.1] text-[10.5px] font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            地址
          </button>
        )}
        <button
          type="button"
          onClick={() => void engine.start()}
          disabled={engine.starting}
          className="h-6.5 px-2.5 rounded-full bg-black text-white dark:bg-white dark:text-black text-[10.5px] font-semibold shrink-0 disabled:opacity-50 cursor-pointer"
        >
          {engine.starting ? '启动中…' : '启动'}
        </button>
      </div>
    </div>
  )
}

/** 未运行时的居中引导卡片，也可由用户主动点开配置本机目录或远程/局域网 ComfyUI 地址 */
export function LocalEngineCard({
  engine,
  forceOpen = false,
  onClose,
}: {
  engine: EngineStatusState
  forceOpen?: boolean
  onClose?: () => void
}) {
  const [dismissed, setDismissed] = useState(false)
  const [urlInput, setUrlInput] = useState(() => getEngineUrl())
  const [rootInput, setRootInput] = useState(() => getEngineRoot())
  const installMissing = /未找到|不存在|no such|not found/i.test(engine.detail || engine.probe?.error || '')

  useEffect(() => {
    if (forceOpen) {
      setUrlInput(getEngineUrl())
      setRootInput(getEngineRoot())
    }
  }, [forceOpen])

  const handleClose = () => {
    setDismissed(true)
    onClose?.()
  }

  const handleSaveUrl = (event: React.FormEvent) => {
    event.preventDefault()
    const normalized = urlInput.trim() || DEFAULT_ENGINE_URL
    const normalizedRoot = rootInput.trim() || DEFAULT_ENGINE_ROOT
    setEngineUrl(normalized)
    setEngineRoot(normalizedRoot)
    setUrlInput(normalized)
    setRootInput(normalizedRoot)
    void engine.refresh()
  }

  const handleStartLocalEngine = () => {
    const normalizedRoot = rootInput.trim() || DEFAULT_ENGINE_ROOT
    setEngineRoot(normalizedRoot)
    setRootInput(normalizedRoot)
    void engine.start()
  }

  if (!forceOpen && dismissed) return null

  if (!forceOpen && engine.checking && !engine.probe) {
    return (
      <div className="absolute inset-x-0 top-16 z-30 flex justify-center pointer-events-none">
        <div className="rounded-full bg-white/95 dark:bg-[#141620]/95 border border-black/[0.06] dark:border-white/[0.08] px-4 py-2 text-[11.5px] text-slate-500 shadow-lg">
          正在检测本地引擎…
        </div>
      </div>
    )
  }

  if (!forceOpen && engine.probe?.ok) return null

  const connected = Boolean(engine.probe?.ok)
  const subtitle = connected
    ? `已连接${engine.probe?.version ? ` v${engine.probe.version}` : ''}${deviceLabel(engine.probe) ? ` · ${deviceLabel(engine.probe)}` : ''}`
    : installMissing
      ? '还没有检测到 ComfyUI'
      : '检测到引擎未运行，可下载官方包到本机运行或连接局域网地址'

  return (
    <div className="absolute inset-x-0 top-14 sm:top-20 z-30 flex justify-center pointer-events-none px-3 sm:px-6">
      <div className="pointer-events-auto w-full max-w-[520px] max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.08] dark:border-white/[0.08] shadow-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              本地引擎
            </h3>
            <p className="text-[11.5px] text-slate-400 mt-0.5">{subtitle}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void engine.refresh()}
              className="h-7 px-3 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition cursor-pointer"
            >
              {engine.checking ? '检测中…' : '重新检测'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] text-[13px] text-slate-500 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition cursor-pointer"
              title="收起提示"
              aria-label="收起引擎提示"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveUrl} className="space-y-2.5">
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              本地引擎安装目录
            </label>
            <input
              type="text"
              value={rootInput}
              onChange={(event) => setRootInput(event.target.value)}
              placeholder={DEFAULT_ENGINE_ROOT}
              className="h-9 w-full rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-[#f8f9fc] dark:bg-white/[0.04] px-3 text-[12px] font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-black/30 dark:focus:border-white/30"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              ComfyUI 服务地址
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder={DEFAULT_ENGINE_URL}
                className="h-9 flex-1 min-w-0 rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-[#f8f9fc] dark:bg-white/[0.04] px-3 text-[12px] font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-black/30 dark:focus:border-white/30"
              />
              <button
                type="submit"
                disabled={engine.checking}
                className="h-9 shrink-0 rounded-xl bg-black px-3.5 text-[11.5px] font-semibold text-white dark:bg-white dark:text-black disabled:opacity-50 cursor-pointer"
              >
                保存并连接
              </button>
            </div>
          </div>
        </form>

        <div className="rounded-xl bg-[#f8f9fc] dark:bg-white/[0.03] p-3 space-y-1 text-[11.5px] text-slate-500 dark:text-slate-400">
          <div>
            默认安装位置：<span className="font-mono text-slate-700 dark:text-slate-200">{DEFAULT_ENGINE_ROOT}</span>
          </div>
          {engine.detail && <div className="text-slate-400 break-all">{engine.detail}</div>}
          {!connected && engine.probe?.error && <div className="text-rose-500 break-all">{engine.probe.error}</div>}
          {engine.startError && <div className="text-rose-500 break-all">{engine.startError}</div>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void openExternal(DOWNLOAD_URL)}
            className="h-8 px-3.5 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] text-[11.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition cursor-pointer"
          >
            下载 ComfyUI
          </button>
          {!connected && (
            <button
              type="button"
              onClick={handleStartLocalEngine}
              disabled={engine.starting}
              className="h-8 px-3.5 rounded-full bg-black text-white dark:bg-white dark:text-black text-[11.5px] font-semibold hover:opacity-90 transition cursor-pointer disabled:opacity-50"
            >
              {engine.starting ? '正在启动引擎…' : '启动引擎'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
