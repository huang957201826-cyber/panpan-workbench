import type { ApiPrompt } from '../../../lib/comfyPrompt'

/**
 * 无损放大：放大模型直出，不经过采样器，像素内容不重绘，只做插值放大。
 * 放大模型自带的倍率（如 4x）由模型决定，ImageScaleBy 是最后一道微调，1 表示不额外缩放。
 */
export const QWEN_UPSCALE: ApiPrompt = {
  '1': {
    class_type: 'LoadImage',
    inputs: { image: 'example.png' },
    _meta: { title: '__IMAGE__' },
  },
  '2': {
    class_type: 'UpscaleModelLoader',
    inputs: { model_name: 'RealESRGAN_x4plus.pth' },
    _meta: { title: '__UPSCALE_MODEL__' },
  },
  '3': {
    class_type: 'ImageUpscaleWithModel',
    inputs: { upscale_model: ['2', 0], image: ['1', 0] },
  },
  '4': {
    class_type: 'ImageScaleBy',
    inputs: { image: ['3', 0], upscale_method: 'lanczos', scale_by: 1 },
    _meta: { title: '__SCALE__' },
  },
  '5': {
    class_type: 'SaveImage',
    inputs: { images: ['4', 0], filename_prefix: 'panpan/upscale' },
  },
}
