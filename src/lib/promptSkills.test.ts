import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type TaskRecord } from '../types'
import { composeSkillPrompt, createPromptSkill, defaultSkillVariableValues, filterPromptSkills, normalizePromptSkill, skillCategoryOf, skillFromTask, skillParamPatch } from './promptSkills'

function task(patch: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-a',
    prompt: '商业空间夜景\n细节',
    params: { ...DEFAULT_PARAMS, size: '1280x720', quality: 'high', n: 2 },
    apiModel: 'gpt-image-2.5',
    inputImageIds: [],
    outputImages: [],
    status: 'done',
    error: null,
    createdAt: 1,
    finishedAt: 2,
    elapsed: 1,
    ...patch,
  }
}

describe('prompt skills', () => {
  it('normalizes stored skills and drops invalid entries', () => {
    expect(normalizePromptSkill({ id: '', prompt: 'x' })).toBeNull()
    expect(normalizePromptSkill({ id: 's1', prompt: '' })).toBeNull()
    expect(normalizePromptSkill({
      id: 's1',
      title: '  夜景  ',
      prompt: '  prompt  ',
      tags: ['a', ' a ', 3],
      category: ' 建筑 ',
      params: { size: '1280x720', n: 2.7 },
    })).toMatchObject({ id: 's1', title: '夜景', prompt: 'prompt', tags: ['a'], category: '建筑', params: { size: '1280x720', n: 3 } })
  })

  it('searches title/prompt/tags/category and sorts pinned/title/recent', () => {
    const now = 100
    const a = { ...createPromptSkill({ title: 'A', prompt: '梨 建筑', tags: ['商业'], category: '建筑' }, now), pinned: true, updatedAt: 10 }
    const b = { ...createPromptSkill({ title: 'B', prompt: '苹果', tags: ['室内'], category: '室内' }, now), updatedAt: 30 }
    const c = { ...createPromptSkill({ title: 'C', prompt: '梨 夜景', tags: ['商业'] }, now), updatedAt: 20 }
    expect(filterPromptSkills([a, b, c], { query: '梨' }).map((item) => item.title).sort()).toEqual(['A', 'C'])
    expect(filterPromptSkills([a, b, c], { tag: '商业' }).map((item) => item.title).sort()).toEqual(['A', 'C'])
    expect(filterPromptSkills([a, b, c], { category: '室内' }).map((item) => item.title)).toEqual(['B'])
    expect(filterPromptSkills([a, b, c], { sort: 'pinned' }).map((item) => item.title)[0]).toBe('A')
    expect(filterPromptSkills([a, b, c], { sort: 'title' }).map((item) => item.title)).toEqual(['A', 'B', 'C'])
    expect(filterPromptSkills([a, b, c], { sort: 'recent' }).map((item) => item.title)).toEqual(['B', 'C', 'A'])
  })

  it('saves prompt and params from a task without image snapshots', () => {
    const skill = skillFromTask(task(), 100)
    expect(skill).toMatchObject({
      title: '商业空间夜景',
      prompt: '商业空间夜景\n细节',
      sourceTaskId: 'task-a',
      params: { size: '1280x720', quality: 'high', model: 'gpt-image-2.5', n: 2 },
    })
    expect(JSON.stringify(skill)).not.toContain('dataUrl')
  })

  it('builds only parameter fields that can be applied to the input', () => {
    const skill = createPromptSkill({ prompt: 'x', params: { size: '720x1280', quality: 'high', model: 'm', n: 4 } })
    expect(skillParamPatch(skill)).toEqual({ size: '720x1280', quality: 'high', n: 4 })
  })
})

describe('技能库 v2 数据模型', () => {
  it('归一化新字段并丢弃脏数据', () => {
    const skill = normalizePromptSkill({
      id: 's2',
      prompt: '一间 {{room}} 的客厅，{{style}}',
      favorite: true,
      coverImageId: 'img-1',
      negativePrompt: '  不要文字、不要水印  ',
      usageCount: 3.7,
      author: '本地',
      variables: [
        { key: '{{room}}', label: '空间', defaultValue: '明亮', options: ['明亮', '明亮', ''] },
        { key: 'room', label: '重复', defaultValue: 'x' },
        'garbage',
        { key: 'style', label: '风格', defaultValue: '极简' },
      ],
    })
    expect(skill).toMatchObject({ favorite: true, coverImageId: 'img-1', negativePrompt: '不要文字、不要水印', usageCount: 4, author: '本地' })
    expect(skill?.variables).toHaveLength(2)
    expect(skill?.variables?.[0]).toEqual({ key: 'room', label: '空间', defaultValue: '明亮', options: ['明亮'] })
  })

  it('合成参数槽并把负向词拼到提示词尾部', () => {
    const skill = createPromptSkill({
      prompt: '一间 {{room}} 的客厅',
      variables: [{ key: 'room', label: '空间', defaultValue: '明亮', options: ['明亮', '昏暗'] }],
      negativePrompt: '不要水印',
    })
    expect(composeSkillPrompt(skill)).toBe('一间 明亮 的客厅\n\nNegative prompt: 不要水印')
    expect(composeSkillPrompt(skill, { room: '昏暗' })).toBe('一间 昏暗 的客厅\n\nNegative prompt: 不要水印')
    expect(defaultSkillVariableValues(skill)).toEqual({ room: '明亮' })
  })

  it('旧数据的自由文本分类归并到「其他」，持久化值保持不变', () => {
    const legacy = createPromptSkill({ prompt: 'x', category: '建筑' })
    expect(skillCategoryOf(legacy)).toBe('其他')
    expect(legacy.category).toBe('建筑')
    expect(skillCategoryOf(createPromptSkill({ prompt: 'x', category: '光影镜头' }))).toBe('光影镜头')
  })

  it('双轴筛选：分类组、收藏、置顶、常用、模型可叠加', () => {
    const base = (patch: Record<string, unknown>) => normalizePromptSkill({ id: Math.random().toString(36), prompt: 'x', ...patch })!
    const a = base({ category: '建筑', favorite: true, usageCount: 2, params: { model: 'FLUX.1' } })
    const b = base({ category: '光影镜头', pinned: true })
    expect(filterPromptSkills([a, b], { categoryGroup: '其他' }).map((item) => item.id)).toEqual([a.id])
    expect(filterPromptSkills([a, b], { scope: 'favorite' }).map((item) => item.id)).toEqual([a.id])
    expect(filterPromptSkills([a, b], { scope: 'pinned' }).map((item) => item.id)).toEqual([b.id])
    expect(filterPromptSkills([a, b], { scope: 'used' }).map((item) => item.id)).toEqual([a.id])
    expect(filterPromptSkills([a, b], { model: 'FLUX.1' }).map((item) => item.id)).toEqual([a.id])
    expect(filterPromptSkills([a, b], { scope: 'favorite', model: 'FLUX.1' }).map((item) => item.id)).toEqual([a.id])
  })

  it('从任务保存技能时自动带第一张输出图作封面', () => {
    expect(skillFromTask(task({ outputImages: ['img-a', 'img-b'] }), 100).coverImageId).toBe('img-a')
    expect(skillFromTask(task(), 100).coverImageId).toBeUndefined()
  })
})
