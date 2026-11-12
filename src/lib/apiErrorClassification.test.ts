import { describe, expect, it } from 'vitest'
import { classifyApiError, formatApiErrorDiagnostic } from './apiErrorClassification'

describe('classifyApiError', () => {
  it('把已停止和超时分开', () => {
    expect(classifyApiError('已停止生成。').kind).toBe('stopped')
    expect(classifyApiError('请求超时：超过 60 秒仍未完成').kind).toBe('timeout')
    expect(classifyApiError('This operation was aborted').kind).toBe('timeout')
  })

  it('识别未配置 Key 和鉴权失败', () => {
    expect(classifyApiError('未配置 API Key').kind).toBe('missing_key')
    expect(classifyApiError('missing api key').kind).toBe('missing_key')
    expect(classifyApiError('HTTP 401 Unauthorized').kind).toBe('auth')
    expect(classifyApiError('invalid api key').kind).toBe('auth')
  })

  it('识别余额不足和限流', () => {
    expect(classifyApiError('HTTP 402 Insufficient Balance').kind).toBe('insufficient_balance')
    expect(classifyApiError('账户余额不足，请充值').kind).toBe('insufficient_balance')
    expect(classifyApiError('HTTP 429 Too Many Requests').kind).toBe('rate_limit')
  })

  it('识别网络和服务端错误', () => {
    expect(classifyApiError('TypeError: Failed to fetch').kind).toBe('network')
    expect(classifyApiError('网络不可用').kind).toBe('network')
    expect(classifyApiError('HTTP 502 Bad Gateway').kind).toBe('server')
    expect(classifyApiError('服务端错误').kind).toBe('server')
  })

  it('识别内容审核和未知兜底', () => {
    expect(classifyApiError('content policy violation').kind).toBe('content_policy')
    expect(classifyApiError('审核未通过').kind).toBe('content_policy')
    expect(classifyApiError('').kind).toBe('unknown')
    expect(classifyApiError('some unexpected provider payload').kind).toBe('unknown')
  })

  it('诊断文本包含类别、建议、原始错误和可选原始响应', () => {
    const text = formatApiErrorDiagnostic('HTTP 401 Unauthorized', '{"error":"bad key"}')
    expect(text).toContain('鉴权失败')
    expect(text).toContain('建议：')
    expect(text).toContain('原始错误：HTTP 401 Unauthorized')
    expect(text).toContain('原始响应：')
    expect(formatApiErrorDiagnostic('')).toContain('原始错误：（无）')
  })
})
