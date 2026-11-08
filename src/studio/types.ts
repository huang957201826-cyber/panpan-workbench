export type CanvasTool = 'select' | 'hand' | 'draw' | 'comment';
export type ActiveActivity = 'projects' | 'workflow' | 'skills' | 'models' | 'engine';

export interface GenerationParams {
  model: string;
  dimension: string;
  quality: string;
  count: number;
  format: 'PNG' | 'WebP' | 'JPEG';
  transparent: boolean;
  compression?: number | null;
  filter: 'auto' | 'standard' | 'strict';
  sampler?: string;
  steps?: number;
  cfgScale?: number;
  seed?: number;
}

export interface ReferenceImage {
  id: string;
  url: string;
  name: string;
  tagNumber: number; // 1, 2, 3...
  weight: number; // 0.1 - 1.0 (default 0.75)
  role: 'ref' | 'style' | 'structure';
  /** 画布素材已被删除，输入框只保留缺失占位 */
  missing?: boolean;
}

export interface LocalModelItem {
  id: string;
  name: string;
  type: 'checkpoint' | 'lora' | 'controlnet' | 'vae';
  size: string;
  baseModel: 'FLUX.1' | 'SDXL' | 'SD1.5';
  filename: string;
  triggerWords?: string[];
  isActive?: boolean;
  weight?: number;
}

export interface Artboard {
  id: string;
  title: string;
  imageUrl: string;
  aspectRatio: string;
  resolution: string;
  model: string;
  renderTime?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isLocked?: boolean;
  prompt?: string;
  seed?: number;
  quality?: string;
  format?: string;
  transparent?: boolean;
  filter?: string;
  count?: number;
  createdAt?: string;
  duration?: string;
  taskId?: string;
  imageId?: string;
  /** 该图在多图任务里的序号（0 起）；只有多图任务才有，用于下载文件名区分 */
  imageIndex?: number;
  /** 任务状态：占位卡片（还没出图）靠它渲染“生成中 / 失败” */
  status?: 'running' | 'error' | 'done';
  errorMessage?: string;
  isStarred?: boolean;
  /** 参考图素材卡：来自画布 imageNodes，不是生成任务，因此没有 taskId / 耗时 / 模型 */
  isAsset?: boolean;
  /** 素材编号「图N」，与画布节点、输入台参考图架保持一致 */
  assetNumber?: number;
  referenceImages?: ReferenceImage[];
}

export interface CanvasComment {
  id: string;
  x: number;
  y: number;
  text: string;
  author: string;
  time: string;
}

export interface ProjectScheme {
  id: string;
  title: string;
  prompt: string;
  updatedAt: string;
  params: GenerationParams;
  artboards: Artboard[];
  referenceImages?: ReferenceImage[];
}

export interface ProjectFolder {
  id: string;
  name: string;
  isExpanded: boolean;
  schemes: ProjectScheme[];
}

// ==========================================
// Module 2: ComfyUI 节点引擎与电池工作流类型
// ==========================================
export type PortType = 'model' | 'clip' | 'vae' | 'latent' | 'image' | 'conditioning' | 'mask' | 'number' | 'string';

export interface NodePort {
  id: string;
  name: string;
  type: PortType;
  direction: 'input' | 'output';
}

export interface WorkflowNode {
  id: string;
  type: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  inputs: NodePort[];
  outputs: NodePort[];
  properties: Record<string, any>;
  status?: 'idle' | 'running' | 'completed' | 'error';
  color?: string;
}

export interface NodeConnection {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
  color?: string;
}

export interface WorkflowPreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  nodes: WorkflowNode[];
  connections: NodeConnection[];
}

// ==========================================
// Module 3: 技能与配方库 (Skill & Prompt Hub)
// ==========================================
export interface SkillVariable {
  key: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  options?: string[];
}

export interface SkillItem {
  id: string;
  title: string;
  category: 'commercial' | 'lighting' | 'materials' | 'styles' | 'product' | 'negative' | 'custom';
  categoryLabel: string;
  description: string;
  previewUrl: string;
  recommendedModel: string;
  promptTemplate: string;
  negativePrompt?: string;
  tags: string[];
  variables?: SkillVariable[];
  suggestedParams?: Partial<GenerationParams>;
  isFavorite?: boolean;
  author?: string;
}
