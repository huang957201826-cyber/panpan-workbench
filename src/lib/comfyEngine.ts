import { invoke } from '@tauri-apps/api/core'
import { apiFetch, isTauri } from '../lib/platform'

const STORAGE_KEY = 'panpan-comfy-engine-url'
export const DEFAULT_ENGINE_URL = 'http://127.0.0.1:8188'

/** 读取本地引擎地址；未配置时回落到 ComfyUI 默认端口 */
export function getEngineUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || DEFAULT_ENGINE_URL
  } catch {
    return DEFAULT_ENGINE_URL
  }
}

export function setEngineUrl(url: string): void {
  const next = url.trim() || DEFAULT_ENGINE_URL
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch (err) {
    console.warn('保存本地引擎地址失败：', err)
  }
}

export interface EngineDevice {
  name: string
  vramTotalGb: number
}

export interface EngineProbe {
  ok: boolean
  version?: string
  devices?: EngineDevice[]
  error?: string
  /** 引擎是本应用启动的（而不是用户自己开的） */
  managed?: boolean
}

interface SystemStatsPayload {
  system?: { comfyui_version?: string; python_version?: string }
  devices?: Array<{ name?: string; vram_total?: number }>
}

/** 客户端由 Rust 侧拉起引擎，网页版读不到本机进程 */
export interface EngineProcessInfo {
  running: boolean
  pid: number | null
  url: string
  detail: string
}

export async function startEngineProcess(): Promise<EngineProcessInfo> {
  return await invoke<EngineProcessInfo>('comfy_engine_start')
}

export async function stopEngineProcess(): Promise<void> {
  await invoke('comfy_engine_stop')
}

export async function readEngineProcess(): Promise<EngineProcessInfo> {
  return await invoke<EngineProcessInfo>('comfy_engine_status')
}

/**
 * 确保引擎在线：先探测，没起来就交给 Rust 侧拉起子进程，再轮询到端口就绪。
 * 用户不需要额外双击任何脚本。
 */
export async function ensureEngine(timeoutMs = 120000): Promise<EngineProbe> {
  const first = await probeEngine()
  if (first.ok) return { ...first, managed: true }
  if (!isTauri) return first

  try {
    await startEngineProcess()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const next = await probeEngine()
    if (next.ok) return { ...next, managed: true }
  }
  return {
    ok: false,
    error: '引擎启动超时：模型加载慢或启动失败，详情见 D:\\AI\\ComfyUI\\comfy-app.log',
  }
}


const PROBE_TIMEOUT_MS = 5000

/** 探测 ComfyUI 是否可用；失败时给出可直接照做的中文原因 */
export async function probeEngine(url = getEngineUrl()): Promise<EngineProbe> {
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: '地址需要以 http:// 或 https:// 开头' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const response = await apiFetch(`${url.replace(/\/+$/, '')}/system_stats`, { signal: controller.signal })
    if (!response.ok) {
      return { ok: false, error: `引擎返回 ${response.status}，请确认地址指向 ComfyUI 而不是别的服务` }
    }
    const payload = (await response.json()) as SystemStatsPayload
    const devices = (payload.devices ?? [])
      .filter((device) => device.name)
      .map((device) => ({
        name: String(device.name),
        vramTotalGb: Math.round(((device.vram_total ?? 0) / 1024 ** 3) * 10) / 10,
      }))
    return { ok: true, version: payload.system?.comfyui_version, devices }
  } catch (err) {
    if (controller.signal.aborted) {
      return { ok: false, error: '连接超时：ComfyUI 可能没有启动，或端口不是 8188' }
    }
    // 客户端由 Rust 侧发请求，不受跨域限制；网页版则会在这里撞 CORS
    if (!isTauri) {
      return { ok: false, error: '浏览器拒绝了连接：ComfyUI 需要加 --enable-cors-header 才能被网页调用' }
    }
    return { ok: false, error: '连不上：请确认 ComfyUI 已启动，且地址和端口填写正确' }
  } finally {
    clearTimeout(timer)
  }
}

/** 需要检查文件是否存在的节点；用它们的枚举判断模型装没装 */
const MODEL_CLASSES = [
  'UNETLoader',
  'CLIPLoader',
  'VAELoader',
  'UpscaleModelLoader',
  'LoadBackgroundRemovalModel',
  'ControlNetLoader',
  'LoraLoader',
]

/** 读取引擎已安装的模型文件名集合；失败时返回空集合，不阻塞界面 */
export async function fetchAvailableModels(): Promise<Set<string>> {
  const base = getEngineUrl().replace(/\/+$/, '')
  const result = new Set<string>()
  await Promise.all(
    MODEL_CLASSES.map(async (cls) => {
      try {
        const response = await apiFetch(`${base}/object_info/${cls}`, { cache: 'no-store' })
        if (!response.ok) return
        const payload = (await response.json()) as Record<string, { input?: { required?: Record<string, unknown> } }>
        const node = payload[cls]
        for (const spec of Object.values(node?.input?.required ?? {})) {
          if (!Array.isArray(spec)) continue
          // 老格式：[[可选值...], {...}]；新格式：['COMBO', { options: [...] }]
          const first = spec[0]
          const values = Array.isArray(first)
            ? first
            : first === 'COMBO' && spec[1] && typeof spec[1] === 'object'
              ? ((spec[1] as { options?: unknown }).options as unknown[])
              : null
          if (!Array.isArray(values)) continue
          for (const value of values) {
            if (typeof value === 'string') result.add(value)
          }
        }
      } catch {
        // 单个节点查询失败不影响其他节点
      }
    }),
  )
  return result
}