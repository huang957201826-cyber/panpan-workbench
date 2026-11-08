export const DEFAULT_MANUAL_TASK_CONCURRENCY = 2
const STORAGE_KEY = 'manualTaskConcurrency'

/** 手动连续提交的全局并发数；默认 2，可在设置里调整 */
export function getManualTaskConcurrency() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const value = raw == null ? NaN : Number(raw)
    if (!Number.isFinite(value)) return DEFAULT_MANUAL_TASK_CONCURRENCY
    return Math.max(1, Math.round(value))
  } catch {
    return DEFAULT_MANUAL_TASK_CONCURRENCY
  }
}

export function setManualTaskConcurrency(value: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(Math.max(1, Math.round(value))))
  } catch {
    // 隐私模式下 localStorage 不可用时退回默认值
  }
}
