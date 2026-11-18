export interface ReferenceImage {
  id: string;
  url: string;
  name: string;
  tagNumber: number;
  weight: number;
  role: 'ref' | 'style' | 'structure';
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
  missingImageIds?: string[];
}

export interface WorkflowProject {
  id: string;
  name: string;
  updatedAt: string;
  isStarred?: boolean;
  records: WorkflowHistoryRecord[];
}
