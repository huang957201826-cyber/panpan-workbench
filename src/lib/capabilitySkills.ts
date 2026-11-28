import type { Skill, SkillSlot, SkillSlotValue } from '../types'
import { loadSkillKit, type SkillKitEntry, type SkillKitInput } from './skillKit'

const COVER_COLORS = [
  '#E8DCC8', '#D9E2D2', '#D8E0EA', '#E7D9DF', '#E3DDCF', '#D5E3DF',
  '#E9DCCB', '#DAD8E8', '#DCE5D8', '#E8D8D3', '#D7E1E7', '#E4DFD2',
]

export function skillCoverColor(id: string) {
  let hash = 0
  for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  return COVER_COLORS[hash % COVER_COLORS.length]
}

function isMultiImageInput(input: SkillKitInput) {
  return input.type === 'image' && /images|assets/i.test(input.k)
}

function toSlot(input: SkillKitInput): SkillSlot {
  const type = input.type === 'image'
    ? (isMultiImageInput(input) ? 'multi-image' : 'image')
    : input.type
  return {
    key: input.k,
    label: input.label,
    type,
    options: input.options,
    required: Boolean(input.required && input.type !== 'image'),
    defaultValue: type === 'multi'
      ? (input.options?.[0] ? [input.options[0]] : [])
      : type === 'multi-image'
        ? []
        : type === 'bool'
          ? false
          : type === 'enum'
            ? (input.options?.[0] ?? '')
            : '',
  }
}

export function toCapabilitySkill(entry: SkillKitEntry): Skill {
  const id = `builtin:${entry.key}`
  const imageInputs = entry.skill.inputs.filter((input) => input.type === 'image')
  return {
    id,
    name: entry.skill.name,
    description: entry.skill.purpose ?? `${entry.skill.category}技能`,
    category: entry.skill.category,
    tags: [],
    coverColor: skillCoverColor(id),
    basePrompt: entry.prompt.trim(),
    slots: entry.skill.inputs.map(toSlot),
    requiredImages: imageInputs.length
      ? imageInputs.map((input) => ({
          slotKey: input.k,
          min: input.required ? 1 : 0,
          max: isMultiImageInput(input) ? 6 : 1,
        }))
      : undefined,
    source: 'builtin',
    kind: 'capability',
    sourceId: id,
    version: 1,
    createdAt: 0,
    updatedAt: 0,
  }
}

export async function loadBuiltinSkills(): Promise<Skill[]> {
  const kit = await loadSkillKit()
  return kit.skills.map(toCapabilitySkill)
}

export function defaultSkillValues(skill: Skill): Record<string, SkillSlotValue> {
  return Object.fromEntries(skill.slots.map((slot) => [slot.key, slot.defaultValue ?? (slot.type === 'multi' || slot.type === 'multi-image' ? [] : '')]))
}

function hasValue(value: SkillSlotValue | undefined): boolean {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  return Boolean(String(value ?? '').trim())
}

export function validateSkillValues(skill: Skill, values: Record<string, SkillSlotValue>): string[] {
  const errors: string[] = []
  for (const slot of skill.slots) {
    if (!slot.required) continue
    if (!hasValue(values[slot.key])) {
      errors.push(
        slot.type === 'image' || slot.type === 'multi-image'
          ? `请上传「${slot.label}」`
          : `请填写「${slot.label}」`,
      )
    }
  }
  return errors
}

function getSlotImageIds(value: SkillSlotValue | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function displayValue(slot: SkillSlot, value: SkillSlotValue | undefined): string {
  if (slot.type === 'bool') return value ? '是' : '否'
  if (slot.type === 'image' || slot.type === 'multi-image') return hasValue(value) ? '已附参考图' : ''
  if (Array.isArray(value)) return value.join('、')
  return String(value ?? '').trim()
}

/** 技能基座里的 {{key}} / {key} / {{label}} / {label} 用本次输入或槽位默认值展开 */
function fillBasePrompt(skill: Skill, values: Record<string, SkillSlotValue>): string {
  let prompt = skill.basePrompt
  for (const slot of skill.slots) {
    const value = displayValue(slot, values[slot.key] ?? slot.defaultValue)
    prompt = prompt.split(`{{${slot.key}}}`).join(value)
    prompt = prompt.split(`{${slot.key}}`).join(value)
    if (slot.label && slot.label !== slot.key) {
      prompt = prompt.split(`{{${slot.label}}}`).join(value)
      prompt = prompt.split(`{${slot.label}}`).join(value)
    }
  }
  return prompt.trim()
}

/** 合并顺序：技能基座（先展开占位符） → 本次输入槽位 → 用户补充；用户文字永远在最后 */
export function composeSkillPrompt(skill: Skill, values: Record<string, SkillSlotValue>, userPrompt: string): string {
  const totalAttachedImages = skill.slots
    .filter((slot) => slot.type === 'image' || slot.type === 'multi-image')
    .reduce((sum, slot) => sum + getSlotImageIds(values[slot.key]).length, 0)
  let imageCursor = 0

  const lines = skill.slots
    .map((slot) => {
      if (slot.type === 'image' || slot.type === 'multi-image') {
        const ids = getSlotImageIds(values[slot.key])
        if (!ids.length) return ''
        if (totalAttachedImages <= 1) {
          imageCursor += ids.length
          return `- ${slot.label}（${slot.key}）：已附参考图`
        }
        const refs = ids.map(() => `@图${++imageCursor}`).join('、')
        return `- ${slot.label}（${slot.key}）：已附参考图（对应 ${refs}）`
      }
      const value = displayValue(slot, values[slot.key])
      return value ? `- ${slot.label}（${slot.key}）：${value}` : ''
    })
    .filter(Boolean)
  const parts = [fillBasePrompt(skill, values)]
  if (lines.length) parts.push(`【本次输入】\n${lines.join('\n')}`)
  const user = userPrompt.trim()
  if (user) parts.push(`【用户补充】\n${user}`)
  return parts.join('\n\n')
}

function mapRatioTokenToSize(token: string): string | undefined {
  const text = token.trim().toLowerCase()
  if (!text) return undefined
  if (/^(1024x1024|1536x1024|1024x1536|auto)$/.test(text)) return text
  if (text.includes('1:1') || text.includes('方图') || text.includes('正方形')) {
    return '1024x1024'
  }
  if (
    text.includes('16:9') ||
    text.includes('4:3') ||
    text.includes('3:2') ||
    text.includes('21:9') ||
    text.includes('横版') ||
    text.includes('横图') ||
    text.includes('左右并排')
  ) {
    return '1536x1024'
  }
  if (
    text.includes('9:16') ||
    text.includes('3:4') ||
    text.includes('2:3') ||
    text.includes('4:5') ||
    text.includes('竖版') ||
    text.includes('竖图') ||
    text.includes('上下对比')
  ) {
    return '1024x1536'
  }
  return undefined
}

/** 从技能槽位（ratio / ratios / size / layout）解析应同步到工作台的尺寸与张数参数 */
export function resolveSkillParamPatch(
  skill: Skill,
  values: Record<string, SkillSlotValue>,
): { size?: string; count?: number } {
  const patch: { size?: string; count?: number } = {}
  if (skill.params?.size) patch.size = skill.params.size
  if (typeof skill.params?.n === 'number' && skill.params.n > 0) {
    patch.count = skill.params.n
  }

  const ratioCandidates = ['ratio', 'ratios', 'size', 'layout', 'aspect_ratio']
  for (const key of ratioCandidates) {
    const raw = values[key] ?? skill.slots.find((slot) => slot.key === key)?.defaultValue
    const token = Array.isArray(raw) ? (raw[0] ?? '') : typeof raw === 'string' ? raw : ''
    const mapped = mapRatioTokenToSize(token)
    if (mapped) {
      patch.size = mapped
      break
    }
  }
  return patch
}

/** 图片槽里的 imageId，用于保留封面/参考图资源 */
export function skillSlotImageIds(skill: Skill, values: Record<string, SkillSlotValue>): string[] {
  return skill.slots
    .filter((slot) => slot.type === 'image' || slot.type === 'multi-image')
    .flatMap((slot) => {
      const value = values[slot.key]
      return Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []
    })
}
