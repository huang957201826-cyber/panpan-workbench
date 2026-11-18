export type CanvasTool = 'select' | 'hand' | 'draw' | 'comment';
export type ActiveActivity = 'home' | 'projects' | 'workflow' | 'skills' | 'models' | 'engine';

export interface GenerationParams {
  model: string;
  dimension: string;
  quality: string;
  count: number;
  format: 'PNG' | 'WebP' | 'JPEG';
  transparent: boolean;
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
  isStarred?: boolean;
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

export interface WorkflowGroupBox {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
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
  bypassed?: boolean;
  groupId?: string;
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

export type WorkflowToolId = 'model-to-render' | 'inpaint' | 'upscale' | 'cutout';
export type WorkflowCategoryId = WorkflowToolId | 'custom';

export interface WorkflowPreset {
  id: string;
  name: string;
  category: WorkflowCategoryId;
  categoryLabel: string;
  badge: string;
  description: string;
  coverBeforeUrl?: string;
  coverAfterUrl?: string;
  isStarred?: boolean;
  isCustom?: boolean;
  groups?: WorkflowGroupBox[];
  nodes: WorkflowNode[];
  connections: NodeConnection[];
}

export interface WorkflowHistoryRecord {
  id: string;
  presetId?: string;
  presetName?: string;
  toolId: WorkflowToolId;
  toolLabel: string;
  title: string;
  inputUrl: string;
  outputUrl: string;
  batchUrls?: string[];
  createdAt: string;
  duration: string;
  resolution: string;
  summary: string;
  paramsSnapshot: Record<string, string | number | boolean>;
}

export interface WorkflowProject {
  id: string;
  name: string;
  updatedAt: string;
  isStarred?: boolean;
  records: WorkflowHistoryRecord[];
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
  previewUrl?: string;
  recommendedModel: string;
  promptTemplate: string;
  negativePrompt?: string;
  tags: string[];
  variables?: SkillVariable[];
  suggestedParams?: Partial<GenerationParams>;
  isFavorite?: boolean;
  author?: string;
}
