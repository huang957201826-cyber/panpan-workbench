import { REPO_URL } from './repoLinks'

/** 与 src-tauri/tauri.conf.json 的 updater.endpoints 保持一致；改仓库地址时两边一起改 */
export const UPDATE_ENDPOINT = `${REPO_URL}/releases/latest/download/latest.json`

export type UpdatePhase = 'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'ready' | 'error'

export interface UpdateInfo {
  version: string
  currentVersion: string
  notes?: string | null
}

export interface UpdateProgress {
  downloaded: number
  total?: number | null
}

export interface UpdateState {
  phase: UpdatePhase
  info: UpdateInfo | null
  progress: UpdateProgress | null
  error: string | null
}

export const INITIAL_UPDATE_STATE: UpdateState = {
  phase: 'idle',
  info: null,
  progress: null,
  error: null,
}

export type UpdateEvent =
  | { type: 'check' }
  | { type: 'checked'; info: UpdateInfo | null }
  | { type: 'download' }
  | { type: 'progress'; progress: UpdateProgress }
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'reset' }

export function updateReducer(state: UpdateState, event: UpdateEvent): UpdateState {
  switch (event.type) {
    case 'check':
      return { ...state, phase: 'checking', error: null }
    case 'checked':
      return {
        phase: event.info ? 'available' : 'latest',
        info: event.info,
        progress: null,
        error: null,
      }
    case 'download':
      return { ...state, phase: 'downloading', progress: { downloaded: 0, total: null }, error: null }
    case 'progress':
      return { ...state, progress: event.progress }
    case 'ready':
      return { ...state, phase: 'ready', progress: null }
    case 'error':
      return { ...state, phase: 'error', error: event.message }
    case 'reset':
      return INITIAL_UPDATE_STATE
  }
}

function parseVersion(raw: string) {
  const value = raw.trim().replace(/^v/i, '')
  const [core, pre] = value.split('-', 2).map((part) => part.trim())
  const numbers = core.split('.').map((part) => {
    const n = Number.parseInt(part, 10)
    return Number.isFinite(n) ? n : 0
  })
  while (numbers.length < 3) numbers.push(0)
  return { numbers, pre: pre ? pre.split('.') : [] }
}

/** 返回 1 表示 a 更新，-1 表示 b 更新，0 表示相同 */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a)
  const right = parseVersion(b)
  for (let i = 0; i < Math.max(left.numbers.length, right.numbers.length, 3); i++) {
    const diff = (left.numbers[i] ?? 0) - (right.numbers[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  // 正式版高于同版本预发布版
  if (!left.pre.length && right.pre.length) return 1
  if (left.pre.length && !right.pre.length) return -1
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
    const l = left.pre[i]
    const r = right.pre[i]
    if (l === undefined) return -1
    if (r === undefined) return 1
    const ln = /^\d+$/.test(l)
    const rn = /^\d+$/.test(r)
    if (ln && rn) {
      const diff = Number(l) - Number(r)
      if (diff !== 0) return diff > 0 ? 1 : -1
    } else if (ln !== rn) {
      return ln ? -1 : 1
    } else if (l !== r) {
      return l > r ? 1 : -1
    }
  }
  return 0
}

/** 检查接口返回空表示已是最新；有时间版本号相同但内容更新时仍按更新处理 */
export function checkResult(info: UpdateInfo | null): { phase: 'latest' | 'available'; info: UpdateInfo | null } {
  if (!info) return { phase: 'latest', info: null }
  return compareVersions(info.version, info.currentVersion) > 0
    ? { phase: 'available', info }
    : { phase: 'latest', info }
}

export function progressPercent(progress: UpdateProgress | null): number | null {
  if (!progress?.total || progress.total <= 0) return null
  return Math.min(100, Math.max(0, Math.round((progress.downloaded / progress.total) * 100)))
}
