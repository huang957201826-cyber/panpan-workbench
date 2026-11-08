/** 复制给用户/反馈用的诊断信息：去掉 API Key、Bearer token 等敏感值。 */
export function sanitizeDiagnostics(text: string) {
  return text
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{4,}/gi, '$1***')
    .replace(/\bsk-[A-Za-z0-9._-]{4,}/g, 'sk-***')
    .replace(/("?apiKey"?\s*[:=]\s*["']?)[^"'\s,}]+/gi, '$1***')
}

export function buildDiagnostics(error: unknown, extra: Record<string, string> = {}) {
  const err = error instanceof Error ? error : new Error(String(error))
  const lines = [
    `时间：${new Date().toISOString()}`,
    `消息：${err.name}: ${err.message}`,
    ...Object.entries(extra).map(([key, value]) => `${key}：${value}`),
    '',
    err.stack ?? '（没有堆栈）',
  ]
  return sanitizeDiagnostics(lines.join('\n'))
}
