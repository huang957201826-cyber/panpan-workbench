import { beforeEach, describe, expect, it } from 'vitest'
import type { Skill, SkillKind } from '../types'
import { useCapabilitySkillStore } from './capabilitySkillStore'
import { useSkillStore } from './skillStore'
import { createImageRestoreMap, remapImageIdsDeep } from './imageRestore'
import {
  buildRegisteredSkillCatalog,
  composeRegisteredSkill,
  getRegisteredSkillSnapshot,
  registeredSkillMetadata,
  registerSkillKindModule,
  removeRegisteredSkill,
  replaceRegisteredSkillBackup,
  resolveRegisteredSkill,
  savePromptSkill,
  toggleRegisteredSkillFavorite,
  updateRegisteredSkill,
} from './skillRegistry'
import { promptSkillToCapabilitySkill } from './promptSkillAdapter'

function capability(id: string, name = id): Skill {
  return {
    id,
    name,
    description: '',
    category: '我的',
    coverColor: '#fff',
    basePrompt: name,
    slots: [],
    source: 'mine',
    kind: 'capability',
    version: 1,
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('skill registry', () => {
  beforeEach(() => {
    useSkillStore.getState().replaceSkills([])
    useCapabilitySkillStore.getState().replaceMine([])
    useCapabilitySkillStore.getState().replaceOverrides({})
  })

  it('keeps prompt and capability identities unique even when source IDs and names collide', () => {
    const prompt = savePromptSkill({ title: '同名技能', prompt: 'prompt body' })
    const duplicatePrompt = { ...prompt, id: 'shared-id' }
    useSkillStore.getState().replaceSkills([duplicatePrompt])
    const duplicateCapability = capability('shared-id', '同名技能')

    const catalog = buildRegisteredSkillCatalog({
      promptSkills: [duplicatePrompt],
      capabilitySkills: [duplicateCapability],
    })

    expect(catalog.map((skill) => skill.registryId).sort()).toEqual([
      'capability:shared-id',
      'prompt:shared-id',
    ])
    expect(resolveRegisteredSkill(catalog, 'shared-id')?.kind).toBe('prompt')
    expect(resolveRegisteredSkill(catalog, 'capability:shared-id')?.name).toBe('同名技能')
  })

  it('filters old prompt: mirrors even after the source prompt is gone', () => {
    const prompt = { ...savePromptSkill({ title: '旧提示词', prompt: 'body' }), id: 'legacy-prompt' }
    useSkillStore.getState().replaceSkills([prompt])
    const mirror = {
      ...promptSkillToCapabilitySkill(prompt),
      id: 'prompt:legacy-prompt',
      kind: 'capability' as const,
    }
    useCapabilitySkillStore.getState().replaceMine([mirror])

    const catalog = buildRegisteredSkillCatalog(getRegisteredSkillSnapshot())

    expect(catalog.map((skill) => skill.registryId)).toEqual(['prompt:legacy-prompt'])
    expect(getRegisteredSkillSnapshot().capabilitySkills).toEqual([])

    removeRegisteredSkill('prompt:legacy-prompt')
    expect(buildRegisteredSkillCatalog(getRegisteredSkillSnapshot())).toEqual([])
    expect(useCapabilitySkillStore.getState().mine).toEqual([])

    useCapabilitySkillStore.getState().replaceMine([mirror])
    replaceRegisteredSkillBackup({ capabilitySkills: getRegisteredSkillSnapshot().capabilitySkills })
    expect(useCapabilitySkillStore.getState().mine).toEqual([])
    expect(buildRegisteredSkillCatalog(getRegisteredSkillSnapshot())).toEqual([])
  })

  it('routes updates and favorites by the registry identity', () => {
    const prompt = { ...savePromptSkill({ title: '提示词', prompt: 'body' }), id: 'prompt-source' }
    const capabilitySkill = capability('capability-source')
    useSkillStore.getState().replaceSkills([prompt])
    useCapabilitySkillStore.getState().replaceMine([capabilitySkill])

    updateRegisteredSkill('prompt:prompt-source', {
      name: '更新提示词',
      description: '新说明',
      basePrompt: '新正文',
    })
    toggleRegisteredSkillFavorite('capability:capability-source')

    expect(useSkillStore.getState().skills[0]).toMatchObject({
      id: 'prompt-source',
      title: '更新提示词',
      prompt: '新正文',
      tags: ['desc:新说明'],
    })
    expect(useCapabilitySkillStore.getState().mine[0].favorite).toBe(true)
  })

  it('returns registry metadata without embedding prompt contents', () => {
    const skill = { ...capability('metadata'), basePrompt: 'secret prompt body' }
    const metadata = registeredSkillMetadata(skill)

    expect(metadata).toMatchObject({ id: 'capability:metadata', kind: 'capability', promptLength: 18 })
    expect(metadata).not.toHaveProperty('basePrompt')
    expect(JSON.stringify(metadata)).not.toContain('secret prompt body')
  })

  it('preserves canonical activeSkill identity and remapped cover/reference images', () => {
    const prompt = {
      ...savePromptSkill({ title: '提示词', prompt: 'body', coverImageId: 'old-image' }),
      id: 'shared',
    }
    const capabilitySkill = {
      ...capability('shared'),
      coverImageId: 'old-image',
      referenceImageIds: ['old-image'],
    }
    const remap = createImageRestoreMap(['old-image'], 'skill-restore')
    const catalog = buildRegisteredSkillCatalog({
      promptSkills: remapImageIdsDeep([prompt], remap),
      capabilitySkills: remapImageIdsDeep([capabilitySkill], remap),
    })

    expect(resolveRegisteredSkill(catalog, 'prompt:shared')?.coverImageId).toBe('restore-image-skill-restore-1')
    expect(resolveRegisteredSkill(catalog, 'capability:shared')).toMatchObject({
      coverImageId: 'restore-image-skill-restore-1',
      referenceImageIds: ['restore-image-skill-restore-1'],
    })
  })

  it('supports a new skill kind through a type module', () => {
    registerSkillKindModule({
      kind: 'test-storyboard',
      compose: () => 'storyboard prompt',
      validate: () => [],
    })
    const skill = {
      ...capability('storyboard'),
      kind: 'test-storyboard' as unknown as SkillKind,
    }

    expect(composeRegisteredSkill(skill, {}, '')).toBe('storyboard prompt')
  })
})
