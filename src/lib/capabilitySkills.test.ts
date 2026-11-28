import { describe, expect, it } from 'vitest'
import type { Skill } from '../types'
import {
  composeSkillPrompt,
  defaultSkillValues,
  pruneDetachedSkillImages,
  resolveSkillParamPatch,
  toCapabilitySkill,
  validateSkillValues,
} from './capabilitySkills'
import { mergeImportedCapabilitySkills, serializeCapabilitySkillsForExport } from './exportZip'

const SKILL: Skill = {
  id: 'mine:1',
  name: '空间摄影',
  description: '测试技能',
  category: '商业空间',
  coverColor: '#E8DCC8',
  basePrompt: '执行商业空间摄影。',
  slots: [
    { key: 'space', label: '空间类型', type: 'text', required: true },
    { key: 'ref', label: '参考图', type: 'multi-image' },
  ],
  source: 'mine',
  version: 1,
  createdAt: 1,
  updatedAt: 1,
}

describe('capability skills', () => {
  it('fills defaults and validates required slots', () => {
    const values = defaultSkillValues(SKILL)
    expect(values).toEqual({ space: '', ref: [] })
    expect(validateSkillValues(SKILL, values)).toEqual(['请填写「空间类型」'])
    expect(validateSkillValues(SKILL, { ...values, space: '咖啡店' })).toEqual([])
  })

  it('merges base, slot values and user text in order', () => {
    const prompt = composeSkillPrompt(SKILL, { space: '咖啡店', ref: ['img-1'] }, '更明亮一些')
    expect(prompt).toBe('执行商业空间摄影。\n\n【本次输入】\n- 空间类型（space）：咖啡店\n- 参考图（ref）：已附参考图\n\n【用户补充】\n更明亮一些')
  })

  it('expands {{key}} and {{label}} placeholders with values or defaults', () => {
    const skill: Skill = {
      ...SKILL,
      basePrompt: '拍摄{{空间类型}}，风格{{space}}。',
      slots: [{ key: 'space', label: '空间类型', type: 'text', defaultValue: '客厅' }],
    }
    expect(composeSkillPrompt(skill, {}, '')).toBe('拍摄客厅，风格客厅。')
    const filled = composeSkillPrompt(skill, { space: '咖啡店' }, '')
    expect(filled).toContain('拍摄咖啡店，风格咖啡店。')
    expect(filled).not.toContain('{{')
  })

  it('exports v4 capabilitySkills and merges same-id skills with incoming priority', () => {
    const exported = serializeCapabilitySkillsForExport([SKILL])
    expect(exported[0]).toMatchObject({ id: 'mine:1', source: 'mine' })
    const merged = mergeImportedCapabilitySkills([SKILL], [{ ...SKILL, description: '导入版本' }])
    expect(merged).toHaveLength(1)
    expect(merged[0].description).toBe('导入版本')
  })

  it('numbers multiple attached images across slots as @图1 and @图2 and deduplicates inline {key} slots', () => {
    const multiSlotSkill: Skill = {
      ...SKILL,
      basePrompt: '执行材质替换（{material}）。',
      negativePrompt: '抠图硬边，贴图失真',
      slots: [
        { key: 'base_image', label: '空间底图', type: 'image' },
        { key: 'material_ref', label: '新材质参考图', type: 'image' },
        { key: 'material', label: '目标材质', type: 'text', required: true },
        { key: 'light', label: '光照条件', type: 'text' },
      ],
    }
    const prompt = composeSkillPrompt(
      multiSlotSkill,
      { base_image: ['img-a'], material_ref: ['img-b'], material: '微水泥', light: '自然侧光' },
      '',
    )
    expect(prompt).toBe(
      '执行材质替换（微水泥）。\n\n【本次输入】\n- 空间底图（base_image）：已附参考图（对应 @图1）\n- 新材质参考图（material_ref）：已附参考图（对应 @图2）\n- 光照条件（light）：自然侧光\n\n【负向约束（避免出现）】\n抠图硬边，贴图失真',
    )
  })

  it('prunes detached image IDs from skill slot values when inputImages are cleared', () => {
    const cleaned = pruneDetachedSkillImages(
      SKILL,
      { space: '展厅', ref: ['img-old-1', 'img-keep-2'] },
      ['img-keep-2'],
    )
    expect(cleaned).toEqual({ space: '展厅', ref: ['img-keep-2'] })
    const afterClearAll = pruneDetachedSkillImages(SKILL, cleaned, [])
    expect(afterClearAll).toEqual({ space: '展厅', ref: [] })
    expect(composeSkillPrompt(SKILL, afterClearAll, '')).not.toContain('已附参考图')
  })

  it('maps ratio / ratios / layout slot values to workbench size parameters', () => {
    const ratioSkill: Skill = {
      ...SKILL,
      slots: [
        { key: 'ratio', label: '画幅', type: 'enum', options: ['16:9', '9:16', '1:1'], defaultValue: '16:9' },
      ],
    }
    expect(resolveSkillParamPatch(ratioSkill, {})).toEqual({ size: '1536x1024' })
    expect(resolveSkillParamPatch(ratioSkill, { ratio: '9:16 竖版' })).toEqual({ size: '1024x1536' })
    expect(resolveSkillParamPatch(ratioSkill, { ratio: '1:1 方图' })).toEqual({ size: '1024x1024' })
  })

  it('preserves required flag on non-image builtin inputs and initializes enum defaults', () => {
    const builtin = toCapabilitySkill({
      key: 'graphic.poster',
      prompt: '设计海报',
      skill: {
        key: 'graphic.poster',
        name: '海报设计',
        category: 'D 平面与传播',
        priority: 'P0',
        inputs: [
          { k: 'brief', label: '主题与用途', type: 'text', required: true },
          { k: 'ratio', label: '尺寸', type: 'enum', required: true, options: ['3:4', '16:9'] },
          { k: 'reference', label: '参考图', type: 'image', required: true },
        ],
      },
    })
    expect(builtin.slots.find((s) => s.key === 'brief')?.required).toBe(true)
    expect(builtin.slots.find((s) => s.key === 'ratio')?.defaultValue).toBe('3:4')
    expect(builtin.slots.find((s) => s.key === 'reference')?.required).toBe(false)
  })
})
