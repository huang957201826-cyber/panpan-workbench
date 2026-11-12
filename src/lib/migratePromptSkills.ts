import type { PromptSkill, Skill, SkillSlot } from '../types'
import { normalizePromptSkills } from './promptSkills'
import { skillCoverColor } from './capabilitySkills'
import { useCapabilitySkillStore } from './capabilitySkillStore'
import { useSkillStore } from './skillStore'

function toSlots(skill: PromptSkill): SkillSlot[] {
  return (skill.variables ?? []).map((variable) => ({
    key: variable.key,
    label: variable.label,
    type: 'text',
    defaultValue: variable.defaultValue,
    options: variable.options,
    required: false,
  }))
}

/** 旧提示词库技能迁移到统一的技能模型；ID 加前缀避免冲突，重复执行不会重复写入 */
export function migratePromptSkills(): number {
  const legacy = normalizePromptSkills(useSkillStore.getState().skills)
  if (!legacy.length) return 0
  const addMine = useCapabilitySkillStore.getState().addMine
  const existing = new Set(useCapabilitySkillStore.getState().mine.map((skill) => skill.id))
  let migrated = 0
  for (const item of legacy) {
    const id = `prompt:${item.id}`
    if (existing.has(id)) continue
    const now = Date.now()
    const skill: Skill = {
      id,
      name: item.title,
      description: item.tags.length ? `旧提示词库 · ${item.tags.join(' / ')}` : '旧提示词库迁移',
      category: item.category || '提示词',
      coverColor: skillCoverColor(id),
      coverImageId: item.coverImageId,
      basePrompt: item.prompt,
      slots: toSlots(item),
      negativePrompt: item.negativePrompt,
      params: item.params,
      source: 'mine',
      favorite: item.favorite === true,
      version: 1,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
    addMine(skill)
    migrated += 1
  }
  useSkillStore.getState().replaceSkills([])
  return migrated
}
