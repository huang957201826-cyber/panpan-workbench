import type { ApiPrompt } from '../../lib/comfyPrompt'
import { MATTE_CUTOUT } from './api/matte-cutout'
import { QWEN_RETOUCH } from './api/qwen-retouch'
import { QWEN_SU_RENDER } from './api/qwen-su-render'
import { QWEN_UPSCALE } from './api/qwen-upscale'
import { WORKFLOWS } from './manifest'

/**
 * 已接通的本地工作流，API 格式。
 * 节点参数取自引擎 0.44.0 的 /object_info 实测：
 * TextEncodeQwenImage21 输出依次为 positive / negative / latent。
 */
export const QWEN_IMG2IMG: ApiPrompt = {
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
      denoise: 0.55,
    },
    _meta: { title: '__SEED__' },
  },
  '9': {
    class_type: 'VAEDecode',
    inputs: { samples: ['8', 0], vae: ['3', 0] },
  },
  '10': {
    class_type: 'SaveImage',
    inputs: { images: ['9', 0], filename_prefix: 'panpan/qwen' },
  },
}

export const QWEN_TXT2IMG: ApiPrompt = {
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
    class_type: 'EmptySD3LatentImage',
    inputs: { width: 1024, height: 1024, batch_size: 1 },
  },
  '5': {
    class_type: 'TextEncodeQwenImage21',
    inputs: { clip: ['2', 0], prompt: '', negative_prompt: '', resolution: 1024 },
    _meta: { title: '__PROMPT__' },
  },
  '6': {
    class_type: 'KSampler',
    inputs: {
      model: ['1', 0],
      seed: 0,
      steps: 20,
      cfg: 2.5,
      sampler_name: 'euler',
      scheduler: 'simple',
      positive: ['5', 0],
      negative: ['5', 1],
      latent_image: ['4', 0],
      denoise: 1,
    },
    _meta: { title: '__SEED__' },
  },
  '7': {
    class_type: 'VAEDecode',
    inputs: { samples: ['6', 0], vae: ['3', 0] },
  },
  '8': {
    class_type: 'SaveImage',
    inputs: { images: ['7', 0], filename_prefix: 'panpan/qwen' },
  },
}

/** 工作流 id → 已接通的 API 模板；没有条目说明该工作流尚未接通生成链路 */
export const API_WORKFLOW_BY_ID: Record<string, ApiPrompt> = {
  'qwen-edit-base': QWEN_IMG2IMG,
  'qwen-upscale': QWEN_UPSCALE,
  'matte-cutout': MATTE_CUTOUT,
  'qwen-retouch': QWEN_RETOUCH,
  'qwen-su-render': QWEN_SU_RENDER,
}

/** 需要参考图才能运行的工作流，取自 manifest 的 requiresImage */
export const IMAGE_REQUIRED = new Set(WORKFLOWS.filter((item) => item.requiresImage).map((item) => item.id))
