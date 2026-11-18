import type { ApiPrompt } from '../../lib/comfyPrompt'
import type { WorkflowParam } from './manifest'

/**
 * 参数锚点 → API 图落点。
 * 同一张图里每个 classType 只出现一次，所以按类名定位比按节点 id 稳。
 * 节点标题同时写成锚点名，方便在 ComfyUI 里对照。
 */
export interface AnchorTarget {
  classType: string
  input: string
}

export const ANCHOR_INPUTS: Record<string, AnchorTarget> = {
  __IMAGE__: { classType: 'LoadImage', input: 'image' },
  __MASK__: { classType: 'LoadImageMask', input: 'image' },
  __PROMPT__: { classType: 'TextEncodeQwenImage21', input: 'prompt' },
  __SEED__: { classType: 'KSampler', input: 'seed' },
  __DENOISE__: { classType: 'KSampler', input: 'denoise' },
  __STEPS__: { classType: 'KSampler', input: 'steps' },
  __SCALE__: { classType: 'ImageScaleBy', input: 'scale_by' },
  __UPSCALE_MODEL__: { classType: 'UpscaleModelLoader', input: 'model_name' },
  __BG_MODEL__: { classType: 'LoadBackgroundRemovalModel', input: 'bg_removal_name' },
}

/** 按锚点把一次运行的参数值写进 API 图；传入的图会被直接修改，调用方自己 clone */
export function applyParamValues(
  prompt: ApiPrompt,
  params: WorkflowParam[],
  values: Record<string, unknown>,
): ApiPrompt {
  const missing: string[] = []
  for (const param of params) {
    const target = param.anchor ? ANCHOR_INPUTS[param.anchor] : undefined
    if (!param.anchor || !target) continue
    const node = Object.values(prompt).find((item) => item.class_type === target.classType)
    if (!node) {
      missing.push(`${param.anchor}(${target.classType})`)
      continue
    }
    node.inputs[target.input] = values[param.key] ?? param.defaultValue
  }
  if (missing.length > 0) {
    throw new Error(`工作流缺少锚点：${missing.join('、')}。检查 API 图是否被改动`)
  }
  return prompt
}
