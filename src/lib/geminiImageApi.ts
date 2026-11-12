import type { ApiProfile, TaskParams } from '../types'
import { DEFAULT_GEMINI_BASE_URL, DEFAULT_GEMINI_MODEL } from './apiProfiles'
import {
  createRequestTimeoutError,
  getApiErrorMessage,
  linkAbortSignal,
  type CallApiOptions,
  type CallApiResult,
} from './imageApiShared'
import { apiFetch } from './platform'

interface GeminiInlineData {
  mimeType?: string
  mime_type?: string
  data?: string
}

interface GeminiPart {
  text?: string
  inlineData?: GeminiInlineData
  inline_data?: GeminiInlineData
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] }
    finishReason?: string
  }>
  promptFeedback?: { blockReason?: string }
}

const RATIO_BY_SIZE: Record<string, string> = {
  '1024x1024': '1:1',
  '1280x720': '16:9',
  '720x1280': '9:16',
  '1536x1024': '3:2',
  '1024x1536': '2:3',
  '2048x2048': '1:1',
  '2560x1440': '16:9',
  '1440x2560': '9:16',
  '3840x2160': '16:9',
  '2160x3840': '9:16',
}

function getAspectRatio(size: string) {
  return RATIO_BY_SIZE[size] ?? '1:1'
}

/** 按最长边映射 Gemini 的 imageSize 档位 */
function getImageSizeTier(size: string) {
  const [width, height] = size.split('x').map((value) => Number(value))
  const longest = Math.max(width || 0, height || 0)
  if (longest > 3072) return '4K'
  if (longest > 1536) return '2K'
  return '1K'
}

function splitDataUrl(dataUrl: string) {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return null
  const meta = dataUrl.slice(0, comma)
  const mimeType = /^data:([^;]+)/.exec(meta)?.[1] ?? 'image/png'
  return { mimeType, data: dataUrl.slice(comma + 1) }
}

function buildUrl(profile: ApiProfile, model: string) {
  const raw = (profile.baseUrl || DEFAULT_GEMINI_BASE_URL).trim().replace(/\/+$/, '')
  const base = /\/v1beta$/.test(raw) ? raw : `${raw}/v1beta`
  return `${base}/models/${encodeURIComponent(model || DEFAULT_GEMINI_MODEL)}:generateContent`
}

function buildBody(options: CallApiOptions) {
  const parts: GeminiPart[] = [{ text: options.prompt }]
  for (const dataUrl of options.inputImageDataUrls) {
    const image = splitDataUrl(dataUrl)
    if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } })
  }
  return {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: getAspectRatio(options.params.size),
        imageSize: getImageSizeTier(options.params.size),
      },
    },
  }
}

function parseImages(payload: GeminiResponse) {
  const parts = payload.candidates?.[0]?.content?.parts ?? []
  const images: string[] = []
  const texts: string[] = []
  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data
    if (inline?.data) {
      const mime = inline.mimeType ?? inline.mime_type ?? 'image/png'
      images.push(`data:${mime};base64,${inline.data}`)
      continue
    }
    if (part.text?.trim()) texts.push(part.text.trim())
  }
  return { images, text: texts.join('\n') || undefined }
}

function mimeToFormat(mime: string): TaskParams['output_format'] {
  if (mime.includes('jpeg')) return 'jpeg'
  if (mime.includes('webp')) return 'webp'
  return 'png'
}

async function requestOnce(profile: ApiProfile, options: CallApiOptions, signal: AbortSignal) {
  const response = await apiFetch(buildUrl(profile, profile.model), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': profile.apiKey,
    },
    cache: 'no-store',
    body: JSON.stringify(buildBody(options)),
    signal,
  })

  if (!response.ok) throw new Error(await getApiErrorMessage(response))

  const payload = await response.json() as GeminiResponse
  const parsed = parseImages(payload)
  if (!parsed.images.length) {
    const reason = payload.promptFeedback?.blockReason ?? payload.candidates?.[0]?.finishReason
    throw new Error(reason ? `Gemini 未返回图片：${reason}` : 'Gemini 未返回图片数据')
  }
  const mime = parsed.images[0].slice(5, parsed.images[0].indexOf(';'))
  return {
    images: parsed.images,
    revisedPrompt: parsed.text,
    actualParams: { size: options.params.size, output_format: mimeToFormat(mime) } as Partial<TaskParams>,
  }
}

/** Google Gemini 原生 generateContent 生图；不支持流式与原生透明背景 */
export async function callGeminiImageApi(options: CallApiOptions, profile: ApiProfile): Promise<CallApiResult> {
  const timeoutSeconds = profile.timeout > 0 ? profile.timeout : 600
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(createRequestTimeoutError(timeoutSeconds)), timeoutSeconds * 1000)
  const unlink = linkAbortSignal(controller, options.signal)

  try {
    const count = Math.max(1, Math.min(4, options.params.n || 1))
    const results = await Promise.all(
      Array.from({ length: count }, () => requestOnce(profile, options, controller.signal)),
    )
    return {
      images: results.flatMap((result) => result.images),
      actualParams: results[0]?.actualParams,
      actualParamsList: results.flatMap((result) => result.images.map(() => result.actualParams)),
      revisedPrompts: results.flatMap((result) => result.images.map(() => result.revisedPrompt)),
    }
  } finally {
    clearTimeout(timeoutId)
    unlink()
  }
}
