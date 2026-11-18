import { normalizePromptSkills } from './promptSkills'
import { useSkillStore } from './skillStore'

/**
 * 兼容旧调用：提示词技能已由统一注册表直接读取，不再复制到能力技能存储。
 * 返回 0 表示没有发生写入迁移，重复调用不会产生重复技能。
 */
export function migratePromptSkills(): number {
  normalizePromptSkills(useSkillStore.getState().skills)
  return 0
}
