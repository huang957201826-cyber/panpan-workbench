/**
 * 工作流库清单。只描述“怎么用”，不内嵌 workflow JSON；
 * JSON 在 W3 随驱动器一起接入，换工作流只改这里的 file 字段。
 */
export type WorkflowCategory =
  | 'base'
  | 'control'
  | 'angle'
  | 'inpaint'
  | 'fast'
  | 'upscale'
  | 'matte'
  | 'retouch'

export interface WorkflowParam {
  key: string
  label: string
  type: 'text' | 'image' | 'number' | 'range' | 'boolean' | 'select'
  defaultValue: string | number | boolean
  min?: number
  max?: number
  step?: number
  options?: string[]
  hint?: string
  /** basic 直接露出，advanced 折叠 */
  group?: 'basic' | 'advanced'
  /** 由锚点驱动的参数填这里的节点标题 */
  anchor?: string
}

export interface WorkflowManifest {
  id: string
  name: string
  category: WorkflowCategory
  description: string
  file: string
  /** 相对 ComfyUI 的 models 目录，缺失时在界面上标红 */
  models: string[]
  params: WorkflowParam[]
  estimateSeconds: number
  license: string
  /** 模型路径是否在镜像上实测过 */
  verified: boolean
  /** 需要参考图才能运行 */
  requiresImage: boolean
}

export const WORKFLOW_CATEGORY_LABEL: Record<WorkflowCategory, string> = {
  base: '打底',
  control: '结构控制',
  angle: '多角度',
  inpaint: '局部重绘',
  fast: '快速出图',
  upscale: '无损放大',
  matte: '抠图',
  retouch: '精修',
}

/** 只保留四条高频工作流，其余下线 */
const KEEP = new Set(['qwen-upscale', 'matte-cutout', 'qwen-retouch', 'qwen-su-render'])

const ALL_WORKFLOWS: WorkflowManifest[] = [
  {
    id: 'qwen-edit-base',
    name: '千问 · 参考图编辑',
    category: 'base',
    description: '把 SU 截图当参考图，按提示词重做成效果图。结构由原图带着走，是其余工作流的基线。',
    file: 'image_qwen_image_2_1_image_edit.json',
    models: [
      'diffusion_models/qwen_image_2.1_int8_convrot.safetensors',
      'text_encoders/qwen3vl_8b_int8_convrot.safetensors',
      'vae/qwen_image_2.1_vae_bf16.safetensors',
    ],
    params: [
      { key: 'prompt', label: '提示词', type: 'text', defaultValue: '', hint: '材质、风格、光照；不要重复描述结构' },
      { key: 'image', label: '参考图', type: 'image', defaultValue: '' },
      { key: 'strength', label: '重绘幅度', type: 'range', defaultValue: 0.85, min: 0.2, max: 0.95, step: 0.05, hint: '线稿转写实用 0.8–0.9；低于 0.7 会保留白纸' },
    ],
    estimateSeconds: 45,
    license: 'MIT（Comfy-Org/workflow_templates）',
    verified: true,
    requiresImage: true,
  },
  {
    id: 'qwen-controlnet',
    name: '千问 · 精准控图',
    category: 'control',
    description: 'ControlNet Union 叠加深度或线稿，锁死透视与体块。结构保持最强的一条。',
    file: 'image_qwen_image_instantx_controlnet.json',
    models: [
      'diffusion_models/qwen_image_2.1_int8_convrot.safetensors',
      'text_encoders/qwen3vl_8b_int8_convrot.safetensors',
      'vae/qwen_image_2.1_vae_bf16.safetensors',
      'model_patches/qwen_image_2.1_fun_controlnet_union_int8_convrot.safetensors',
    ],
    params: [
      { key: 'prompt', label: '提示词', type: 'text', defaultValue: '' },
      { key: 'image', label: '结构参考图', type: 'image', defaultValue: '' },
      { key: 'strength', label: '控制强度', type: 'range', defaultValue: 0.85, min: 0.4, max: 1, step: 0.05, hint: '0.7–1.0，越低越容易跑偏' },
    ],
    estimateSeconds: 25,
    license: 'MIT（Comfy-Org/workflow_templates）',
    verified: true,
    requiresImage: true,
  },
  {
    id: 'qwen-multiangle',
    name: '千问 · 多角度',
    category: 'angle',
    description: '带相机角度节点，同一张图换视角出图。批量做 10 个立面的基础。',
    file: 'template_qwen_multiangle.app.json',
    models: [
      'diffusion_models/qwen_image_edit_2511_int8_convrot.safetensors',
      'text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors',
      'vae/qwen_image_vae.safetensors',
      'loras/qwen-image-edit-2511-multiple-angles-lora.safetensors',
      'loras/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors',
    ],
    params: [
      { key: 'prompt', label: '提示词', type: 'text', defaultValue: '' },
      { key: 'image', label: '参考图', type: 'image', defaultValue: '' },
      { key: 'angle', label: '偏转角度', type: 'range', defaultValue: 45, min: -180, max: 180, step: 15, hint: '0 保持原视角，±45 常见轴测' },
    ],
    estimateSeconds: 30,
    license: 'MIT（Comfy-Org/workflow_templates）',
    verified: false,
    requiresImage: true,
  },
  {
    id: 'qwen-turbo',
    name: '千问 · 快速出图',
    category: 'fast',
    description: '8 步出图，用来快速试风格和构图。画质略降，速度约是标准版的三分之一。',
    file: 'image_qwen_image_2_1_turbo_image_edit.json',
    models: [
      'diffusion_models/qwen_image_2.1_turbo_int8_convrot.safetensors',
      'text_encoders/qwen3vl_8b_int8_convrot.safetensors',
      'vae/qwen_image_2.1_vae_bf16.safetensors',
    ],
    params: [
      { key: 'prompt', label: '提示词', type: 'text', defaultValue: '' },
      { key: 'image', label: '参考图', type: 'image', defaultValue: '' },
      { key: 'strength', label: '重绘幅度', type: 'range', defaultValue: 0.6, min: 0.2, max: 0.85, step: 0.05 },
    ],
    estimateSeconds: 12,
    license: 'MIT（Comfy-Org/workflow_templates）',
    verified: true,
    requiresImage: true,
  },
  {
    id: 'qwen-inpaint',
    name: '千问 · 局部重绘',
    category: 'inpaint',
    description: '只改涂选区域：换材质、换天色、去掉临时配景。没涂的地方不动。',
    file: 'image_qwen_image_instantx_inpainting_controlnet.json',
    models: [
      'diffusion_models/qwen_image_fp8_e4m3fn.safetensors',
      'text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors',
      'vae/qwen_image_vae.safetensors',
      'controlnet/Qwen-Image-InstantX-ControlNet-Inpainting.safetensors',
      'loras/Qwen-Image-Lightning-4steps-V1.0.safetensors',
    ],
    params: [
      { key: 'prompt', label: '改成什么', type: 'text', defaultValue: '' },
      { key: 'image', label: '原图', type: 'image', defaultValue: '' },
      { key: 'strength', label: '重绘幅度', type: 'range', defaultValue: 0.75, min: 0.4, max: 1, step: 0.05 },
    ],
    estimateSeconds: 30,
    license: 'MIT（Comfy-Org/workflow_templates）',
    verified: false,
    requiresImage: true,
  },
  {
    id: 'qwen-union-lora',
    name: '千问 · 轻量控图',
    category: 'control',
    description: '用 LoRA 版 Union 控件，显存占用更低。显卡吃紧时用它兜底。',
    file: 'image_qwen_image_union_control_lora.json',
    models: [
      'diffusion_models/qwen_image_fp8_e4m3fn.safetensors',
      'text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors',
      'vae/qwen_image_vae.safetensors',
      'loras/qwen_image_union_diffsynth_lora.safetensors',
      'loras/Qwen-Image-Lightning-4steps-V1.0.safetensors',
    ],
    params: [
      { key: 'prompt', label: '提示词', type: 'text', defaultValue: '' },
      { key: 'image', label: '结构参考图', type: 'image', defaultValue: '' },
      { key: 'strength', label: '控制强度', type: 'range', defaultValue: 0.8, min: 0.4, max: 1, step: 0.05 },
    ],
    estimateSeconds: 20,
    license: 'MIT（Comfy-Org/workflow_templates）',
    verified: false,
    requiresImage: true,
  },
  {
    id: 'qwen-upscale',
    name: '无损放大',
    category: 'upscale',
    description: '放大模型直出，不经过采样器：只插值放大，不改像素内容。适合出图后统一放大，或把低清素材先撑起来再进精修。',
    file: 'api/qwen-upscale.ts',
    models: ['upscale_models/RealESRGAN_x4plus.pth'],
    params: [
      { key: 'image', label: '原图', type: 'image', defaultValue: '', group: 'basic', anchor: '__IMAGE__' },
      {
        key: 'scale',
        label: '额外缩放',
        type: 'range',
        defaultValue: 1,
        min: 1,
        max: 2,
        step: 0.05,
        group: 'basic',
        anchor: '__SCALE__',
        hint: '1 表示只用放大模型自带倍率（4x）；1.5 表示在 4x 基础上再放大一半',
      },
      {
        key: 'model',
        label: '放大模型',
        type: 'select',
        defaultValue: 'RealESRGAN_x4plus.pth',
        options: ['RealESRGAN_x4plus.pth', '4x-UltraSharp.pth', '4x_foolhardy_Remacri.pth'],
        group: 'advanced',
        anchor: '__UPSCALE_MODEL__',
      },
    ],
    estimateSeconds: 4,
    license: 'MIT（本仓库自建）',
    verified: false,
    requiresImage: true,
  },
  {
    id: 'matte-cutout',
    name: '抠图',
    category: 'matte',
    description: '自动分离主体，输出带透明通道的 PNG。只做分离不做替换，换背景放到合成阶段做。',
    file: 'api/matte-cutout.ts',
    models: ['background_removal/birefnet-general.safetensors'],
    params: [
      { key: 'image', label: '原图', type: 'image', defaultValue: '', group: 'basic', anchor: '__IMAGE__' },
      {
        key: 'model',
        label: '抠图模型',
        type: 'select',
        defaultValue: 'birefnet-general.safetensors',
        options: ['birefnet-general.safetensors', 'rmbg-2.0.safetensors'],
        group: 'advanced',
        anchor: '__BG_MODEL__',
      },
    ],
    estimateSeconds: 3,
    license: 'MIT（本仓库自建）',
    verified: false,
    requiresImage: true,
  },
  {
    id: 'qwen-retouch',
    name: '精修 · 局部重绘',
    category: 'retouch',
    description: '只在蒙版内重绘：换材质、补细节、去掉临时配景。蒙版外的像素原样保留，不会整张重做。',
    file: 'api/qwen-retouch.ts',
    models: [
      'diffusion_models/qwen_image_2.1_int8_convrot.safetensors',
      'text_encoders/qwen3vl_8b_int8_convrot.safetensors',
      'vae/qwen_image_2.1_vae_bf16.safetensors',
    ],
    params: [
      { key: 'prompt', label: '改成什么', type: 'text', defaultValue: '', group: 'basic', anchor: '__PROMPT__' },
      { key: 'image', label: '原图', type: 'image', defaultValue: '', group: 'basic', anchor: '__IMAGE__' },
      {
        key: 'mask',
        label: '蒙版',
        type: 'image',
        defaultValue: '',
        group: 'basic',
        anchor: '__MASK__',
        hint: '白色区域重绘，黑色区域保留',
      },
      {
        key: 'denoise',
        label: '重绘幅度',
        type: 'range',
        defaultValue: 0.55,
        min: 0.2,
        max: 1,
        step: 0.05,
        group: 'basic',
        anchor: '__DENOISE__',
        hint: '0.4 只补细节；0.7 换材质；1.0 完全重画蒙版区',
      },
      { key: 'steps', label: '步数', type: 'number', defaultValue: 20, min: 4, max: 40, step: 1, group: 'advanced', anchor: '__STEPS__' },
      { key: 'seed', label: '种子', type: 'number', defaultValue: 0, min: 0, max: 4294967295, step: 1, group: 'advanced', anchor: '__SEED__' },
    ],
    estimateSeconds: 35,
    license: 'MIT（本仓库自建）',
    verified: true,
    requiresImage: true,
  },
  {
    id: 'qwen-su-render',
    name: '模型截图 · 转效果图',
    category: 'base',
    description: '把 SU / 犀牛视口截图当参考图，按提示词重做成效果图。结构靠低重绘幅度压住，不接 ControlNet。',
    file: 'api/qwen-su-render.ts',
    models: [
      'diffusion_models/qwen_image_2.1_int8_convrot.safetensors',
      'text_encoders/qwen3vl_8b_int8_convrot.safetensors',
      'vae/qwen_image_2.1_vae_bf16.safetensors',
    ],
    params: [
      { key: 'prompt', label: '提示词', type: 'text', defaultValue: '', group: 'basic', anchor: '__PROMPT__' },
      { key: 'image', label: '参考图', type: 'image', defaultValue: '', group: 'basic', anchor: '__IMAGE__' },
      {
        key: 'denoise',
        label: '重绘幅度',
        type: 'range',
        defaultValue: 0.7,
        min: 0.3,
        max: 0.95,
        step: 0.05,
        group: 'basic',
        anchor: '__DENOISE__',
        hint: '0.6 保结构；0.8 重做材质和光影；超过 0.85 体块容易跑',
      },
      { key: 'steps', label: '步数', type: 'number', defaultValue: 20, min: 4, max: 40, step: 1, group: 'advanced', anchor: '__STEPS__' },
      { key: 'seed', label: '种子', type: 'number', defaultValue: 0, min: 0, max: 4294967295, step: 1, group: 'advanced', anchor: '__SEED__' },
    ],
    estimateSeconds: 45,
    license: 'MIT（本仓库自建）',
    verified: true,
    requiresImage: true,
  },
]

export function findWorkflow(id: string): WorkflowManifest | undefined {
  return WORKFLOWS.find((workflow) => workflow.id === id)
}

/** 对外只暴露保留项，顺序即左栏顺序 */
export const WORKFLOWS: WorkflowManifest[] = ALL_WORKFLOWS.filter((item) => KEEP.has(item.id))