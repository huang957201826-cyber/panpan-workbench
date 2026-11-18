import type { ApiPrompt } from '../../../lib/comfyPrompt'

/**
 * 精修 / 局部重绘：蒙版外不采样，蒙版内按 denoise 决定改动幅度。
 * 走 InpaintModelConditioning 的 noise_mask，蒙版外的像素原样保留。
 */
export const QWEN_RETOUCH: ApiPrompt = {
  '1': {
    class_type: 'UNETLoader',
    inputs: { unet_name: 'qwen_image_2.1_int8_convrot.safetensors', weight_dtype: 'default' },
  },
  '2': {
    class_type: 'CLIPLoader',
    inputs: { clip_name: 'qwen3vl_8b_int8_convrot.safetensors', type: 'qwen_image' },
  },
  '3': {
    class_type: 'VAELoader',
    inputs: { vae_name: 'qwen_image_2.1_vae_bf16.safetensors' },
  },
  '4': {
    class_type: 'LoadImage',
    inputs: { image: 'example.png' },
    _meta: { title: '__IMAGE__' },
  },
  '5': {
    class_type: 'ImageScaleToTotalPixels',
    inputs: { image: ['4', 0], upscale_method: 'lanczos', megapixels: 1, resolution_steps: 32 },
  },
  '6': {
    class_type: 'LoadImageMask',
    inputs: { image: 'mask.png', channel: 'red' },
    _meta: { title: '__MASK__' },
  },
  '7': {
    class_type: 'GrowMask',
    inputs: { mask: ['6', 0], expand: 8, tapered_corners: true },
  },
  '8': {
    class_type: 'TextEncodeQwenImage21',
    inputs: { clip: ['2', 0], prompt: '', negative_prompt: '', resolution: 1024 },
    _meta: { title: '__PROMPT__' },
  },
  '9': {
    class_type: 'InpaintModelConditioning',
    inputs: {
      positive: ['8', 0],
      negative: ['8', 1],
      vae: ['3', 0],
      pixels: ['5', 0],
      mask: ['7', 0],
      noise_mask: true,
    },
  },
  '10': {
    class_type: 'KSampler',
    inputs: {
      model: ['1', 0],
      seed: 0,
      steps: 20,
      cfg: 2.5,
      sampler_name: 'euler',
      scheduler: 'simple',
      positive: ['9', 0],
      negative: ['9', 1],
      latent_image: ['9', 2],
      denoise: 0.55,
    },
    _meta: { title: '__SEED__' },
  },
  '11': {
    class_type: 'VAEDecode',
    inputs: { samples: ['10', 0], vae: ['3', 0] },
  },
  '12': {
    class_type: 'SaveImage',
    inputs: { images: ['11', 0], filename_prefix: 'panpan/retouch' },
  },
}
