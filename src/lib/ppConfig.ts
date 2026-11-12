import type { ApiProfile, AppSettings, CustomProviderDefinition } from '../types'
import { importCustomProviderSettingsFromJson, normalizeSettings } from './apiProfiles'

export const PP_CONFIG_VERSION = 1

const TOP_LEVEL_FIELDS = new Set(['version', 'providers', 'profiles'])
const PROVIDER_FIELDS = new Set(['id', 'name', 'template', 'submit', 'editSubmit', 'poll'])
const PROFILE_FIELDS = new Set([
  'name',
  'description',
  'provider',
  'baseUrl',
  'model',
  'selectedModel',
  'imageGenerationModel',
  'timeout',
  'apiMode',
  'reasoningEffort',
  'codexCli',
  'apiProxy',
  'responseFormatB64Json',
  'streamImages',
  'streamPartialImages',
  'transparentBackgroundMethod',
])

export interface PpConfigPreviewProfile {
  name: string
  provider: string
  model: string
  /** 本机已有同一连接配置，导入时会更新该配置并保留本机 Key */
  existing: boolean
}

export interface PpConfigPreview {
  providers: Array<{ id: string; name: string; existing: boolean }>
  profiles: PpConfigPreviewProfile[]
}

export interface ParsedPpConfig {
  providers: CustomProviderDefinition[]
  profiles: ApiProfile[]
  preview: PpConfigPreview
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** 配置码不含 Key，按连接信息判断本机是否已有同一配置；已有则更新并保留 Key。 */
export function findExistingPpConfigProfile(settings: Partial<AppSettings>, profile: ApiProfile) {
  const current = normalizeSettings(settings)
  return current.profiles.find((item) =>
    item.provider === profile.provider &&
    item.baseUrl.trim().toLowerCase() === profile.baseUrl.trim().toLowerCase() &&
    item.model.trim() === profile.model.trim() &&
    item.apiMode === profile.apiMode &&
    (!profile.imageGenerationModel || !item.imageGenerationModel || item.imageGenerationModel === profile.imageGenerationModel) &&
    (profile.reasoningEffort === undefined || item.reasoningEffort === profile.reasoningEffort),
  ) ?? null
}

function assertAllowedFields(record: Record<string, unknown>, allowed: Set<string>, label: string) {
  const unknown = Object.keys(record).filter((key) => !allowed.has(key))
  if (unknown.length) throw new Error(`${label}包含未知字段：${unknown.slice(0, 3).join('、')}`)
}

function pickFields(record: Record<string, unknown>, allowed: Set<string>) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => allowed.has(key)))
}

/**
 * .ppconfig v1 只接受白名单字段；配置文件不允许携带 Key，导入后再手动填写。
 * 解析失败只抛错，不返回半成品，调用方不会写入任何设置。
 */
export function parsePpConfig(text: string, currentSettings: Partial<AppSettings> = {}): ParsedPpConfig {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('配置码不是有效的 JSON')
  }

  if (!isRecord(parsed)) throw new Error('配置码根节点必须是对象')
  assertAllowedFields(parsed, TOP_LEVEL_FIELDS, '配置码')
  if (parsed.version !== PP_CONFIG_VERSION) {
    throw new Error(`配置码版本不受支持，需要 version: ${PP_CONFIG_VERSION}`)
  }
  if (!Array.isArray(parsed.providers)) throw new Error('providers 必须是数组')
  if (!Array.isArray(parsed.profiles)) throw new Error('profiles 必须是数组')
  if (!parsed.profiles.length) throw new Error('配置码至少需要一个 API 配置')

  const providers = parsed.providers.map((item, index) => {
    if (!isRecord(item)) throw new Error(`第 ${index + 1} 个服务商配置必须是对象`)
    assertAllowedFields(item, PROVIDER_FIELDS, `第 ${index + 1} 个服务商配置`)
    return pickFields(item, PROVIDER_FIELDS)
  })

  const profiles = parsed.profiles.map((item, index) => {
    if (!isRecord(item)) throw new Error(`第 ${index + 1} 个 API 配置必须是对象`)
    if ('apiKey' in item || 'api_key' in item) {
      throw new Error('配置码不能包含 API Key，请导入后手动填写')
    }
    assertAllowedFields(item, PROFILE_FIELDS, `第 ${index + 1} 个 API 配置`)
    return pickFields(item, PROFILE_FIELDS)
  })

  // 复用现有导入逻辑做字段类型、服务商引用和默认值校验。
  const imported = importCustomProviderSettingsFromJson(JSON.stringify({
    customProviders: providers,
    profiles,
  }))
  const current = normalizeSettings(currentSettings)

  return {
    providers: imported.customProviders,
    profiles: imported.profiles,
    preview: {
      providers: imported.customProviders.map((provider) => ({
        id: provider.id,
        name: provider.name,
        existing: current.customProviders.some((item) => item.id === provider.id || item.name === provider.name),
      })),
      profiles: imported.profiles.map((profile) => ({
        name: profile.name,
        provider: profile.provider,
        model: profile.model,
        existing: Boolean(findExistingPpConfigProfile(current, profile)),
      })),
    },
  }
}
