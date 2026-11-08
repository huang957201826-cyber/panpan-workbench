import type { PromptSkill, PromptSkillParams, SkillVariable, TaskParams, TaskRecord } from '../types'
import { normalizeSkillCategory, type SkillCategory } from './skillCategories'

export type SkillSort = 'recent' | 'pinned' | 'title'

export type SkillScope = 'all' | 'favorite' | 'pinned' | 'used'

export interface SkillFilter {
  query?: string
  /** 精确匹配数据里的原分类（历史行为，保持不变） */
  category?: string
  /** 按枚举归并后的分类组匹配，用于 UI 的双轴筛选 */
  categoryGroup?: SkillCategory
  tag?: string
  sort?: SkillSort
  favorite?: boolean
  scope?: SkillScope
  model?: string
}

/** 旧数据里的自由文本分类在视图层归并成枚举，持久化值不动 */
export function skillCategoryOf(skill: PromptSkill): SkillCategory {
  return normalizeSkillCategory(skill.category).category ?? '其他'
}

/** 参数槽归一化：去重、限制数量、去掉 {{ }} 包裹，脏数据不会让 UI 崩 */
export function normalizeSkillVariables(value: unknown): SkillVariable[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const variables: SkillVariable[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const record = item as Record<string, unknown>
    const key = typeof record.key === 'string' ? record.key.trim().replace(/^\{\{|\}\}$/g, '') : ''
    if (!key || seen.has(key)) continue
    seen.add(key)
    const label = typeof record.label === 'string' && record.label.trim() ? record.label.trim().slice(0, 40) : key
    const defaultValue = typeof record.defaultValue === 'string' ? record.defaultValue : ''
    const options = Array.isArray(record.options)
      ? [...new Set(record.options.filter((option): option is string => typeof option === 'string').map((option) => option.trim()).filter(Boolean))].slice(0, 12)
      : []
    variables.push({ key, label, defaultValue, ...(options.length ? { options } : {}) })
    if (variables.length >= 12) break
  }
  return variables
}

/** 参数槽默认值，供详情弹窗初始化与一键调用复用 */
export function defaultSkillVariableValues(skill: PromptSkill): Record<string, string> {
  return Object.fromEntries((skill.variables ?? []).map((variable) => [variable.key, variable.defaultValue]))
}

/**
 * 把 {{key}} / {{label}} 替换成实际值。负向提示词只在技能库内部合成后拼到 prompt 尾部，
 * 不引入新的供应商参数，避免牵动 API 适配、导出与 ZIP 备份。
 */
export function composeSkillPrompt(skill: PromptSkill, overrides: Record<string, string> = {}): string {
  let prompt = skill.prompt
  for (const variable of skill.variables ?? []) {
    const value = overrides[variable.key] ?? variable.defaultValue
    prompt = prompt.split(`{{${variable.key}}}`).join(value)
    if (variable.label && variable.label !== variable.key) {
      prompt = prompt.split(`{{${variable.label}}}`).join(value)
    }
  }
  const negative = skill.negativePrompt?.trim()
  return negative ? `${prompt.trim()}\n\nNegative prompt: ${negative}` : prompt.trim()
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean))]
}

export function normalizeSkillParams(value: unknown): PromptSkillParams | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const params: PromptSkillParams = {}
  if (typeof record.size === 'string' && record.size.trim()) params.size = record.size.trim()
  if (typeof record.quality === 'string' && record.quality.trim()) params.quality = record.quality.trim()
  if (typeof record.model === 'string' && record.model.trim()) params.model = record.model.trim()
  if (typeof record.n === 'number' && Number.isFinite(record.n) && record.n > 0) params.n = Math.max(1, Math.round(record.n))
  return Object.keys(params).length ? params : undefined
}

export function normalizePromptSkill(value: unknown): PromptSkill | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || !record.id) return null
  if (typeof record.prompt !== 'string' || !record.prompt.trim()) return null
  const now = Date.now()
  const createdAt = typeof record.createdAt === 'number' && Number.isFinite(record.createdAt) ? record.createdAt : now
  return {
    id: record.id,
    title: typeof record.title === 'string' && record.title.trim() ? record.title.trim().slice(0, 80) : '未命名技能',
    prompt: record.prompt.trim(),
    tags: cleanTags(record.tags),
    ...(typeof record.category === 'string' && record.category.trim() ? { category: record.category.trim().slice(0, 40) } : {}),
    ...(normalizeSkillParams(record.params) ? { params: normalizeSkillParams(record.params) } : {}),
    ...(typeof record.sourceTaskId === 'string' && record.sourceTaskId ? { sourceTaskId: record.sourceTaskId } : {}),
    ...(record.pinned === true ? { pinned: true } : {}),
    ...(record.favorite === true ? { favorite: true } : {}),
    ...(typeof record.coverImageId === 'string' && record.coverImageId.trim() ? { coverImageId: record.coverImageId.trim() } : {}),
    ...(normalizeSkillVariables(record.variables).length ? { variables: normalizeSkillVariables(record.variables) } : {}),
    ...(typeof record.negativePrompt === 'string' && record.negativePrompt.trim() ? { negativePrompt: record.negativePrompt.trim().slice(0, 600) } : {}),
    ...(typeof record.usageCount === 'number' && Number.isFinite(record.usageCount) && record.usageCount > 0 ? { usageCount: Math.round(record.usageCount) } : {}),
    ...(typeof record.author === 'string' && record.author.trim() ? { author: record.author.trim().slice(0, 40) } : {}),
    createdAt,
    updatedAt: typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt) ? record.updatedAt : createdAt,
  }
}

export function normalizePromptSkills(value: unknown): PromptSkill[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const skills: PromptSkill[] = []
  for (const item of value) {
    const skill = normalizePromptSkill(item)
    if (!skill || seen.has(skill.id)) continue
    seen.add(skill.id)
    skills.push(skill)
  }
  return skills
}

export interface SkillSeed {
  title?: string
  prompt?: string
  tags?: string[]
  category?: string
  params?: PromptSkillParams
  sourceTaskId?: string
  coverImageId?: string
  favorite?: boolean
  variables?: SkillVariable[]
  negativePrompt?: string
  author?: string
}

export function createPromptSkill(seed: SkillSeed, now = Date.now()): PromptSkill {
  const prompt = seed.prompt?.trim() ?? ''
  return {
    id: crypto.randomUUID(),
    title: seed.title?.trim().slice(0, 80) || '未命名技能',
    prompt,
    tags: cleanTags(seed.tags),
    ...(seed.category?.trim() ? { category: seed.category.trim().slice(0, 40) } : {}),
    ...(normalizeSkillParams(seed.params) ? { params: normalizeSkillParams(seed.params) } : {}),
    ...(seed.sourceTaskId ? { sourceTaskId: seed.sourceTaskId } : {}),
    ...(seed.coverImageId?.trim() ? { coverImageId: seed.coverImageId.trim() } : {}),
    ...(seed.favorite === true ? { favorite: true } : {}),
    ...(normalizeSkillVariables(seed.variables).length ? { variables: normalizeSkillVariables(seed.variables) } : {}),
    ...(seed.negativePrompt?.trim() ? { negativePrompt: seed.negativePrompt.trim().slice(0, 600) } : {}),
    ...(seed.author?.trim() ? { author: seed.author.trim().slice(0, 40) } : {}),
    createdAt: now,
    updatedAt: now,
  }
}

export function skillParamsFromTask(task: TaskRecord): PromptSkillParams {
  return {
    size: task.params.size,
    quality: task.params.quality,
    ...(task.apiModel ? { model: task.apiModel } : {}),
    n: task.params.n,
  }
}

export function skillFromTask(task: TaskRecord, now = Date.now()) {
  const firstLine = task.prompt.trim().split(/\r?\n/)[0]?.trim() ?? ''
  return createPromptSkill({
    title: firstLine.slice(0, 40) || '任务提示词',
    prompt: task.prompt,
    params: skillParamsFromTask(task),
    sourceTaskId: task.id,
    ...(task.outputImages[0] ? { coverImageId: task.outputImages[0] } : {}),
  }, now)
}

export function filterPromptSkills(skills: PromptSkill[], filter: SkillFilter = {}) {
  const query = filter.query?.trim().toLowerCase() ?? ''
  const filtered = skills.filter((skill) => {
    if (filter.category && skill.category !== filter.category) return false
    if (filter.categoryGroup && skillCategoryOf(skill) !== filter.categoryGroup) return false
    if (filter.tag && !skill.tags.includes(filter.tag)) return false
    if (filter.favorite && !skill.favorite) return false
    if (filter.scope === 'favorite' && !skill.favorite) return false
    if (filter.scope === 'pinned' && !skill.pinned) return false
    if (filter.scope === 'used' && !(skill.usageCount && skill.usageCount > 0)) return false
    if (filter.model && skill.params?.model !== filter.model) return false
    if (query) {
      const haystack = `${skill.title} ${skill.prompt} ${skill.tags.join(' ')} ${skill.category ?? ''}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
  const sort = filter.sort ?? 'recent'
  return filtered.sort((a, b) => {
    if (sort === 'pinned') {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    }
    if (sort === 'title') return a.title.localeCompare(b.title, 'zh-CN')
    return b.updatedAt - a.updatedAt
  })
}

export function skillParamPatch(skill: PromptSkill): Partial<TaskParams> {
  const params: Partial<TaskParams> = {}
  if (skill.params?.size) params.size = skill.params.size
  if (skill.params?.quality) params.quality = skill.params.quality as TaskParams['quality']
  if (skill.params?.n) params.n = skill.params.n
  return params
}
