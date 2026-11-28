import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultOpenAIProfile } from '../../lib/apiProfiles'
import {
  KEY_SENTINEL,
  fromPrototype,
  testConnection,
  toPrototype,
  type PrototypeApiProfile,
} from './settings'
import { applySkill, resolveVariables } from './skills'

function storeProfile() {
  return {
    ...createDefaultOpenAIProfile({ id: 'p1', name: '测试配置' }),
    provider: 'openai',
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'sk-secret',
    model: 'gpt-image-2.5, flux.1-dev',
    selectedModel: 'gpt-image-2.5',
    timeout: 120,
    apiMode: 'images' as const,
    streamImages: true,
    streamPartialImages: 2,
  }
}

describe('设置适配层', () => {
  it('toPrototype 输出哨兵，不泄露 apiKey', () => {
    const proto = toPrototype(storeProfile())
    expect(proto.apiKey).toBe(KEY_SENTINEL)
    expect(proto.models).toEqual(['gpt-image-2.5', 'flux.1-dev'])
    expect(proto.apiUrl).toBe('https://api.example.com/v1')
    expect(proto.timeoutSec).toBe(120)
  })

  it('fromPrototype 遇到哨兵沿用旧密钥，否则写新密钥', () => {
    const previous = storeProfile()
    const withSentinel: PrototypeApiProfile = { ...toPrototype(previous), name: '改名' }
    expect(fromPrototype(withSentinel, previous).apiKey).toBe('sk-secret')
    const withNewKey: PrototypeApiProfile = { ...withSentinel, apiKey: 'sk-new' }
    expect(fromPrototype(withNewKey, previous).apiKey).toBe('sk-new')
    expect(fromPrototype({ ...withSentinel, apiKey: KEY_SENTINEL }).apiKey).toBe('')
  })

  it('往返保留名称、地址、模型与流式设置', () => {
    const roundtrip = fromPrototype(toPrototype(storeProfile()), storeProfile())
    expect(roundtrip.name).toBe('测试配置')
    expect(roundtrip.baseUrl).toBe('https://api.example.com/v1')
    expect(roundtrip.model).toBe('gpt-image-2.5, flux.1-dev')
    expect(roundtrip.streamImages).toBe(true)
    expect(roundtrip.streamPartialImages).toBe(2)
  })
})

describe('技能适配层', () => {
  it('复制 / 追加 / 替换三种模式', () => {
    expect(applySkill('旧内容', '新技能', 'copy')).toBe('新技能')
    expect(applySkill('旧内容', '新技能', 'append')).toBe('旧内容，新技能')
    expect(applySkill('', '新技能', 'append')).toBe('新技能')
    expect(applySkill('旧内容', '新技能', 'replace')).toBe('新技能')
  })

  it('变量用默认值替换，未知占位保留', () => {
    expect(resolveVariables('把 {style} 做成 {material}', { style: '极简', material: '木饰面' })).toBe('把 极简 做成 木饰面')
    expect(resolveVariables('保留 {unknown}', {})).toBe('保留 {unknown}')
  })
})

describe('测试连接', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('成功返回模型列表', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 'gpt-image-2.5' }, { id: 'flux' }] }), { status: 200 })))
    const result = await testConnection('https://api.example.com/v1', 'sk-key')
    expect(result.ok).toBe(true)
    expect(result.models).toEqual(['gpt-image-2.5', 'flux'])
  })

  it('401 报密钥无效', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unauthorized', { status: 401 })))
    const result = await testConnection('https://api.example.com/v1', 'bad')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('密钥无效')
  })

  it('未带 /v1 的根地址 404 时自动尝试 /v1/models 并返回标准化地址', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/v1/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'gpt-image-2.5' }] }), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    }))
    const result = await testConnection('https://api.example.com', 'sk-key')
    expect(result.ok).toBe(true)
    expect(result.models).toEqual(['gpt-image-2.5'])
    expect(result.normalizedUrl).toBe('https://api.example.com/v1')
  })

  it('超时与网络错误分开报', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))
    const pending = testConnection('https://api.example.com/v1', 'sk-key', { timeoutMs: 50 })
    await vi.advanceTimersByTimeAsync(80)
    const result = await pending
    expect(result.ok).toBe(false)
    expect(result.error).toContain('超时')
  })
})
