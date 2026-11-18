import type { ApiPrompt } from '../../../lib/comfyPrompt'

/**
 * 抠图：背景移除模型出蒙版，再合回 alpha 通道，输出带透明的 PNG。
 * 只做分离不做替换，换背景在合成阶段做。
 */
export const MATTE_CUTOUT: ApiPrompt = {
  '1': {
    class_type: 'LoadImage',
    inputs: { image: 'example.png' },
    _meta: { title: '__IMAGE__' },
  },
  '2': {
    class_type: 'LoadBackgroundRemovalModel',
    inputs: { bg_removal_name: 'birefnet-general.safetensors' },
    _meta: { title: '__BG_MODEL__' },
  },
  '3': {
    class_type: 'RemoveBackground',
    inputs: { bg_removal_model: ['2', 0], image: ['1', 0] },
  },
  '4': {
    class_type: 'JoinImageWithAlpha',
    inputs: { image: ['1', 0], alpha: ['3', 0] },
  },
  '5': {
    class_type: 'SaveImage',
    inputs: { images: ['4', 0], filename_prefix: 'panpan/matte' },
  },
}
