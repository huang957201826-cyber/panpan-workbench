import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { StateStorage } from 'zustand/middleware'
import { call } from './dbTauri'
import { decryptPersistedSettings, migratePersistedSettingsSecrets } from './secrets'
import { showBrowserNotification } from './browserNotification'

// 设置每次变化都会触发 persist 写入，合并到停顿后再写库
const FLUSH_DELAY_MS = 300
// 关闭窗口和安装更新前最多等待写入这么久，某次写入挂起时仍能继续退出
const EXIT_FLUSH_TIMEOUT_MS = 3000

const cache = new Map<string, string>()
const dirty = new Set<string>()
let timer: ReturnType<typeof setTimeout> | undefined
let writing = Promise.resolve()
let loadError: (Error & { code?: string }) | null = null
let secretCleanupError: string | null = null
let storageErrorHandler: ((message: string) => void) | null = null
let lastStorageErrorAt = 0

/** 注册设置写入失败的 UI 提示；同一原因最多每 10 秒提示一次 */
export function setStorageErrorHandler(handler: ((message: string) => void) | null) {
  storageErrorHandler = handler
}

function notifyStorageError(key: string, err: unknown) {
  console.error(`保存本地设置失败（${key}）：`, err)
  const now = Date.now()
  if (now - lastStorageErrorAt < 10_000) return
  lastStorageErrorAt = now
  storageErrorHandler?.('设置保存失败，可能是磁盘空间不足或数据库被占用。修改会在下次写入时重试。')
}

/** 启动时在 store 创建前调用：把 SQLite 中的全部 kv 读入内存，之后 persist 可以同步完成 hydration */
export async function loadTauriStorage() {
  try {
    const all = await call<Record<string, string>>('kv_get_all')
    for (const [key, value] of Object.entries(all)) cache.set(key, value)
    const settingsKey = 'gpt-image-playground'
    const raw = cache.get(settingsKey)
    if (raw) {
      // 旧明文 API Key 落盘为 DPAPI 密文；失败时保留原值，绝不删除旧 Key
      try {
        const migrated = await migratePersistedSettingsSecrets(raw)
        if (migrated) {
          await call('kv_set', { key: settingsKey, value: migrated })
          console.info('API Key 已迁移为 DPAPI 密文')
        }
        // 首次迁移的 raw 还是明文，必须用迁移后的值判断，当次就清理 WAL/主库明文
        const current = migrated ?? raw
        if (current.includes('dpapi:v1:')) {
          try {
            await call('storage_secure_cleanup')
            secretCleanupError = null
          } catch (err) {
            secretCleanupError = `API Key 旧明文清理未完成：${err instanceof Error ? err.message : String(err)}`
            console.error('API Key 旧明文清理失败，下次启动重试：', err)
          }
        }
      } catch (err) {
        console.error('API Key 加密迁移失败，保留原明文：', err)
      }
      // store 在内存中使用明文；密文只在 kv 中保存
      try {
        cache.set(settingsKey, await decryptPersistedSettings(raw))
      } catch (err) {
        console.error('读取 API Key 失败：', err)
      }
    }
  } catch (err) {
    // 没读到已有设置时不能回写，否则默认值会覆盖库中的设置
    loadError = err as Error & { code?: string }
    console.error('读取本地设置失败：', err)
  }
}

/** 启动时读取设置失败的错误（此后设置不会写入），成功时返回 null */
export function getTauriStorageLoadError() {
  return loadError
}

/** API Key 旧明文清理（WAL/空闲页）失败的错误；下次启动会自动重试 */
export function getSecretCleanupError() {
  return secretCleanupError
}

/** 立即写入所有待写的 key；写入串行进行，保证同一 key 的先后顺序 */
export function flushTauriStorage() {
  clearTimeout(timer)
  timer = undefined
  if (loadError) dirty.clear()
  const keys = [...dirty]
  dirty.clear()
  if (!keys.length) return writing
  writing = writing.then(async () => {
    for (const key of keys) {
      // 写入时读取最新值，期间又被修改也只会多写一次相同内容
      const value = cache.get(key)
      try {
        if (value === undefined) await call('kv_remove', { key })
        else await call('kv_set', { key, value })
      } catch (err) {
        notifyStorageError(key, err)
        // 留到下一次写入（包括关闭窗口时）重试；这里不启动计时器，避免持续失败时反复重试
        dirty.add(key)
      }
    }
  })
  return writing
}

/** 关闭窗口或安装更新前写入，限时等待 */
export function flushTauriStorageBeforeExit() {
  let limit: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => {
    limit = setTimeout(() => {
      console.warn('保存本地设置超时，继续退出')
      resolve()
    }, EXIT_FLUSH_TIMEOUT_MS)
  })
  return Promise.race([flushTauriStorage(), timeout]).finally(() => clearTimeout(limit))
}

function markDirty(key: string) {
  dirty.add(key)
  clearTimeout(timer)
  timer = setTimeout(() => void flushTauriStorage(), FLUSH_DELAY_MS)
}

export const tauriStorage: StateStorage = {
  getItem: (key) => cache.get(key) ?? null,
  setItem: (key, value) => {
    // persist 每次 set 都会调用 setItem，内容没变时跳过，避免无效写入和流式输出期间防抖被不断推迟
    if (cache.get(key) === value) return
    cache.set(key, value)
    markDirty(key)
  },
  removeItem: (key) => {
    cache.delete(key)
    markDirty(key)
  },
}

/** 关闭窗口前写完再隐藏；真正保证不丢失的是防抖写入和 onCloseRequested */
export async function installTauriStorageFlush() {
  // 附带写入：Windows 客户端最小化不会让页面变为 hidden（且已关闭被遮挡窗口的后台化），这两个事件基本不会触发
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushTauriStorage()
  })
  window.addEventListener('pagehide', () => void flushTauriStorage())
  // 关闭窗口一律阻止销毁并隐藏到托盘；写完设置后主动隐藏，Rust 侧另有 5 秒兜底
  await getCurrentWindow().onCloseRequested(async (event) => {
    event.preventDefault()
    invoke('close_ack').catch((err) => console.warn('关闭请求回执失败：', err))
    await flushTauriStorageBeforeExit()
    if (!localStorage.getItem('panpan-tray-hint-shown')) {
      localStorage.setItem('panpan-tray-hint-shown', '1')
      showBrowserNotification('盼盼工作台仍在运行', { body: '窗口已隐藏到系统托盘，可从托盘重新打开或退出。' })
    }
    invoke('hide_main_window_command').catch((err) => console.warn('隐藏窗口失败：', err))
  })
  // 托盘“退出”不经过窗口关闭，先写盘再让 Rust 结束进程
  await listen('tray-exit-requested', async () => {
    await flushTauriStorageBeforeExit()
    invoke('exit_app').catch((err) => console.warn('退出应用失败：', err))
  })
  // Rust 已先隐藏；这里只做写盘，5 秒兜底隐藏由 Rust 负责
  await listen('tray-hide-requested', async () => {
    await flushTauriStorageBeforeExit()
  })
  // MCP 写入确认：动态加载避免 lib 与 store 的静态循环依赖
  void import('./mcpBridge').then((mod) => mod.installMcpWriteBridge()).catch((err) => {
    console.warn('安装 MCP 写入确认失败：', err)
  })
}
