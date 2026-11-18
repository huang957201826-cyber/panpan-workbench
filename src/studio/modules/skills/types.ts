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
  /** 分类键固定为字符串，界面用 categoryLabel 显示中文分类名 */
  category: string;
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
  /** 用户自建技能：可编辑、可删除；内置技能为 false */
  isCustom?: boolean;
  author?: string;
}
