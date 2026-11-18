import { useEffect, useState } from 'react'
import { openExternal } from '../../lib/platform'
import { ensureEngine, probeEngine, readEngineProcess, type EngineProbe } from '../../lib/comfyEngine'

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
export function EngineRow({ engine }: { engine: EngineStatusState }) {
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
        <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-700 dark:text-slate-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          本地引擎运行中
          {engine.probe.version && <span className="font-mono text-[10.5px] text-slate-400">v{engine.probe.version}</span>}
        </div>
        <div className="text-[10.5px] text-slate-400 truncate">{deviceLabel(engine.probe)}</div>
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
        <div className="text-[10.5px] text-slate-400 truncate">{engine.detail || engine.probe?.error || 'D:\\AI\\ComfyUI'}</div>
      </div>
      <button
        type="button"
        onClick={() => void engine.start()}
        disabled={engine.starting}
        className="h-6.5 px-2.5 rounded-full bg-black text-white dark:bg-white dark:text-black text-[10.5px] font-semibold shrink-0 disabled:opacity-50 cursor-pointer"
      >
        {engine.starting ? '启动中…' : '启动'}
      </button>
    </div>
  )
}

/** 未运行时的居中引导卡片 */
export function LocalEngineCard({ engine }: { engine: EngineStatusState }) {
  const installMissing = /未找到|不存在|no such|not found/i.test(engine.detail || engine.probe?.error || '')

  if (engine.checking && !engine.probe) {
    return (
      <div className="absolute inset-x-0 top-16 z-30 flex justify-center pointer-events-none">
        <div className="rounded-full bg-white/95 dark:bg-[#141620]/95 border border-black/[0.06] dark:border-white/[0.08] px-4 py-2 text-[11.5px] text-slate-500 shadow-lg">
          正在检测本地引擎…
        </div>
      </div>
    )
  }

  if (engine.probe?.ok) return null

  return (
    <div className="absolute inset-x-0 top-20 z-30 flex justify-center pointer-events-none px-6">
      <div className="pointer-events-auto w-full max-w-[520px] rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.08] dark:border-white/[0.08] shadow-2xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[13.5px] font-bold text-slate-900 dark:text-white">本地引擎</h3>
            <p className="text-[11.5px] text-slate-400 mt-0.5">
              {installMissing ? '还没有检测到 ComfyUI' : '检测到引擎已安装但没有运行'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void engine.refresh()}
            className="h-7 px-3 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition cursor-pointer shrink-0"
          >
            重新检测
          </button>
        </div>

        <div className="rounded-xl bg-[#f8f9fc] dark:bg-white/[0.03] p-3 space-y-1 text-[11.5px] text-slate-500 dark:text-slate-400">
          <div>
            默认安装位置：<span className="font-mono text-slate-700 dark:text-slate-200">D:\AI\ComfyUI</span>
          </div>
          <div>
            可用环境变量 <span className="font-mono">PANPAN_COMFY_ROOT</span> 指向其他目录。
          </div>
          {engine.detail && <div className="text-slate-400 break-all">{engine.detail}</div>}
          {engine.probe?.error && <div className="text-rose-500 break-all">{engine.probe.error}</div>}
          {engine.startError && <div className="text-rose-500 break-all">{engine.startError}</div>}
        </div>

        <p className="text-[11px] leading-relaxed text-slate-400">
          装好 portable 包后解压到上面的目录（或改环境变量），再点重新检测；引擎已安装时可直接一键启动。
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void openExternal(DOWNLOAD_URL)}
            className="h-8 px-3.5 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] text-[11.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition cursor-pointer"
          >
            下载 ComfyUI
          </button>
          {!installMissing && (
            <button
              type="button"
              onClick={() => void engine.start()}
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
