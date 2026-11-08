import { describe, expect, it, vi } from 'vitest'
import { isInsecureBaseUrl, testApiConnection } from './connectionTest'

const profile = { baseUrl: 'https://api.example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2', selectedModel: '' }

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('connectionTest', () => {
  it('accepts a model returned by /models', async () => {
    const fetcher = vi.fn(async () => response({ data: [{ id: 'gpt-image-2' }] }))
    await expect(testApiConnection(profile, fetcher as never)).resolves.toMatchObject({
      ok: true,
      message: '连接成功，模型 gpt-image-2 可用',
    })
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/v1/models', {
      headers: { Authorization: 'Bearer sk-test' },
    })
  })

  it('rejects a model missing from /models', async () => {
    const fetcher = vi.fn(async () => response({ data: [{ id: 'other-model' }] }))
    await expect(testApiConnection(profile, fetcher as never)).resolves.toMatchObject({
      ok: false,
      message: '已连接，但未找到模型 gpt-image-2',
    })
  })

  it('reports HTTP failures', async () => {
    const fetcher = vi.fn(async () => response({}, 401))
    await expect(testApiConnection(profile, fetcher as never)).resolves.toMatchObject({
      ok: false,
      message: '连接失败：HTTP 401',
    })
  })

  it('flags only non-local plain HTTP addresses', () => {
    expect(isInsecureBaseUrl('http://api.example.com/v1')).toBe(true)
    expect(isInsecureBaseUrl('http://127.0.0.1:8080/v1')).toBe(false)
    expect(isInsecureBaseUrl('https://api.example.com/v1')).toBe(false)
  })
})
