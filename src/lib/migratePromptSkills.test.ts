import { beforeEach, describe, expect, it } from 'vitest'
import { composeSkillPrompt, defaultSkillValues } from './capabilitySkills'
import { createPromptSkill } from './promptSkills'
import { migratePromptSkills } from './migratePromptSkills'
import { useCapabilitySkillStore } from './capabilitySkillStore'
import { useSkillStore } from './skillStore'

describe('migratePromptSkills', () => {
  beforeEach(() => {
    useCapabilitySkillStore.setState({ mine: [], builtinOverrides: {} })
    useSkillStore.getState().replaceSkills([])
  })

  it('把旧提示词迁移成技能，并清空旧数据', () => {
    useSkillStore.getState().replaceSkills([
      createPromptSkill({
        title: '旧夜景配方',
        prompt: '夜景 {{主体}}，蓝调时刻',
        tags: ['夜景'],
        variables: [{ key: '主体', label: '主体', defaultValue: '建筑' }],
        favorite: true,
      }),
    ])

    expect(migratePromptSkills()).toBe(1)
    const [skill] = useCapabilitySkillStore.getState().mine
    expect(skill.id.startsWith('prompt:')).toBe(true)
    expect(skill.name).toBe('旧夜景配方')
    expect(skill.basePrompt).toContain('蓝调时刻')
    expect(skill.slots[0]).toMatchObject({ key: '主体', label: '主体', type: 'text' })
    expect(skill.favorite).toBe(true)
    expect(useSkillStore.getState().skills).toHaveLength(0)
    const prompt = composeSkillPrompt(skill, defaultSkillValues(skill), '')
    expect(prompt).not.toContain('{{')
    expect(prompt).toContain('夜景 建筑，蓝调时刻')
  })

  it('重复执行不会重复迁移', () => {
    useSkillStore.getState().replaceSkills([createPromptSkill({ title: 'a', prompt: 'b' })])
    expect(migratePromptSkills()).toBe(1)
    expect(migratePromptSkills()).toBe(0)
    expect(useCapabilitySkillStore.getState().mine).toHaveLength(1)
  })

  it('mine 已有同 id 时也清空旧数据', () => {
    const legacy = createPromptSkill({ title: '旧技能', prompt: '画面 {{主体}}' })
    useSkillStore.getState().replaceSkills([legacy])
    expect(migratePromptSkills()).toBe(1)
    useSkillStore.getState().replaceSkills([legacy])
    expect(migratePromptSkills()).toBe(0)
    expect(useCapabilitySkillStore.getState().mine).toHaveLength(1)
    expect(useSkillStore.getState().skills).toHaveLength(0)
  })
})
