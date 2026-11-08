import { describe, expect, it } from 'vitest'

import type { ExportData, PromptSkill, StoredImage } from '../types'
import { DEFAULT_SETTINGS } from './apiProfiles'
import {
  buildExportZip,
  collectSkillCoverImageIds,
  mergeImportedSkills,
  readExportZip,
  serializeSkillsForExport,
  type BuildExportZipParams,
} from './exportZip'

const NOW = 1700000001000

function makeSkill(overrides: Partial<PromptSkill> & { id: string }): PromptSkill {
  const base: PromptSkill = {
    id: overrides.id,
    title: '技能',
    prompt: '正向提示词',
    tags: ['标签'],
    createdAt: NOW,
    updatedAt: NOW,
  }
  return { ...base, ...overrides }
}

function makeParams(overrides: Partial<BuildExportZipParams> = {}): BuildExportZipParams {
  return {
    options: { exportConfig: true, exportTasks: true },
    exportedAt: NOW,
    settings: DEFAULT_SETTINGS,
    tasks: [],
    images: [],
    thumbnailsByImageId: new Map(),
    favoriteCollections: [],
    defaultFavoriteCollectionId: null,
    agentConversations: [],
    ...overrides,
  }
}

describe('exportZip skills', () => {
  it('round-trips skills through a v4 zip and restores the full count into an empty library', async () => {
    const skills = [
      makeSkill({
        id: 's1',
        title: '夜景',
        prompt: '提示词 {{city}}',
        variables: [{ key: 'city', label: '城市', defaultValue: '上海' }],
        negativePrompt: '不要文字',
        coverImageId: 'cover-1',
        author: 'me',
        usageCount: 3,
        favorite: true,
        pinned: true,
        category: '摄影',
      }),
      makeSkill({ id: 's2', title: '人像' }),
      makeSkill({ id: 's3', title: '风景' }),
    ]
    const { bytes } = await buildExportZip(makeParams({ skills }))
    const manifest = (await readExportZip(bytes)).manifest

    expect(manifest.version).toBe(4)
    expect(manifest.skills).toHaveLength(skills.length)

    const restored = mergeImportedSkills([], manifest.skills)
    expect(restored).toHaveLength(skills.length)
    expect(restored.map((skill) => skill.id).sort()).toEqual(['s1', 's2', 's3'])
    expect(restored.find((skill) => skill.id === 's1')).toMatchObject({
      title: '夜景',
      prompt: '提示词 {{city}}',
      negativePrompt: '不要文字',
      author: 'me',
      usageCount: 3,
      coverImageId: 'cover-1',
      favorite: true,
      pinned: true,
      category: '摄影',
    })
    expect(restored.find((skill) => skill.id === 's1')?.variables?.[0].defaultValue).toBe('上海')
  })

  it('keeps legacy v4 zips without the skills field completely unchanged', async () => {
    const { bytes } = await buildExportZip(makeParams())
    const manifest = (await readExportZip(bytes)).manifest
    expect(manifest.version).toBe(4)
    expect(manifest.skills).toBeUndefined()

    const legacy = { version: 4, exportedAt: new Date(NOW).toISOString() } as ExportData
    expect(Array.isArray(legacy.skills)).toBe(false)
    const existing = [makeSkill({ id: 'keep', title: '保留' })]
    expect(mergeImportedSkills(existing, legacy.skills)).toBe(existing)
  })

  it('overwrites same-id skills, appends new ids and never produces duplicate ids', () => {
    const existing = [makeSkill({ id: 'a', title: '旧标题' }), makeSkill({ id: 'b', title: '保留' })]
    const incoming = [makeSkill({ id: 'a', title: '新标题' }), makeSkill({ id: 'c', title: '新增' })]

    const merged = mergeImportedSkills(existing, incoming)
    expect(merged.map((skill) => skill.id).sort()).toEqual(['a', 'b', 'c'])
    expect(new Set(merged.map((skill) => skill.id)).size).toBe(merged.length)
    expect(merged.find((skill) => skill.id === 'a')?.title).toBe('新标题')
    expect(merged.find((skill) => skill.id === 'b')?.title).toBe('保留')

    // 导入数据内部重复 ID 也去重，且仍以首条为准
    const duplicated = mergeImportedSkills(existing, [
      ...incoming,
      makeSkill({ id: 'a', title: '重复' }),
      makeSkill({ id: 'c', title: '重复2' }),
    ])
    expect(new Set(duplicated.map((skill) => skill.id)).size).toBe(3)
    expect(duplicated.find((skill) => skill.id === 'a')?.title).toBe('新标题')
  })

  it('scrubs apiKey-shaped fields and normalizes prompt, negative prompt and variable defaults', () => {
    const withKey = {
      ...makeSkill({
        id: 'd',
        prompt: '  hello  ',
        negativePrompt: '  no text  ',
        variables: [{ key: 'k', label: 'K', defaultValue: '值' }],
      }),
      apiKey: 'sk-secret',
    } as PromptSkill

    const serialized = serializeSkillsForExport([withKey])
    expect(serialized).toHaveLength(1)
    expect(serialized[0]).not.toHaveProperty('apiKey')
    expect(serialized[0].prompt).toBe('hello')
    expect(serialized[0].negativePrompt).toBe('no text')
    expect(serialized[0].variables?.[0].defaultValue).toBe('值')
  })

  it('packages skill cover images through the existing imageFiles logic without duplicating them', async () => {
    const images: StoredImage[] = [
      { id: 'cover-1', dataUrl: 'data:image/png;base64,AAECAw==', source: 'generated' },
      { id: 'task-img', dataUrl: 'data:image/png;base64,BAUGBw==', source: 'generated' },
    ]
    const skills = [
      makeSkill({ id: 's1', coverImageId: 'cover-1' }),
      makeSkill({ id: 's2', coverImageId: 'cover-1' }),
      makeSkill({ id: 's3' }),
    ]

    // 封面 id 去重后并入待打包集合，已在集合中的图片不会被重复打包
    expect(collectSkillCoverImageIds(skills)).toEqual(['cover-1'])
    const imageIds = [...new Set([...images.map((image) => image.id), ...collectSkillCoverImageIds(skills)])]
    expect(imageIds).toEqual(['cover-1', 'task-img'])

    const { bytes } = await buildExportZip(makeParams({ skills, images }))
    const manifest = (await readExportZip(bytes)).manifest
    expect(manifest.imageFiles?.['cover-1']).toBeDefined()
    expect(Object.keys(manifest.imageFiles ?? {})).toEqual(['cover-1', 'task-img'])
    expect(manifest.skills?.find((skill) => skill.id === 's1')?.coverImageId).toBe('cover-1')
  })

  it('writes skills only into the base manifest part of a multipart export', async () => {
    const skills = [makeSkill({ id: 's1' })]
    const base = (await buildExportZip(makeParams({ skills }))).manifest
    const page = (await buildExportZip(makeParams({ skills, includeManifestData: false }))).manifest
    expect(base.version).toBe(4)
    expect(page.version).toBe(4)
    expect(base.skills).toHaveLength(1)
    expect(page.skills).toBeUndefined()
  })
})
