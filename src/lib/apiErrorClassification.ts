/** 把各供应商返回的原始错误归并成用户能采取行动的类别。 */
export type ApiErrorKind =
  | 'stopped'
  | 'timeout'
  | 'missing_key'
  | 'auth'
  | 'insufficient_balance'
  | 'rate_limit'
  | 'network'
  | 'server'
  | 'content_policy'
  | 'unknown'

export interface ApiErrorInfo {
  kind: ApiErrorKind
  title: string
  hint: string
}

/** 生成链路附加在 Error 上的原始响应，供错误卡展示 */
export type ApiErrorWithMeta = Error & {
  rawImageUrls?: string[]
  rawResponsePayload?: string
}

const UNKNOWN: ApiErrorInfo = {
  kind: 'unknown',
  title: '生成失败',
  hint: '可复制错误信息排查，或稍后重试。',
}

/** 生成可直接粘贴给他人排查的诊断文本；只使用本机已有的原始错误和响应。 */
export function formatApiErrorDiagnostic(raw?: string | null, rawResponsePayload?: string | null) {
  const info = classifyApiError(raw)
  const message = (raw ?? '').trim()
  const lines = [
    `类别：${info.title}（${info.kind}）`,
    `建议：${info.hint}`,
    `原始错误：${message || '（无）'}`,
  ]
  if (rawResponsePayload?.trim()) lines.push('原始响应：', rawResponsePayload)
  return lines.join('\n')
}

/**
 * 只做展示层归类，不改变原始 task.error；复制错误时仍给用户完整原文。
 * 顺序有讲究：先识别“已停止”，再超时/配置/鉴权/余额/限流/网络/服务端/审核。
 */
export function classifyApiError(raw?: string | null): ApiErrorInfo {
  const message = (raw ?? '').trim()
  if (!message) return UNKNOWN

  if (/已停止|停止生成|stopped|aborted by user/i.test(message)) {
    return { kind: 'stopped', title: '已停止', hint: '已手动停止，可重新生成。' }
  }
  if (/超时|timeout|timed out|abort/i.test(message)) {
    return { kind: 'timeout', title: '请求超时', hint: '检查网络或提高超时时间后重试。' }
  }
  if (/未配置.*(api\s*)?key|缺少.*(api\s*)?key|no\s+api\s*key|missing.*key|api\s*key.*(未|没有|为空)/i.test(message)) {
    return { kind: 'missing_key', title: '未配置 API Key', hint: '到设置 → API 配置填写 Key 后重试。' }
  }
  if (/\b401\b|\b403\b|unauthorized|forbidden|invalid.*api.*key|incorrect.*api.*key|鉴权|认证失败|无权限/i.test(message)) {
    return { kind: 'auth', title: '鉴权失败', hint: '检查 API Key 是否有效、是否有该模型权限。' }
  }
  if (/余额|insufficient|quota|billing|credit|欠费|充值|\b402\b/i.test(message)) {
    return { kind: 'insufficient_balance', title: '余额不足', hint: '到服务商充值，或切换到可用的 API 配置。' }
  }
  if (/rate limit|too many requests|请求过于频繁|限流|\b429\b/i.test(message)) {
    return { kind: 'rate_limit', title: '请求过于频繁', hint: '稍后重试，或降低并发/批量数量。' }
  }
  if (/跨域|\bcors\b|failed to fetch|network|网络|econn|enotfound|dns|无法连接|连接失败/i.test(message)) {
    return { kind: 'network', title: '网络不可用', hint: '检查网络、代理或 Base URL 后重试。' }
  }
  if (/\b5\d\d\b|bad gateway|gateway timeout|server error|服务端|服务器错误|内部错误/i.test(message)) {
    return { kind: 'server', title: '服务端错误', hint: '服务商暂时不可用，稍后重试。' }
  }
  if (/content policy|safety|审核|违规|敏感/i.test(message)) {
    return { kind: 'content_policy', title: '内容审核未通过', hint: '调整提示词或参考图后重试。' }
  }
  return UNKNOWN
}
