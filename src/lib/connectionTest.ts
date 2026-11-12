import type { ApiProfile, ApiProvider } from '../types'
import { DEFAULT_GEMINI_BASE_URL } from './apiProfiles'
import { normalizeBaseUrl } from './devProxy'
import { apiFetch } from './platform'

export interface ConnectionTestResult {
  ok: boolean
  message: string
  models: string[]
}

/** 非 HTTPS 且不是本机地址时需要用户再次确认 */
export function isInsecureBaseUrl(baseUrl: string) {
  try {
    const url = new URL(normalizeBaseUrl(baseUrl))
    if (url.protocol !== 'http:') return false
    return url.hostname !== 'localhost' && !url.hostname.startsWith('127.')
  } catch {
    return false
  }
}

export function getTestedModel(profile: Pick<ApiProfile, 'model' | 'selectedModel'>) {
  return profile.selectedModel?.trim() || profile.model.split(',')[0]?.trim() || ''
}

interface TestableProfile extends Pick<ApiProfile, 'baseUrl' | 'apiKey' | 'model' | 'selectedModel'> {
  provider?: ApiProvider
}

function buildGoogleModelsRequest(profile: TestableProfile) {
  const raw = normalizeBaseUrl(profile.baseUrl?.trim() || DEFAULT_GEMINI_BASE_URL).replace(/\/+$/, '')
  const base = raw.replace(/\/v1beta$/, '')
  return {
    url: `${base}/v1beta/models`,
    headers: profile.apiKey ? { 'x-goog-api-key': profile.apiKey } : undefined,
  }
}

function parseGoogleModels(data: unknown) {
  const record = data as { models?: Array<{ name?: unknown }> }
  if (!Array.isArray(record?.models)) return []
  return record.models
    .map((item) => typeof item?.name === 'string' ? item.name.replace(/^models\//, '') : '')
    .filter(Boolean)
}

function parseOpenAIModels(data: unknown) {
  const record = data as { data?: Array<{ id?: unknown }> }
  return Array.isArray(record?.data)
    ? record.data.map((item) => typeof item?.id === 'string' ? item.id : '').filter(Boolean)
    : []
}

/** GET /models 校验 baseUrl 与模型是否存在，返回可展示的中文结果 */
export async function testApiConnection(
  profile: TestableProfile,
  fetcher: typeof apiFetch = apiFetch,
): Promise<ConnectionTestResult> {
  const base = normalizeBaseUrl(profile.baseUrl)
  if (!base) return { ok: false, message: '请先填写 API URL', models: [] }
  const google = profile.provider === 'google'
  const request = google
    ? buildGoogleModelsRequest(profile)
    : { url: base.endsWith('/') ? `${base}models` : `${base}/models`, headers: profile.apiKey ? { Authorization: `Bearer ${profile.apiKey}` } : undefined }
  try {
    const response = await fetcher(request.url, { headers: request.headers })
    if (!response.ok) return { ok: false, message: `连接失败：HTTP ${response.status}`, models: [] }
    const data: unknown = await response.json().catch(() => null)
    const models = google ? parseGoogleModels(data) : parseOpenAIModels(data)
    if (!models.length) return { ok: false, message: '已连接，但接口没有返回模型列表', models }
    const model = getTestedModel(profile)
    if (model && !models.includes(model)) {
      return { ok: false, message: `已连接，但未找到模型 ${model}`, models }
    }
    return { ok: true, message: model ? `连接成功，模型 ${model} 可用` : '连接成功', models }
  } catch (err) {
    return { ok: false, message: `连接失败：${err instanceof Error ? err.message : String(err)}`, models: [] }
  }
}
