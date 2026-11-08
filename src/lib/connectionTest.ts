import type { ApiProfile } from '../types'
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

/** GET /models 校验 baseUrl 与模型是否存在，返回可展示的中文结果 */
export async function testApiConnection(
  profile: Pick<ApiProfile, 'baseUrl' | 'apiKey' | 'model' | 'selectedModel'>,
  fetcher: typeof apiFetch = apiFetch,
): Promise<ConnectionTestResult> {
  const base = normalizeBaseUrl(profile.baseUrl)
  if (!base) return { ok: false, message: '请先填写 API URL', models: [] }
  const url = base.endsWith('/') ? `${base}models` : `${base}/models`
  try {
    const response = await fetcher(url, {
      headers: profile.apiKey ? { Authorization: `Bearer ${profile.apiKey}` } : undefined,
    })
    if (!response.ok) return { ok: false, message: `连接失败：HTTP ${response.status}`, models: [] }
    const data: unknown = await response.json().catch(() => null)
    const models = Array.isArray((data as { data?: unknown })?.data)
      ? ((data as { data: Array<{ id?: unknown }> }).data)
        .map((item) => typeof item?.id === 'string' ? item.id : '')
        .filter(Boolean)
      : []
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
