import type { ApiMode, ApiProfile as StoreApiProfile } from '../../types'
import { createDefaultOpenAIProfile } from '../../lib/apiProfiles'
import { FetchConnectError, apiFetch } from '../../lib/platform'
import { useStore } from '../../store'

/** 原型 SettingsModal 里的 ApiProfile 字段 */
export interface PrototypeApiProfile {
  id: string
  name: string
  providerType: 'openai' | 'azure' | 'comfy' | 'custom'
  apiUrl: string
  apiKey: string
  apiMode: ApiMode
  models: string[]
  streaming: boolean
  partialImages: number
  timeoutSec: number
}

/** 组件拿到的密钥占位符；写回时表示沿用已存密钥 */
export const KEY_SENTINEL = '__stored__'

export const PROFILES_STORAGE_KEY = 'panpan_api_profiles_v2'
export const ACTIVE_PROFILE_STORAGE_KEY = 'panpan_active_profile_id_v2'

const BRIDGE_KEYS = new Set([PROFILES_STORAGE_KEY, ACTIVE_PROFILE_STORAGE_KEY])

function providerOf(profile: StoreApiProfile): PrototypeApiProfile['providerType'] {
  return profile.provider === 'openai' ? 'openai' : 'custom'
}

export function toPrototype(profile: StoreApiProfile): PrototypeApiProfile {
  return {
    id: profile.id,
    name: profile.name,
    providerType: providerOf(profile),
    apiUrl: profile.baseUrl,
    apiKey: profile.apiKey ? KEY_SENTINEL : '',
    apiMode: profile.apiMode,
    models: profile.model.split(',').map((item) => item.trim()).filter(Boolean),
    streaming: Boolean(profile.streamImages),
    partialImages: profile.streamPartialImages ?? 0,
    timeoutSec: profile.timeout,
  }
}

export function fromPrototype(profile: PrototypeApiProfile, previous?: StoreApiProfile): StoreApiProfile {
  const base = previous ?? createDefaultOpenAIProfile({ id: profile.id, name: profile.name })
  const apiKey = profile.apiKey === KEY_SENTINEL ? (previous?.apiKey ?? '') : profile.apiKey
  const models = profile.models.map((item) => item.trim()).filter(Boolean)
  return {
    ...base,
    id: profile.id,
    name: profile.name,
    provider: previous?.provider ?? (profile.providerType === 'openai' ? 'openai' : 'custom'),
    baseUrl: profile.apiUrl,
    apiKey,
    model: models.join(', '),
    selectedModel: models[0] ?? base.selectedModel,
    timeout: profile.timeoutSec,
    apiMode: profile.apiMode,
    streamImages: profile.streaming,
    streamPartialImages: profile.partialImages,
  }
}

function readProfiles(): PrototypeApiProfile[] {
  const settings = useStore.getState().settings
  return settings.profiles.map(toPrototype)
}

function readActiveId(): string {
  const settings = useStore.getState().settings
  return settings.activeProfileId
}

function writeProfiles(raw: string) {
  const parsed = JSON.parse(raw) as PrototypeApiProfile[]
  if (!Array.isArray(parsed)) return
  const settings = useStore.getState().settings
  const previous = new Map(settings.profiles.map((profile) => [profile.id, profile]))
  const profiles = parsed.map((item) => fromPrototype(item, previous.get(item.id)))
  const active = settings.profiles.find((profile) => profile.id === settings.activeProfileId) ?? profiles[0]
  useStore.getState().setSettings({
    profiles,
    activeProfileId: profiles.some((profile) => profile.id === settings.activeProfileId)
      ? settings.activeProfileId
      : profiles[0]?.id,
    baseUrl: active?.baseUrl ?? settings.baseUrl,
    apiKey: active?.apiKey ?? settings.apiKey,
    model: active?.model ?? settings.model,
    apiMode: active?.apiMode ?? settings.apiMode,
  })
}

function writeActiveId(raw: string) {
  const settings = useStore.getState().settings
  if (!settings.profiles.some((profile) => profile.id === raw)) return
  const active = settings.profiles.find((profile) => profile.id === raw)
  useStore.getState().setSettings({
    activeProfileId: raw,
    baseUrl: active?.baseUrl ?? settings.baseUrl,
    apiKey: active?.apiKey ?? settings.apiKey,
    model: active?.model ?? settings.model,
    apiMode: active?.apiMode ?? settings.apiMode,
  })
}

let installed = false

/**
 * 原型组件直接读写 localStorage；这里把它接到本项目设置存储。
 * 组件永远只拿到密钥哨兵，明文 apiKey 不会写进 localStorage。
 */
export function installSettingsStorageBridge() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const proto = Storage.prototype
  const originalGet = proto.getItem
  const originalSet = proto.setItem

  proto.getItem = function patchedGet(key: string) {
    if (this === window.localStorage && key === PROFILES_STORAGE_KEY) return JSON.stringify(readProfiles())
    if (this === window.localStorage && key === ACTIVE_PROFILE_STORAGE_KEY) return readActiveId()
    return originalGet.call(this, key)
  }

  proto.setItem = function patchedSet(key: string, value: string) {
    if (this === window.localStorage && BRIDGE_KEYS.has(key)) {
      try {
        if (key === PROFILES_STORAGE_KEY) writeProfiles(value)
        else writeActiveId(value)
      } catch (error) {
        console.error('设置存储桥接失败：', error)
      }
      return
    }
    originalSet.call(this, key, value)
  }
}

export interface ConnectionResult {
  ok: boolean
  models: string[]
  error: string | null
  normalizedUrl?: string
}

function extractModelIds(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []
  const record = payload as Record<string, unknown>
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(record.data)
      ? record.data
      : Array.isArray(record.models)
        ? record.models
        : []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of list) {
    let raw = ''
    if (typeof item === 'string') {
      raw = item.trim()
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      const id = typeof obj.id === 'string' ? obj.id : typeof obj.name === 'string' ? obj.name : ''
      raw = id.trim().replace(/^models\//, '')
    }
    if (raw && !seen.has(raw)) {
      seen.add(raw)
      result.push(raw)
    }
  }
  return result
}

/** 真请求 `${baseUrl}/models`（未带 /v1 时自动回退尝试 `${baseUrl}/v1/models`）；401/403 与网络/超时分开报 */
export async function testConnection(
  baseUrl: string,
  apiKey: string,
  options: { timeoutMs?: number; profileId?: string } = {},
): Promise<ConnectionResult> {
  const cleanUrl = baseUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(models|chat\/completions|images\/generations|images\/edits|responses)$/i, '')
  if (!/^https?:\/\//i.test(cleanUrl)) {
    return { ok: false, models: [], error: '地址需以 http:// 或 https:// 开头' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('连接超时', 'AbortError')), options.timeoutMs ?? 12000)
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    const settings = useStore.getState().settings
    const storedKey = apiKey === KEY_SENTINEL
      ? (
        (options.profileId ? settings.profiles.find((profile) => profile.id === options.profileId)?.apiKey : undefined)
        ?? settings.profiles.find((profile) => profile.baseUrl.replace(/\/+$/, '') === cleanUrl && profile.apiKey)?.apiKey
        ?? settings.profiles.find((profile) => profile.id === settings.activeProfileId)?.apiKey
        ?? settings.apiKey
        ?? ''
      )
      : apiKey.trim()
    if (storedKey && storedKey !== KEY_SENTINEL) headers.Authorization = `Bearer ${storedKey}`

    const candidates = /\/v\d+(?:beta)?$/i.test(cleanUrl)
      ? [cleanUrl]
      : [cleanUrl, `${cleanUrl}/v1`]

    let lastStatus = 0
    for (let i = 0; i < candidates.length; i += 1) {
      const candidateBase = candidates[i]
      const response = await apiFetch(`${candidateBase}/models`, {
        headers,
        signal: controller.signal,
        cache: 'no-store',
      })
      if (response.status === 401 || response.status === 403) {
        return { ok: false, models: [], error: `密钥无效（HTTP ${response.status}）` }
      }
      lastStatus = response.status
      if (!response.ok) {
        if (i + 1 < candidates.length && (response.status === 404 || response.status === 405)) {
          continue
        }
        return { ok: false, models: [], error: `服务返回 HTTP ${response.status}` }
      }
      try {
        const payload = await response.json()
        const models = extractModelIds(payload)
        return { ok: true, models, error: null, normalizedUrl: candidateBase }
      } catch {
        if (i + 1 < candidates.length) continue
        return { ok: false, models: [], error: '接口返回的不是有效 JSON，请确认 API 地址包含 /v1' }
      }
    }
    return { ok: false, models: [], error: lastStatus ? `服务返回 HTTP ${lastStatus}` : '未获取到模型列表' }
  } catch (error) {
    if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      return { ok: false, models: [], error: `连接超时（${Math.round((options.timeoutMs ?? 12000) / 1000)} 秒）` }
    }
    if (error instanceof FetchConnectError && error.message) {
      return { ok: false, models: [], error: error.message }
    }
    return { ok: false, models: [], error: '网络错误：检查地址、网络或代理' }
  } finally {
    clearTimeout(timer)
  }
}
