import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskParams } from '../types'

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }))

vi.mock('./platform', () => ({ isTauri: true, apiFetch: mocks.apiFetch }))

const { callGeminiImageApi } = await import('./geminiImageApi')
const { createDefaultGoogleProfile, DEFAULT_SETTINGS } = await import('./apiProfiles')
const { DEFAULT_PARAMS } = await import('../types')

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const settings = DEFAULT_SETTINGS
const params: TaskParams = { ...DEFAULT_PARAMS, size: '2560x1440', n: 1 }

describe('callGeminiImageApi', () => {
  beforeEach(() => mocks.apiFetch.mockReset())

  it('调用 v1beta generateContent 并带 imageConfig', async () => {
    mocks.apiFetch.mockResolvedValue(jsonResponse({
      candidates: [{
        content: {
          parts: [
            { text: 'mock revised prompt' },
            { inlineData: { mimeType: 'image/png', data: 'aW1n' } },
          ],
        },
      }],
    }))

    const profile = createDefaultGoogleProfile({ apiKey: 'google-key', model: 'gemini-test-image' })
    const result = await callGeminiImageApi({
      settings,
      prompt: '画一张图',
      params,
      inputImageDataUrls: ['data:image/jpeg;base64,aW5wdXQ='],
    }, profile)

    expect(result.images).toEqual(['data:image/png;base64,aW1n'])
    expect(result.revisedPrompts?.[0]).toBe('mock revised prompt')
    const [url, init] = mocks.apiFetch.mock.calls[0]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test-image:generateContent')
    expect(init.headers['x-goog-api-key']).toBe('google-key')
    const body = JSON.parse(init.body)
    expect(body.generationConfig.imageConfig).toEqual({ aspectRatio: '16:9', imageSize: '2K' })
    expect(body.contents[0].parts[0]).toEqual({ text: '画一张图' })
    expect(body.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: 'aW5wdXQ=' })
  })

  it('没有图片时返回可读原因', async () => {
    mocks.apiFetch.mockResolvedValue(jsonResponse({
      candidates: [{ finishReason: 'SAFETY' }],
    }))
    const profile = createDefaultGoogleProfile({ apiKey: 'google-key' })
    await expect(callGeminiImageApi({
      settings,
      prompt: 'test',
      params,
      inputImageDataUrls: [],
    }, profile)).rejects.toThrow('Gemini 未返回图片：SAFETY')
  })
})
