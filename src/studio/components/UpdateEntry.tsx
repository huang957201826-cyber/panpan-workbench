import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Channel, invoke } from '@tauri-apps/api/core'
import { isTauri } from '../../lib/platform'
import { progressPercent, type UpdateProgress } from '../../lib/appUpdate'
import { useAppUpdateStore } from '../../lib/appUpdateStore'
import { performUpdateCheck, performUpdateDownload, performUpdateInstall } from '../../lib/updateService'

const AUTO_CHECK_DELAY_MS = 4_000

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

export function UpdateEntry() {
  const state = useAppUpdateStore()
  const dispatch = state.dispatch
  const [open, setOpen] = useState(false)
  const autoCheckedRef = useRef(false)
  const busy = state.phase === 'checking' || state.phase === 'downloading'

  const check = async (silent = false) => {
    dispatch({ type: 'check' })
    try {
      const next = await performUpdateCheck(invoke)
      dispatch({ type: 'checked', info: next.info })
      if (next.phase === 'available') setOpen(true)
      else if (!silent) setOpen(true)
    } catch (err) {
      dispatch({ type: 'error', message: messageOf(err) })
      if (!silent) setOpen(true)
    }
  }

  useEffect(() => {
    if (!isTauri || autoCheckedRef.current) return
    autoCheckedRef.current = true
    const timer = window.setTimeout(() => { void check(true) }, AUTO_CHECK_DELAY_MS)
    return () => window.clearTimeout(timer)
    // 仅启动后检查一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const download = async () => {
    if (!state.info) return
    dispatch({ type: 'download' })
    try {
      const channel = new Channel<UpdateProgress>()
      channel.onmessage = (progress) => dispatch({ type: 'progress', progress })
      await performUpdateDownload(invoke, state.info.version, channel)
      dispatch({ type: 'ready' })
    } catch (err) {
      dispatch({ type: 'error', message: messageOf(err) })
    }
  }

  const install = async () => {
    try {
      await performUpdateInstall(invoke)
    } catch (err) {
      dispatch({ type: 'error', message: messageOf(err) })
    }
  }

  if (!isTauri) return null

  const percent = progressPercent(state.progress)
  const version = `v${__APP_VERSION__}`
  const title = state.phase === 'ready'
    ? '更新已下载'
    : state.phase === 'available'
      ? `发现新版本 v${state.info?.version ?? ''}`
      : '检查更新'

  const close = () => {
    if (busy) return
    setOpen(false)
    if (state.phase === 'latest' || state.phase === 'error') dispatch({ type: 'reset' })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (state.phase === 'ready' || state.phase === 'available') setOpen(true)
          else void check(false)
        }}
        className="relative flex h-5 max-w-[40px] items-center justify-center rounded-md text-micro font-mono text-slate-400 transition hover:bg-black/[0.04] hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
        title={`当前版本 ${version} · 点击检查更新`}
        aria-label={`当前版本 ${version}，检查更新`}
      >
        {version}
        {(state.phase === 'available' || state.phase === 'ready') && (
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
        )}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" onClick={close}>
          <div
            className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-5 text-slate-800 shadow-2xl dark:border-white/10 dark:bg-[#161822] dark:text-slate-100"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="客户端更新"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">{title}</h3>
              {!busy && (
                <button type="button" onClick={close} className="rounded-md px-1.5 py-0.5 text-slate-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.1]" aria-label="关闭">×</button>
              )}
            </div>

            <div className="mt-3 space-y-2 text-body leading-relaxed text-slate-600 dark:text-slate-300">
              {state.phase === 'checking' && <p>正在检查更新…</p>}

              {state.phase === 'latest' && <p>已是最新版本 {version}。</p>}

              {state.phase === 'available' && (
                <>
                  <p>当前 {version}，可更新到 v{state.info?.version}。是否下载并安装？</p>
                  {state.info?.notes && (
                    <div className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-black/[0.04] p-2 text-body-sm dark:bg-white/[0.06]">
                      {state.info.notes}
                    </div>
                  )}
                </>
              )}

              {state.phase === 'downloading' && (
                <>
                  <p>正在下载更新包…{percent === null ? '' : ` ${percent}%`}</p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-black transition-all dark:bg-white"
                      style={{ width: `${percent ?? 15}%` }}
                    />
                  </div>
                </>
              )}

              {state.phase === 'ready' && (
                <p>更新包已下载并通过签名校验。安装后应用会重启。</p>
              )}

              {state.phase === 'error' && (
                <p className="text-red-500">{state.error}</p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2 text-body-sm">
              {state.phase === 'available' && (
                <>
                  <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 text-slate-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">稍后</button>
                  <button type="button" onClick={() => void download()} className="rounded-lg bg-black px-3 py-1.5 text-white dark:bg-white dark:text-black">下载并安装</button>
                </>
              )}
              {state.phase === 'downloading' && (
                <button type="button" disabled className="rounded-lg bg-black/10 px-3 py-1.5 text-slate-400 dark:bg-white/10">下载中…</button>
              )}
              {state.phase === 'ready' && (
                <>
                  <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 text-slate-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">稍后</button>
                  <button type="button" onClick={() => void install()} className="rounded-lg bg-black px-3 py-1.5 text-white dark:bg-white dark:text-black">立即重启安装</button>
                </>
              )}
              {state.phase === 'error' && (
                <>
                  <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 text-slate-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">关闭</button>
                  <button type="button" onClick={() => void check(false)} className="rounded-lg bg-black px-3 py-1.5 text-white dark:bg-white dark:text-black">重试</button>
                </>
              )}
              {(state.phase === 'latest' || state.phase === 'checking') && (
                <button type="button" disabled={busy} onClick={close} className="rounded-lg bg-black px-3 py-1.5 text-white disabled:opacity-40 dark:bg-white dark:text-black">关闭</button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
