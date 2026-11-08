import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { PromptSkill } from '../types'
import { createPromptSkill, normalizePromptSkills, type SkillSeed } from './promptSkills'
import { isTauri } from './platform'
import { tauriStorage } from './tauriStorage'

export interface SkillEditorState {
  open: boolean
  skillId?: string
  seed?: SkillSeed
}

interface SkillStore {
  skills: PromptSkill[]
  editor: SkillEditorState
  addSkill: (skill: PromptSkill) => void
  updateSkill: (id: string, patch: Partial<PromptSkill>) => void
  removeSkill: (id: string) => void
  togglePinned: (id: string) => void
  toggleFavorite: (id: string) => void
  incrementUsage: (id: string) => void
  openNewSkill: (seed?: SkillSeed) => void
  openEditSkill: (id: string) => void
  closeSkillEditor: () => void
  replaceSkills: (skills: PromptSkill[]) => void
}

const initialEditor: SkillEditorState = { open: false }

export const useSkillStore = create<SkillStore>()(
  persist(
    (set) => ({
      skills: [],
      editor: initialEditor,
      addSkill: (skill) => set((state) => ({
        skills: [skill, ...state.skills.filter((item) => item.id !== skill.id)],
      })),
      updateSkill: (id, patch) => set((state) => ({
        skills: state.skills.map((skill) => skill.id === id
          ? { ...skill, ...patch, id: skill.id, updatedAt: Date.now() }
          : skill),
      })),
      removeSkill: (id) => set((state) => ({
        skills: state.skills.filter((skill) => skill.id !== id),
      })),
      togglePinned: (id) => set((state) => ({
        skills: state.skills.map((skill) => skill.id === id
          ? { ...skill, pinned: !skill.pinned, updatedAt: Date.now() }
          : skill),
      })),
      toggleFavorite: (id) => set((state) => ({
        skills: state.skills.map((skill) => skill.id === id
          ? { ...skill, favorite: !skill.favorite }
          : skill),
      })),
      incrementUsage: (id) => set((state) => ({
        skills: state.skills.map((skill) => skill.id === id
          ? { ...skill, usageCount: (skill.usageCount ?? 0) + 1 }
          : skill),
      })),
      openNewSkill: (seed) => set({ editor: { open: true, seed } }),
      openEditSkill: (id) => set({ editor: { open: true, skillId: id } }),
      closeSkillEditor: () => set({ editor: initialEditor }),
      replaceSkills: (skills) => set({ skills: normalizePromptSkills(skills) }),
    }),
    {
      name: 'panpan-prompt-skills-v1',
      storage: createJSONStorage(() => isTauri ? tauriStorage : window.localStorage),
      version: 1,
      partialize: (state) => ({ skills: state.skills }),
      merge: (persisted, current) => {
        const value = persisted as { skills?: unknown } | undefined
        return { ...current, skills: normalizePromptSkills(value?.skills) }
      },
    },
  ),
)

/** 供 UI 直接使用的创建入口 */
export function saveNewSkill(seed: SkillSeed) {
  const skill = createPromptSkill(seed)
  useSkillStore.getState().addSkill(skill)
  return skill
}
