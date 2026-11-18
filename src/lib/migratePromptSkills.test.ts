import { beforeEach, describe, expect, it } from 'vitest'
import { useCapabilitySkillStore } from './capabilitySkillStore'
import { createPromptSkill } from './promptSkills'
import { useSkillStore } from './skillStore'
import { migratePromptSkills } from './migratePromptSkills'

describe('migratePromptSkills', () => {
  beforeEach(() => {
    useSkillStore.getState().replaceSkills([])
    useCapabilitySkillStore.getState().replaceMine([])
  })

  it('does not duplicate prompt skills into the capability store', () => {
    useSkillStore.getState().replaceSkills([
      createPromptSkill({ title: '旧提示词', prompt: 'prompt body' }),
    ])

    expect(migratePromptSkills()).toBe(0)
    expect(migratePromptSkills()).toBe(0)
    expect(useCapabilitySkillStore.getState().mine).toEqual([])
    expect(useSkillStore.getState().skills).toHaveLength(1)
  })
})
