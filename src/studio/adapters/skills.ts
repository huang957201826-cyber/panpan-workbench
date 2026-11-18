import { loadSkillKit } from '../../lib/skillKit'

export interface AdapterSkillVariable {
  key: string
  label: string
  defaultValue: string
  options?: string[]
}

export interface AdapterSkill {
  id: string
  title: string
  category: string
  description: string
  prompt: string
  variables: AdapterSkillVariable[]
}

export type ApplySkillMode = 'copy' | 'append' | 'replace'

/** 读现有 27 条技能包 */
export async function listSkills(): Promise<AdapterSkill[]> {
  const kit = await loadSkillKit()
  return kit.skills.map((entry) => ({
    id: entry.key,
    title: entry.skill.name,
    category: entry.skill.category,
    description: entry.skill.purpose || entry.skill.notFor || entry.skill.category,
    prompt: entry.prompt.trim(),
    variables: entry.skill.inputs
      .filter((input) => input.type !== 'image' && input.type !== 'bool')
      .map((input) => ({
        key: input.k,
        label: input.label,
        defaultValue: input.options?.[0] ?? '',
        options: input.options,
      })),
  }))
}

/** 纯函数：复制 / 追加 / 替换 */
export function applySkill(target: string, text: string, mode: ApplySkillMode): string {
  if (mode === 'copy') return text
  if (mode === 'replace') return text
  return target.trim() ? `${target.trim()}，${text}` : text
}

/** `{变量}` 用传入值替换；未知占位保持原样 */
export function resolveVariables(text: string, values: Record<string, string>): string {
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match,
  )
}
