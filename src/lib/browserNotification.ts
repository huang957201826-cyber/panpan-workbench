export type BrowserNotificationPermission = NotificationPermission | 'unsupported'
export type BrowserNotificationPermissionResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'insecure' | 'denied' | 'default' | 'error'; error?: unknown }
export type BrowserNotificationReadiness =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'insecure' | 'denied' | 'default' }

interface PanPanAndroidBridge {
  postNotification?: (title: string, body: string, tag: string) => boolean
  requestNotificationPermission?: () => boolean
  setAppTitle?: (title: string) => void
}

function getAndroidBridge(): PanPanAndroidBridge | null {
  if (typeof window === 'undefined') return null
  const bridge = (window as unknown as { __PANPAN_ANDROID__?: PanPanAndroidBridge }).__PANPAN_ANDROID__
  return bridge && typeof bridge === 'object' ? bridge : null
}

let downloadNotificationHandler: ((title: string, body: string, tag: string) => void) | null = null

export function registerDownloadNotificationHandler(handler: ((title: string, body: string, tag: string) => void) | null) {
  downloadNotificationHandler = handler
}

export function notifyDownloadCompletion(msg: string, location?: string) {
  if (!downloadNotificationHandler) return
  const title = msg.includes('导出') ? '图片导出完成' : '图片下载完成'
  const body = location ? `${msg}，已保存到 ${location}` : `${msg}。`
  downloadNotificationHandler(title, body, 'download-completion')
}

function getNotificationConstructor() {
  if (typeof window === 'undefined' || !('Notification' in window)) return null
  return window.Notification
}

function isSecureNotificationContext() {
  return typeof window !== 'undefined' && window.isSecureContext
}

export function getBrowserNotificationReadiness(): BrowserNotificationReadiness {
  const androidBridge = getAndroidBridge()
  if (androidBridge?.postNotification) return { ok: true }
  const NotificationConstructor = getNotificationConstructor()
  if (!NotificationConstructor) return { ok: false, reason: 'unsupported' }
  if (!isSecureNotificationContext()) return { ok: false, reason: 'insecure' }
  if (NotificationConstructor.permission === 'granted') return { ok: true }
  return { ok: false, reason: NotificationConstructor.permission }
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermissionResult> {
  const androidBridge = getAndroidBridge()
  if (androidBridge?.postNotification) {
    try {
      androidBridge.requestNotificationPermission?.()
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: 'error', error }
    }
  }
  const readiness = getBrowserNotificationReadiness()
  if (readiness.ok || readiness.reason !== 'default') return readiness

  try {
    const permission = await window.Notification.requestPermission()
    if (permission === 'granted') return { ok: true }
    if (permission === 'denied') return { ok: false, reason: 'denied' }
    return { ok: false, reason: 'default' }
  } catch (error) {
    return { ok: false, reason: 'error', error }
  }
}

export function showBrowserNotification(title: string, options?: NotificationOptions) {
  const androidBridge = getAndroidBridge()
  if (androidBridge?.postNotification) {
    try {
      return Boolean(androidBridge.postNotification(title, options?.body ?? '', options?.tag ?? 'task-completion'))
    } catch {
      return false
    }
  }
  const NotificationConstructor = getNotificationConstructor()
  if (!NotificationConstructor || !isSecureNotificationContext() || NotificationConstructor.permission !== 'granted') return false

  try {
    const notification = new NotificationConstructor(title, {
      tag: 'task-completion',
      requireInteraction: false,
      ...options,
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
    return true
  } catch {
    return false
  }
}
