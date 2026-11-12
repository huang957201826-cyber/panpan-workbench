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
    required: false,
    defaultValue: type === 'multi' || type === 'multi-image'
      ? []
      : type === 'bool'
        ? false
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
    if (slot.type === 'image' || slot.type === 'multi-image') continue
    if (slot.required && !hasValue(values[slot.key])) errors.push(`请填写「${slot.label}」`)
  }
  return errors
}

function displayValue(slot: SkillSlot, value: SkillSlotValue | undefined): string {
  if (slot.type === 'bool') return value ? '是' : '否'
  if (slot.type === 'image' || slot.type === 'multi-image') return hasValue(value) ? '已附参考图' : ''
  if (Array.isArray(value)) return value.join('、')
  return String(value ?? '').trim()
}

/** 技能基座里的 {{key}} / {{label}} 用本次输入或槽位默认值展开 */
function fillBasePrompt(skill: Skill, values: Record<string, SkillSlotValue>): string {
  let prompt = skill.basePrompt
  for (const slot of skill.slots) {
    const value = displayValue(slot, values[slot.key] ?? slot.defaultValue)
    prompt = prompt.split(`{{${slot.key}}}`).join(value)
    if (slot.label && slot.label !== slot.key) prompt = prompt.split(`{{${slot.label}}}`).join(value)
  }
  return prompt.trim()
}

/** 合并顺序：技能基座（先展开占位符） → 本次输入槽位 → 用户补充；用户文字永远在最后 */
export function composeSkillPrompt(skill: Skill, values: Record<string, SkillSlotValue>, userPrompt: string): string {
  const lines = skill.slots
    .map((slot) => {
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

/** 图片槽里的 imageId，用于保留封面/参考图资源 */
export function skillSlotImageIds(skill: Skill, values: Record<string, SkillSlotValue>): string[] {
  return skill.slots
    .filter((slot) => slot.type === 'image' || slot.type === 'multi-image')
    .flatMap((slot) => {
      const value = values[slot.key]
      return Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []
    })
}
