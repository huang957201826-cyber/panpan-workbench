import type { ApiPrompt } from '../../../lib/comfyPrompt'

/**
 * 模型截图转效果图：SU / 犀牛视口截图当参考图，VAE 编码后按 denoise 重绘。
 * 结构靠低 denoise 压住，不接 ControlNet，装了控图模型后可另起一条更强的。
 */
export const QWEN_SU_RENDER: ApiPrompt = {
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
    class_type: 'VAEEncode',
    inputs: { pixels: ['5', 0], vae: ['3', 0] },
  },
  '7': {
    class_type: 'TextEncodeQwenImage21',
    inputs: { clip: ['2', 0], prompt: '', negative_prompt: '', resolution: 1024 },
    _meta: { title: '__PROMPT__' },
  },
  '8': {
    class_type: 'KSampler',
    inputs: {
      model: ['1', 0],
      seed: 0,
      steps: 20,
      cfg: 2.5,
      sampler_name: 'euler',
      scheduler: 'simple',
      positive: ['7', 0],
      negative: ['7', 1],
      latent_image: ['6', 0],
      denoise: 0.7,
    },
    _meta: { title: '__SEED__' },
  },
  '9': {
    class_type: 'VAEDecode',
    inputs: { samples: ['8', 0], vae: ['3', 0] },
  },
  '10': {
    class_type: 'SaveImage',
    inputs: { images: ['9', 0], filename_prefix: 'panpan/su-render' },
  },
}
