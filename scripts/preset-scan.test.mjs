import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanBinaryFile, scanDistDir, scanPresetJson, scanText } from './preset-scan.mjs'
import { parseJsonWithBom, validateProductIdentity } from './release-check-lib.mjs'

describe('preset scan', () => {
  it('accepts a clean preset', () => {
    const text = JSON.stringify({
      customProviders: [],
      profiles: [
        { id: 'default', provider: 'openai', baseUrl: 'https://api.openai.com/v1' },
        { id: 'tehui-api', provider: 'openai', baseUrl: 'https://api.tehui.xyz/v1', model: 'gpt-image-2.5' },
      ],
    })
    expect(scanPresetJson(text)).toEqual([])
  })

  it('rejects non-empty apiKey and old ad identifiers', () => {
    expect(scanPresetJson(JSON.stringify({ profiles: [{ apiKey: 'sk-secret' }] })).length).toBeGreaterThan(0)
    expect(scanPresetJson(JSON.stringify({ profiles: [{ baseUrl: 'https://api.sz-link.com/v1' }] })).length).toBeGreaterThan(0)
    expect(scanPresetJson(JSON.stringify({ profiles: [{ name: 'JuCodex' }] })).length).toBeGreaterThan(0)
  })

  it('scans built text and directories', () => {
    expect(scanText('const key = "sk-123456789012345678901234"')).not.toEqual([])
    expect(scanText('baseUrl:"https://api.sz-link.com/v1"')).not.toEqual([])
    expect(scanText('const ok = "hello"')).toEqual([])

    const dir = mkdtempSync(join(tmpdir(), 'panpan-preset-scan-'))
    writeFileSync(join(dir, 'app.js'), 'const ok = "hello"')
    expect(scanDistDir(dir)).toEqual([])
    writeFileSync(join(dir, 'bad.js'), 'const old = "jucodex"')
    expect(scanDistDir(dir).length).toBeGreaterThan(0)
  })

  it('parses JSON with a UTF-8 BOM and validates renamed product identity', () => {
    expect(parseJsonWithBom('\uFEFF{"gates":true}')).toEqual({ gates: true })
    expect(validateProductIdentity({ productName: '新品牌工作台', identifier: 'com.example.newbrand' })).toEqual([])
    expect(validateProductIdentity({ productName: '', identifier: 'bad' }).length).toBe(2)
  })

  it('scans UTF-8 and UTF-16 binary payloads', () => {
    const dir = mkdtempSync(join(tmpdir(), 'panpan-binary-scan-'))
    const utf8 = join(dir, 'utf8.bin')
    writeFileSync(utf8, 'plain binary api.sz-link.com')
    expect(scanBinaryFile(utf8).length).toBeGreaterThan(0)

    const utf16 = join(dir, 'utf16.bin')
    writeFileSync(utf16, Buffer.from('secret Bearer abcdefghijklmnop', 'utf16le'))
    expect(scanBinaryFile(utf16).length).toBeGreaterThan(0)

    const clean = join(dir, 'clean.bin')
    writeFileSync(clean, Buffer.from('normal installer text', 'utf16le'))
    expect(scanBinaryFile(clean)).toEqual([])
  })
})
