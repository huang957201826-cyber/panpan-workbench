import { describe, expect, it } from 'vitest'
import { buildDiagnostics, sanitizeDiagnostics } from './diagnostics'

describe('diagnostics sanitization', () => {
  it('removes sk keys, bearer tokens and apiKey values', () => {
    const text = sanitizeDiagnostics([
      'key=sk-1234567890abcdef',
      'Authorization: Bearer abc.def.ghi',
      '{"apiKey":"secret-value"}',
      'apiKey: another-secret',
    ].join('\n'))
    expect(text).not.toContain('1234567890abcdef')
    expect(text).not.toContain('abc.def.ghi')
    expect(text).not.toContain('secret-value')
    expect(text).not.toContain('another-secret')
    expect(text).toContain('sk-***')
    expect(text).toContain('Bearer ***')
  })

  it('builds diagnostics with metadata', () => {
    const text = buildDiagnostics(new Error('boom sk-abcdefgh'), { 版本: '0.1.1' })
    expect(text).toContain('版本：0.1.1')
    expect(text).toContain('sk-***')
    expect(text).not.toContain('sk-abcdefgh')
  })
})
