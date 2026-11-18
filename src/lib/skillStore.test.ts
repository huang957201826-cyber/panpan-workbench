// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { saveNewSkill, useSkillStore } from './skillStore'

describe('技能存储', () => {
  beforeEach(() => {
    useSkillStore.getState().replaceSkills([])
  })

  it('saveNewSkill 会立即加入列表', () => {
    const skill = saveNewSkill({ title: 'TestSkill1750', prompt: 'interiorshowroom,warmlight' })
    const skills = useSkillStore.getState().skills
    expect(skills).toHaveLength(1)
    const found = skills.find((item) => item.id === skill.id)
    expect(found?.title).toBe('TestSkill1750')
    expect(found?.prompt).toBe('interiorshowroom,warmlight')
  })

  it('updateSkill 改标题与正文，removeSkill 能删掉', () => {
    const skill = saveNewSkill({ title: 'Before', prompt: 'old' })
    useSkillStore.getState().updateSkill(skill.id, { title: 'After', prompt: 'new' })
    const updated = useSkillStore.getState().skills.find((item) => item.id === skill.id)
    expect(updated?.title).toBe('After')
    expect(updated?.prompt).toBe('new')

    useSkillStore.getState().removeSkill(skill.id)
    expect(useSkillStore.getState().skills.some((item) => item.id === skill.id)).toBe(false)
  })
})
