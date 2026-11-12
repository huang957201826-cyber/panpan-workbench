import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './apiProfiles'
import { parsePpConfig } from './ppConfig'

const VALID = {
  version: 1,
  providers: [],
  profiles: [
    {
      name: '中转站',
      provider: 'openai',
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-image-2.5,gpt-image-1',
      timeout: 300,
      apiMode: 'images',
    },
  ],
}

describe('parsePpConfig', () => {
  it('解析 v1 配置码并给出预览', () => {
    const parsed = parsePpConfig(JSON.stringify(VALID), DEFAULT_SETTINGS)

    expect(parsed.profiles).toHaveLength(1)
    expect(parsed.profiles[0].name).toBe('中转站')
    expect(parsed.profiles[0].apiKey).toBe('')
    expect(parsed.preview.profiles[0]).toMatchObject({ name: '中转站', provider: 'openai', existing: false })
  })

  it('拒绝不支持的版本', () => {
    expect(() => parsePpConfig(JSON.stringify({ ...VALID, version: 2 }))).toThrow('版本不受支持')
  })

  it('拒绝未知字段', () => {
    expect(() => parsePpConfig(JSON.stringify({ ...VALID, extra: true }))).toThrow('未知字段：extra')
    expect(() => parsePpConfig(JSON.stringify({
      ...VALID,
      profiles: [{ ...VALID.profiles[0], secret: 'x' }],
    }))).toThrow('未知字段：secret')
  })

  it('拒绝携带 API Key', () => {
    expect(() => parsePpConfig(JSON.stringify({
      ...VALID,
      profiles: [{ ...VALID.profiles[0], apiKey: 'sk-test' }],
    }))).toThrow('不能包含 API Key')
  })

  it('现有连接配置标记为更新', () => {
    const current = {
      ...DEFAULT_SETTINGS,
      profiles: [{
        ...DEFAULT_SETTINGS.profiles[0],
        name: '本机配置',
        baseUrl: VALID.profiles[0].baseUrl,
        model: VALID.profiles[0].model,
        apiKey: 'sk-local',
      }],
      activeProfileId: DEFAULT_SETTINGS.profiles[0].id,
    }

    const parsed = parsePpConfig(JSON.stringify(VALID), current)
    expect(parsed.preview.profiles[0].existing).toBe(true)
  })

  it('坏 JSON 直接拒绝', () => {
    expect(() => parsePpConfig('{oops')).toThrow('不是有效的 JSON')
  })
})
