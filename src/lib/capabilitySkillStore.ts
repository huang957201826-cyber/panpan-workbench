import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Skill, SkillSlot, SkillSlotValue } from '../types'
import { isTauri } from './platform'
import { tauriStorage } from './tauriStorage'

function isSlotValue(value: unknown): value is SkillSlotValue {
  if (typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function normalizeSlots(value: unknown): SkillSlot[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const slot = item as Partial<SkillSlot>
    if (typeof slot.key !== 'string' || typeof slot.label !== 'string') return []
    if (!['text', 'enum', 'multi', 'number', 'bool', 'image', 'multi-image'].includes(String(slot.type))) return []
    return [{
      key: slot.key,
      label: slot.label,
      type: slot.type as SkillSlot['type'],
      placeholder: typeof slot.placeholder === 'string' ? slot.placeholder : undefined,
      defaultValue: isSlotValue(slot.defaultValue) ? slot.defaultValue : undefined,
      options: Array.isArray(slot.options) ? slot.options.filter((option): option is string => typeof option === 'string') : undefined,
      required: Boolean(slot.required),
    }]
  })
}

export function normalizeCapabilitySkills(value: unknown): Skill[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const skill = item as Partial<Skill>
    if (typeof skill.id !== 'string' || typeof skill.name !== 'string' || typeof skill.basePrompt !== 'string') return []
    return [{
      id: skill.id,
      name: skill.name,
      description: typeof skill.description === 'string' ? skill.description : '',
      category: typeof skill.category === 'string' ? skill.category : '我的',
      coverColor: typeof skill.coverColor === 'string' ? skill.coverColor : '#E8DCC8',
      coverImageId: typeof skill.coverImageId === 'string' ? skill.coverImageId : undefined,
      referenceImageIds: Array.isArray(skill.referenceImageIds)
        ? skill.referenceImageIds.filter((value): value is string => typeof value === 'string' && Boolean(value))
        : undefined,
      basePrompt: skill.basePrompt,
      slots: normalizeSlots(skill.slots),
      negativePrompt: typeof skill.negativePrompt === 'string' ? skill.negativePrompt : undefined,
      params: skill.params,
      requiredImages: Array.isArray(skill.requiredImages) ? skill.requiredImages : undefined,
      examples: Array.isArray(skill.examples) ? skill.examples.filter((example): example is string => typeof example === 'string') : undefined,
      source: skill.source === 'builtin' ? 'builtin' : 'mine',
      model: typeof skill.model === 'string' && skill.model.trim() ? skill.model.trim() : undefined,
      favorite: skill.favorite === true,
      version: typeof skill.version === 'number' ? skill.version : 1,
      createdAt: typeof skill.createdAt === 'number' ? skill.createdAt : Date.now(),
      updatedAt: typeof skill.updatedAt === 'number' ? skill.updatedAt : Date.now(),
    }]
  })
}

export interface SkillOverride {
  favorite?: boolean
  coverImageId?: string
  model?: string
  basePrompt?: string
  slots?: SkillSlot[]
  name?: string
  description?: string
  referenceImageIds?: string[]
}

function normalizeOverrides(value: unknown): Record<string, SkillOverride> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, SkillOverride> = {}
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!id || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const item = raw as Record<string, unknown>
    const override: SkillOverride = {}
    if (typeof item.favorite === 'boolean') override.favorite = item.favorite
    if (typeof item.coverImageId === 'string' && item.coverImageId) override.coverImageId = item.coverImageId
    if (typeof item.model === 'string' && item.model.trim()) override.model = item.model.trim()
    if (typeof item.basePrompt === 'string' && item.basePrompt.trim()) override.basePrompt = item.basePrompt
    if (typeof item.name === 'string' && item.name.trim()) override.name = item.name.trim()
    if (typeof item.description === 'string' && item.description.trim()) override.description = item.description.trim()
    if (Array.isArray(item.slots)) override.slots = normalizeSlots(item.slots)
    if (Array.isArray(item.referenceImageIds)) {
      override.referenceImageIds = item.referenceImageIds.filter((value): value is string => typeof value === 'string' && Boolean(value))
    }
    if (Object.keys(override).length) result[id] = override
  }
  return result
}

/** 内置技能只存覆盖层，不复制进 mine */
export function applySkillOverride(skill: Skill, overrides: Record<string, SkillOverride>): Skill {
  const override = overrides[skill.id]
  if (!override) return skill
  return {
    ...skill,
    favorite: override.favorite ?? skill.favorite,
    coverImageId: override.coverImageId ?? skill.coverImageId,
    model: override.model ?? skill.model,
    basePrompt: override.basePrompt ?? skill.basePrompt,
    slots: override.slots ?? skill.slots,
    name: override.name ?? skill.name,
    description: override.description ?? skill.description,
    referenceImageIds: override.referenceImageIds ?? skill.referenceImageIds,
  }
}

interface CapabilitySkillStore {
  mine: Skill[]
  builtinOverrides: Record<string, SkillOverride>
  addMine: (skill: Skill) => void
  updateMine: (id: string, patch: Partial<Skill>) => void
  removeMine: (id: string) => void
  replaceMine: (skills: Skill[]) => void
  toggleFavorite: (id: string) => void
  setCoverImage: (id: string, coverImageId?: string) => void
  setReferenceImages: (id: string, referenceImageIds: string[]) => void
  setBuiltinOverride: (id: string, patch: Partial<SkillOverride>) => void
  resetBuiltinOverride: (id: string) => void
  replaceOverrides: (overrides: Record<string, SkillOverride>) => void
}

export const useCapabilitySkillStore = create<CapabilitySkillStore>()(
  persist(
    (set) => ({
      mine: [],
      builtinOverrides: {},
      addMine: (skill) => set((state) => ({
        mine: [skill, ...state.mine.filter((item) => item.id !== skill.id)],
      })),
      updateMine: (id, patch) => set((state) => ({
        mine: state.mine.map((skill) => skill.id === id
          ? { ...skill, ...patch, id: skill.id, updatedAt: Date.now() }
          : skill),
      })),
      removeMine: (id) => set((state) => ({ mine: state.mine.filter((skill) => skill.id !== id) })),
      replaceMine: (skills) => set({ mine: normalizeCapabilitySkills(skills) }),
      toggleFavorite: (id) => set((state) => {
        if (id.startsWith('builtin:')) {
          const current = state.builtinOverrides[id]
          return { builtinOverrides: { ...state.builtinOverrides, [id]: { ...current, favorite: !current?.favorite } } }
        }
        return {
          mine: state.mine.map((skill) => skill.id === id ? { ...skill, favorite: !skill.favorite, updatedAt: Date.now() } : skill),
        }
      }),
      setCoverImage: (id, coverImageId) => set((state) => {
        if (id.startsWith('builtin:')) {
          const current = state.builtinOverrides[id] ?? {}
          const next = { ...current, coverImageId }
          if (!coverImageId) delete next.coverImageId
          return { builtinOverrides: { ...state.builtinOverrides, [id]: next } }
        }
        return { mine: state.mine.map((skill) => skill.id === id ? { ...skill, coverImageId, updatedAt: Date.now() } : skill) }
      }),
      setReferenceImages: (id, referenceImageIds) => set((state) => {
        if (id.startsWith('builtin:')) {
          const current = state.builtinOverrides[id] ?? {}
          const next: SkillOverride = { ...current, referenceImageIds }
          if (!referenceImageIds.length) delete next.referenceImageIds
          return { builtinOverrides: { ...state.builtinOverrides, [id]: next } }
        }
        return { mine: state.mine.map((skill) => skill.id === id ? { ...skill, referenceImageIds, updatedAt: Date.now() } : skill) }
      }),
      setBuiltinOverride: (id, patch) => set((state) => {
        if (!id.startsWith('builtin:')) return state
        const current = state.builtinOverrides[id] ?? {}
        const next = { ...current, ...patch }
        return { builtinOverrides: { ...state.builtinOverrides, [id]: next } }
      }),
      resetBuiltinOverride: (id) => set((state) => {
        if (!id.startsWith('builtin:')) return state
        const next = { ...state.builtinOverrides }
        delete next[id]
        return { builtinOverrides: next }
      }),
      replaceOverrides: (overrides) => set({ builtinOverrides: normalizeOverrides(overrides) }),
    }),
    {
      name: 'panpan-capability-skills-v1',
      storage: createJSONStorage(() => isTauri ? tauriStorage : window.localStorage),
      version: 2,
      migrate: (persisted) => {
        const value = persisted as { mine?: unknown; builtinOverrides?: unknown } | undefined
        return {
          mine: normalizeCapabilitySkills(value?.mine),
          builtinOverrides: normalizeOverrides(value?.builtinOverrides),
        }
      },
      partialize: (state) => ({ mine: state.mine, builtinOverrides: state.builtinOverrides }),
      merge: (persisted, current) => {
        const value = persisted as { mine?: unknown; builtinOverrides?: unknown } | undefined
        return {
          ...current,
          mine: normalizeCapabilitySkills(value?.mine),
          builtinOverrides: normalizeOverrides(value?.builtinOverrides),
        }
      },
    },
  ),
)
