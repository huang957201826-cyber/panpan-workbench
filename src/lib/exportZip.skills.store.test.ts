// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from './apiProfiles'
import { buildExportZip, mergeImportedSkills, readExportZip } from './exportZip'
import { createPromptSkill } from './promptSkills'
import { useSkillStore } from './skillStore'

beforeEach(() => {
  window.localStorage.clear()
  useSkillStore.getState().replaceSkills([])
})

describe('skill library zip round trip with the persisted store', () => {
  it('exports the persisted library and restores the full count into an empty library', async () => {
    const skills = [
      createPromptSkill({ title: '配方一', prompt: '提示词一', tags: ['a'] }, 1700000000000),
      createPromptSkill({ title: '配方二', prompt: '提示词二', coverImageId: 'cover' }, 1700000000001),
    ]
    useSkillStore.getState().replaceSkills(skills)
    expect(useSkillStore.getState().skills).toHaveLength(2)

    const { bytes } = await buildExportZip({
      options: { exportConfig: true, exportTasks: true },
      exportedAt: 1700000001000,
      settings: DEFAULT_SETTINGS,
      skills: useSkillStore.getState().skills,
      tasks: [],
      images: [],
      thumbnailsByImageId: new Map(),
      favoriteCollections: [],
      defaultFavoriteCollectionId: null,
      agentConversations: [],
    })
    const manifest = (await readExportZip(bytes)).manifest
    expect(manifest.version).toBe(4)
    expect(manifest.skills).toHaveLength(2)

    // 模拟换机 / 清 WebView 数据后的空库
    useSkillStore.getState().replaceSkills([])
    expect(useSkillStore.getState().skills).toEqual([])

    useSkillStore.getState().replaceSkills(
      mergeImportedSkills(useSkillStore.getState().skills, manifest.skills),
    )
    expect(useSkillStore.getState().skills).toHaveLength(2)
    expect(useSkillStore.getState().skills.map((skill) => skill.title).sort()).toEqual(['配方一', '配方二'])
    expect(window.localStorage.getItem('panpan-prompt-skills-v1')).toBeTruthy()
    expect(JSON.parse(window.localStorage.getItem('panpan-prompt-skills-v1')!).state.skills).toHaveLength(2)
  })

  it('does not clear existing skills that are absent from the backup', async () => {
    const backedUp = [createPromptSkill({ title: '备份技能', prompt: 'remote' }, 1700000000000)]
    const { bytes } = await buildExportZip({
      options: { exportConfig: true },
      exportedAt: 1700000001000,
      settings: DEFAULT_SETTINGS,
      skills: backedUp,
      tasks: [],
      images: [],
      thumbnailsByImageId: new Map(),
      favoriteCollections: [],
      defaultFavoriteCollectionId: null,
      agentConversations: [],
    })
    const manifest = (await readExportZip(bytes)).manifest

    const local = createPromptSkill({ title: '本机自建', prompt: 'local' }, 1700000000002)
    useSkillStore.getState().replaceSkills([local])
    useSkillStore.getState().replaceSkills(
      mergeImportedSkills(useSkillStore.getState().skills, manifest.skills),
    )

    expect(useSkillStore.getState().skills).toHaveLength(2)
    expect(useSkillStore.getState().skills.map((skill) => skill.title)).toContain('本机自建')
    expect(useSkillStore.getState().skills.map((skill) => skill.title)).toContain('备份技能')
  })

  it('leaves the library untouched when importing a legacy zip without the skills field', () => {
    const existing = createPromptSkill({ title: '已有技能', prompt: 'p' }, 1700000000000)
    useSkillStore.getState().replaceSkills([existing])

    const legacy = { version: 4, exportedAt: new Date(1700000001000).toISOString() }
    expect('skills' in legacy).toBe(false)
    expect(mergeImportedSkills(useSkillStore.getState().skills, undefined)).toBe(useSkillStore.getState().skills)
    expect(useSkillStore.getState().skills).toEqual([existing])
  })
})
