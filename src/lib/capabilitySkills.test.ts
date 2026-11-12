import { describe, expect, it } from 'vitest'
import type { Skill } from '../types'
import { composeSkillPrompt, defaultSkillValues, validateSkillValues } from './capabilitySkills'
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
})
