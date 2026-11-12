import type { SizeTier } from './size'

export type ImageOutputFormat = 'png' | 'jpeg' | 'webp'

export interface ImageModelCapabilities {
  /** 允许的输出档位；未知模型保守只给 1K */
  tiers: SizeTier[]
  formats: ImageOutputFormat[]
  maxSide: number
  /** 是否支持 xhigh / max 质量档 */
  supportsQualityExtremes: boolean
}

const DEFAULT_CAPABILITIES: ImageModelCapabilities = {
  tiers: ['1K'],
  formats: ['png', 'jpeg', 'webp'],
  maxSide: 2048,
  supportsQualityExtremes: false,
}

const MODEL_RULES: Array<{ pattern: RegExp; capabilities: ImageModelCapabilities }> = [
  {
    pattern: /gpt-image-2\.6|gemini-\d[^/]*image/i,
    capabilities: {
      tiers: ['1K', '2K', '4K'],
      formats: ['png', 'jpeg', 'webp'],
      maxSide: 4096,
      supportsQualityExtremes: true,
    },
  },
  {
    pattern: /gpt-image-2\.5/i,
    capabilities: {
      tiers: ['1K', '2K'],
      formats: ['png', 'jpeg', 'webp'],
      maxSide: 2560,
      supportsQualityExtremes: true,
    },
  },
]

/** 按模型名匹配能力；未知模型只保留 1K 与常见格式，避免发出超规格请求 */
export function getImageModelCapabilities(model: string): ImageModelCapabilities {
  const normalized = model.trim()
  if (!normalized) return DEFAULT_CAPABILITIES
  return MODEL_RULES.find((rule) => rule.pattern.test(normalized))?.capabilities ?? DEFAULT_CAPABILITIES
}

export function getSupportedSizeTiers(model: string): SizeTier[] {
  return getImageModelCapabilities(model).tiers
}

export function supportsQualityExtremes(model: string): boolean {
  return getImageModelCapabilities(model).supportsQualityExtremes
}
