// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPromptSkill } from './promptSkills'

beforeEach(() => {
  window.localStorage.clear()
  vi.resetModules()
})

describe('skillStore', () => {
  it('supports CRUD, pin and localStorage persistence', async () => {
    const { useSkillStore } = await import('./skillStore')
    const skill = createPromptSkill({ title: '夜景', prompt: 'prompt', tags: ['建筑'] }, 100)
    useSkillStore.getState().addSkill(skill)
    expect(useSkillStore.getState().skills).toHaveLength(1)

    useSkillStore.getState().updateSkill(skill.id, { title: '夜景 2' })
    expect(useSkillStore.getState().skills[0].title).toBe('夜景 2')

    useSkillStore.getState().togglePinned(skill.id)
    expect(useSkillStore.getState().skills[0].pinned).toBe(true)

    const stored = JSON.parse(window.localStorage.getItem('panpan-prompt-skills-v1')!)
    expect(stored.state.skills[0].title).toBe('夜景 2')

    useSkillStore.getState().removeSkill(skill.id)
    expect(useSkillStore.getState().skills).toEqual([])
  })

  it('restores persisted skills and empty library is valid', async () => {
    const { useSkillStore } = await import('./skillStore')
    expect(useSkillStore.getState().skills).toEqual([])

    const skill = createPromptSkill({ title: 'A', prompt: 'p' }, 100)
    window.localStorage.setItem('panpan-prompt-skills-v1', JSON.stringify({ state: { skills: [skill] }, version: 1 }))
    vi.resetModules()
    const reloaded = await import('./skillStore')
    expect(reloaded.useSkillStore.getState().skills[0].title).toBe('A')
  })
})
