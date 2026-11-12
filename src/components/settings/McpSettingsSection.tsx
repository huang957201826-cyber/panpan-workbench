import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '../../lib/platform'
import { useStore } from '../../store'

interface McpStatus {
  enabled: boolean
  running: boolean
  port: number
  writeEnabled: boolean
  token: string
  error: string | null
}

interface AuditEntry {
  tool: string
  at: number
  elapsedMs: number
  ok: boolean
  detail: string
}

const ROW = 'flex items-center justify-between gap-3'

export default function McpSettingsSection() {
  const showToast = useStore((s) => s.showToast)
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [port, setPort] = useState('7331')
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    if (!isTauri) return
    try {
      const next = await invoke<McpStatus>('mcp_status')
      setStatus(next)
      setPort(String(next.port))
      setAudit(await invoke<AuditEntry[]>('mcp_recent_calls'))
    } catch (err) {
      console.warn('读取 MCP 状态失败：', err)
    }
  }

  useEffect(() => {
    if (!isTauri) return
    void refresh()
    const unlisten = listen('mcp-status-changed', () => void refresh())
    const timer = window.setInterval(() => {
      void invoke<AuditEntry[]>('mcp_recent_calls').then(setAudit).catch(() => {})
    }, 5000)
    return () => {
      window.clearInterval(timer)
      void unlisten.then((fn) => fn())
    }
  }, [])

  if (!isTauri) return null

  const configure = async (patch: Partial<Pick<McpStatus, 'enabled' | 'writeEnabled'>> & { port?: number }) => {
    if (!status || busy) return
    setBusy(true)
    try {
      const next = await invoke<McpStatus>('mcp_configure', {
        enabled: patch.enabled ?? status.enabled,
        port: patch.port ?? status.port,
        writeEnabled: patch.writeEnabled ?? status.writeEnabled,
      })
      setStatus(next)
      setPort(String(next.port))
      if (next.error) showToast(next.error, 'error')
      else showToast(next.running ? 'MCP 服务已启动' : 'MCP 服务已停止', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const rotate = async () => {
    if (busy) return
    setBusy(true)
    try {
      const next = await invoke<McpStatus>('mcp_rotate_token')
      setStatus(next)
      showToast('MCP token 已轮换', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const token = status?.token ?? ''
  const clientConfig = JSON.stringify({
    mcpServers: {
      'panpan-workbench': {
        type: 'http',
        url: `http://127.0.0.1:${status?.port ?? 7331}/mcp`,
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  }, null, 2)

  return (
    <section className="space-y-4">
      <div>
        <h4 className="text-body font-bold text-gray-800 dark:text-gray-100">本机 MCP</h4>
        <div className="mt-1 text-body-sm leading-relaxed text-gray-500 dark:text-gray-500">
          {status?.running
            ? `运行中：http://127.0.0.1:${status.port}/mcp`
            : status?.enabled ? '已开启但未监听（查看下方错误）' : '默认关闭；未开启时不监听端口'}
        </div>
      </div>

      <div className={ROW}>
        <span className="text-body text-gray-600 dark:text-gray-300">启用 MCP 服务</span>
        <button
          type="button"
          disabled={busy || !status}
          onClick={() => void configure({ enabled: !status?.enabled })}
          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors disabled:opacity-50 ${status?.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
          role="switch"
          aria-checked={Boolean(status?.enabled)}
          aria-label="启用 MCP 服务"
        >
          <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${status?.enabled ? 'translate-x-[14px]' : 'translate-x-[2px]'}`} />
        </button>
      </div>

      <div className={ROW}>
        <span className="text-body text-gray-600 dark:text-gray-300">端口</span>
        <div className="flex items-center gap-2">
          <input
            value={port}
            onChange={(event) => setPort(event.target.value.replace(/[^0-9]/g, ''))}
            className="w-24 rounded-lg border border-transparent bg-black/[0.04] px-2 py-1 text-body-sm outline-none dark:bg-white/[0.06]"
            inputMode="numeric"
            aria-label="MCP 端口"
          />
          <button
            type="button"
            disabled={busy || !status}
            onClick={() => {
              const value = Number(port)
              if (!Number.isInteger(value) || value < 1024 || value > 65535) {
                showToast('端口必须在 1024–65535 之间', 'error')
                return
              }
              void configure({ port: value })
            }}
            className="rounded-lg bg-black/[0.06] px-2 py-1 text-body-sm text-gray-700 hover:bg-black/[0.1] dark:bg-white/[0.08] dark:text-gray-200"
          >
            应用并重启
          </button>
        </div>
      </div>

      <div className={ROW}>
        <span className="text-body text-gray-600 dark:text-gray-300">允许写入工具</span>
        <button
          type="button"
          disabled={busy || !status}
          onClick={() => void configure({ writeEnabled: !status?.writeEnabled })}
          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors disabled:opacity-50 ${status?.writeEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
          role="switch"
          aria-checked={Boolean(status?.writeEnabled)}
          aria-label="允许写入工具"
        >
          <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${status?.writeEnabled ? 'translate-x-[14px]' : 'translate-x-[2px]'}`} />
        </button>
      </div>
      <div className="text-body-sm text-gray-500 dark:text-gray-500">
        写入工具默认关闭。开启后每次 task.create / image.attach 都会在主窗口弹出确认框。
      </div>

      <div className="space-y-2 rounded-xl bg-black/[0.03] p-3 dark:bg-white/[0.04]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-body-sm font-medium text-gray-600 dark:text-gray-300">Bearer token</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!token}
              onClick={() => void navigator.clipboard.writeText(token).then(() => showToast('token 已复制', 'success'))}
              className="rounded-lg bg-black/[0.06] px-2 py-1 text-body-sm text-gray-700 dark:bg-white/[0.08] dark:text-gray-200"
            >
              复制
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void rotate()}
              className="rounded-lg bg-black/[0.06] px-2 py-1 text-body-sm text-gray-700 dark:bg-white/[0.08] dark:text-gray-200"
            >
              轮换
            </button>
          </div>
        </div>
        <div className="break-all font-mono text-body-sm text-gray-600 dark:text-gray-300">
          {token ? `${token.slice(0, 8)}…${token.slice(-8)}` : '尚未生成'}
        </div>
      </div>

      {status?.error && <div className="rounded-lg bg-red-500/[0.08] px-3 py-2 text-body-sm text-red-600 dark:text-red-400">{status.error}</div>}

      <div className="flex items-center justify-between gap-2">
        <span className="text-body-sm font-medium text-gray-600 dark:text-gray-300">客户端配置</span>
        <button
          type="button"
          disabled={!token}
          onClick={() => void navigator.clipboard.writeText(clientConfig).then(() => showToast('客户端配置已复制', 'success'))}
          className="rounded-lg bg-black/[0.06] px-2 py-1 text-body-sm text-gray-700 dark:bg-white/[0.08] dark:text-gray-200"
        >
          复制 JSON
        </button>
      </div>

      <div>
        <div className="mb-1 text-body-sm font-medium text-gray-600 dark:text-gray-300">最近调用</div>
        {audit.length === 0 ? (
          <div className="text-body-sm text-gray-400">暂无调用</div>
        ) : (
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {audit.map((entry, index) => (
              <div key={`${entry.at}-${index}`} className="flex items-center justify-between gap-2 text-body-sm text-gray-500 dark:text-gray-400">
                <span className="truncate font-mono">{entry.tool}</span>
                <span className={entry.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                  {entry.ok ? '成功' : '失败'} · {entry.elapsedMs}ms
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
