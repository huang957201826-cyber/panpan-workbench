import type { PromptSkill, Skill, SkillSlot } from '../types'

/**
 * 把提示词技能包成能力技能，供「选用技能」、技能胶囊和生成链路共用。
 * 提示词技能用单花括号占位，能力技能只认双花括号，这里统一。
 */
export function promptSkillToCapabilitySkill(skill: PromptSkill): Skill {
  const description = skill.tags.find((tag) => tag.startsWith('desc:'))?.slice(5)
  const variables = skill.variables ?? []
  const basePrompt = variables.reduce(
    (prompt, variable) => prompt.split(`{${variable.key}}`).join(`{{${variable.key}}}`),
    skill.prompt,
  )
  return {
    id: skill.id,
    name: skill.title,
    description: description || '自定义提示词技能',
    category: skill.category || '我的技能',
    tags: skill.tags.filter((tag) => !tag.startsWith('desc:')),
    coverColor: '#E8DCC8',
    coverImageId: skill.coverImageId,
    basePrompt,
    negativePrompt: skill.negativePrompt,
    slots: variables.map((variable) => ({
      key: variable.key,
      label: variable.label,
      type: (variable.options?.length ? 'enum' : 'text') as SkillSlot['type'],
      defaultValue: variable.defaultValue,
      options: variable.options,
    })),
    source: 'mine',
    kind: 'prompt',
    sourceId: skill.id,
    author: skill.author,
    favorite: skill.favorite === true,
    version: 1,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  }
}
