import type { ApiMode, ApiProfile as StoreApiProfile } from '../../types'
import { createDefaultOpenAIProfile } from '../../lib/apiProfiles'
import { apiFetch } from '../../lib/platform'
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
}

/** 真请求 `${baseUrl}/models`；401/403 与网络/超时分开报 */
export async function testConnection(
  baseUrl: string,
  apiKey: string,
  options: { timeoutMs?: number } = {},
): Promise<ConnectionResult> {
  const cleanUrl = baseUrl.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(cleanUrl)) {
    return { ok: false, models: [], error: '地址需以 http:// 或 https:// 开头' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000)
  try {
    const headers: Record<string, string> = {}
    const settings = useStore.getState().settings
    const storedKey = apiKey === KEY_SENTINEL
      ? (settings.profiles.find((profile) => profile.id === settings.activeProfileId)?.apiKey ?? '')
      : apiKey
    if (storedKey && storedKey !== KEY_SENTINEL) headers.Authorization = `Bearer ${storedKey}`
    const response = await apiFetch(`${cleanUrl}/models`, {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    })
    if (response.status === 401 || response.status === 403) {
      return { ok: false, models: [], error: `密钥无效（HTTP ${response.status}）` }
    }
    if (!response.ok) {
      return { ok: false, models: [], error: `服务返回 HTTP ${response.status}` }
    }
    const payload = (await response.json()) as { data?: Array<{ id?: string }> }
    const models = (payload.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id))
    return { ok: true, models, error: null }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, models: [], error: `连接超时（${Math.round((options.timeoutMs ?? 8000) / 1000)} 秒）` }
    }
    return { ok: false, models: [], error: '网络错误：检查地址、网络或代理' }
  } finally {
    clearTimeout(timer)
  }
}
