import type { PromptSkill, Skill, SkillKind, SkillSlotValue } from '../types'
import { applySkillOverride, normalizeCapabilitySkills, useCapabilitySkillStore, type SkillOverride } from './capabilitySkillStore'
import { composeSkillPrompt, loadBuiltinSkills, validateSkillValues } from './capabilitySkills'
import { createPromptSkill, normalizePromptSkills, type SkillSeed } from './promptSkills'
import { promptSkillToCapabilitySkill } from './promptSkillAdapter'
import { useSkillStore } from './skillStore'

export interface RegisteredSkill extends Skill {
  kind: SkillKind
  registryId: string
  sourceId: string
}

interface SkillCatalogInput {
  promptSkills?: PromptSkill[]
  capabilitySkills?: Skill[]
  builtinSkills?: Skill[]
  overrides?: Record<string, SkillOverride>
}

export interface SkillRegistryMetadata {
  id: string
  kind: SkillKind
  name: string
  description: string
  category: string
  tags: string[]
  favorite: boolean
  source: Skill['source']
  version: number
  updatedAt: number
  slotCount: number
  promptLength: number
}

export interface SkillKindModule {
  kind: string
  compose: (skill: Skill, values: Record<string, SkillSlotValue>, userPrompt: string) => string
  validate: (skill: Skill, values: Record<string, SkillSlotValue>) => string[]
}

const DESCRIPTION_TAG = 'desc:'
const skillKindModules = new Map<string, SkillKindModule>()

export function registerSkillKindModule(module: SkillKindModule) {
  skillKindModules.set(module.kind, module)
}

registerSkillKindModule({ kind: 'capability', compose: composeSkillPrompt, validate: validateSkillValues })
registerSkillKindModule({ kind: 'prompt', compose: composeSkillPrompt, validate: validateSkillValues })

export function registeredSkillId(kind: SkillKind, sourceId: string) {
  if (kind === 'capability' && sourceId.startsWith('builtin:')) return sourceId
  const prefix = kind === 'prompt' ? 'prompt:' : 'capability:'
  return sourceId.startsWith(prefix) ? sourceId : `${prefix}${sourceId}`
}

function withRegistry(skill: Skill, kind: SkillKind, registryId = registeredSkillId(kind, skill.id)): RegisteredSkill {
  return {
    ...skill,
    kind,
    registryId,
    sourceId: skill.id,
  }
}

function withoutLegacyPromptMirrors(skills: Skill[]) {
  return skills.filter((skill) => !skill.id.startsWith('prompt:'))
}

export function buildRegisteredSkillCatalog({
  promptSkills = [],
  capabilitySkills = [],
  builtinSkills = [],
  overrides = {},
}: SkillCatalogInput): RegisteredSkill[] {
  const prompts = normalizePromptSkills(promptSkills)
  const capabilities = normalizeCapabilitySkills(capabilitySkills)
  const entries = [
    ...builtinSkills.map((skill) => withRegistry(applySkillOverride(skill, overrides), 'capability', skill.id)),
    ...withoutLegacyPromptMirrors(capabilities).map((skill) => withRegistry(skill, 'capability')),
    ...prompts.map((skill) => withRegistry(promptSkillToCapabilitySkill(skill), 'prompt')),
  ]
  const seen = new Set<string>()
  return entries.filter((skill) => {
    if (seen.has(skill.registryId)) return false
    seen.add(skill.registryId)
    return true
  })
}

export async function loadRegisteredSkillCatalog() {
  return buildRegisteredSkillCatalog({
    promptSkills: useSkillStore.getState().skills,
    capabilitySkills: useCapabilitySkillStore.getState().mine,
    builtinSkills: await loadBuiltinSkills(),
    overrides: useCapabilitySkillStore.getState().builtinOverrides,
  })
}

export function getRegisteredSkillSnapshot() {
  return {
    promptSkills: useSkillStore.getState().skills,
    capabilitySkills: withoutLegacyPromptMirrors(useCapabilitySkillStore.getState().mine),
    overrides: useCapabilitySkillStore.getState().builtinOverrides,
  }
}

export function resolveRegisteredSkill(skills: Skill[], id: string | null | undefined) {
  if (!id) return null
  const exact = skills.find((skill) => (skill as RegisteredSkill).registryId === id)
  if (exact) return exact
  const bySource = skills.filter((skill) => skill.id === id || (skill as RegisteredSkill).sourceId === id)
  return bySource.find((skill) => skill.kind === 'prompt') ?? bySource[0] ?? null
}

export function composeRegisteredSkill(skill: Skill, values: Record<string, SkillSlotValue>, userPrompt: string) {
  const module = skillKindModules.get(skill.kind ?? 'capability')
  if (!module) throw new Error(`未注册技能类型：${skill.kind ?? 'capability'}`)
  return module.compose(skill, values, userPrompt)
}

export function validateRegisteredSkill(skill: Skill, values: Record<string, SkillSlotValue>) {
  const module = skillKindModules.get(skill.kind ?? 'capability')
  if (!module) throw new Error(`未注册技能类型：${skill.kind ?? 'capability'}`)
  return module.validate(skill, values)
}

export function registeredSkillMetadata(skill: Skill): SkillRegistryMetadata {
  const registered = skill as RegisteredSkill
  return {
    id: registered.registryId ?? registeredSkillId(skill.kind ?? 'capability', skill.id),
    kind: registered.kind ?? 'capability',
    name: skill.name,
    description: skill.description,
    category: skill.category,
    tags: skill.tags ?? [],
    favorite: skill.favorite === true,
    source: skill.source,
    version: skill.version,
    updatedAt: skill.updatedAt,
    slotCount: skill.slots.length,
    promptLength: skill.basePrompt.length,
  }
}

export function savePromptSkill(seed: SkillSeed) {
  const skill = createPromptSkill(seed)
  useSkillStore.getState().addSkill(skill)
  return skill
}

export function saveCapabilitySkill(skill: Skill) {
  const next = { ...skill, kind: 'capability' as const }
  useCapabilitySkillStore.getState().addMine(next)
  return next
}

function locator(registryId: string) {
  if (registryId.startsWith('builtin:')) {
    return { kind: 'capability' as const, sourceId: registryId }
  }
  if (registryId.startsWith('prompt:')) {
    return { kind: 'prompt' as const, sourceId: registryId.slice('prompt:'.length) }
  }
  if (registryId.startsWith('capability:')) {
    return { kind: 'capability' as const, sourceId: registryId.slice('capability:'.length) }
  }
  return { kind: 'capability' as const, sourceId: registryId }
}

export function updateRegisteredSkill(registryId: string, patch: Partial<Skill>) {
  const target = locator(registryId)
  if (target.kind === 'prompt') {
    const current = useSkillStore.getState().skills.find((skill) => skill.id === target.sourceId)
    const tags = patch.description === undefined
      ? current?.tags
      : [
          `${DESCRIPTION_TAG}${patch.description}`,
          ...(current?.tags ?? []).filter((tag) => !tag.startsWith(DESCRIPTION_TAG)),
        ]
    const next: Partial<PromptSkill> = {}
    if (patch.name !== undefined) next.title = patch.name
    if (patch.basePrompt !== undefined) next.prompt = patch.basePrompt
    if (patch.negativePrompt !== undefined) next.negativePrompt = patch.negativePrompt
    if (patch.category !== undefined) next.category = patch.category
    if (tags !== undefined) next.tags = tags
    if (patch.coverImageId !== undefined) next.coverImageId = patch.coverImageId
    if (patch.favorite !== undefined) next.favorite = patch.favorite
    if (patch.slots !== undefined) {
      next.variables = patch.slots.map((slot) => ({
        key: slot.key,
        label: slot.label,
        defaultValue: typeof slot.defaultValue === 'string' ? slot.defaultValue : '',
        options: slot.options,
      }))
    }
    useSkillStore.getState().updateSkill(target.sourceId, next)
    return
  }
  if (target.sourceId.startsWith('builtin:')) {
    useCapabilitySkillStore.getState().setBuiltinOverride(target.sourceId, patch)
    return
  }
  useCapabilitySkillStore.getState().updateMine(target.sourceId, { ...patch, kind: 'capability' })
}

export function removeRegisteredSkill(registryId: string) {
  const target = locator(registryId)
  if (target.kind === 'prompt') {
    useSkillStore.getState().removeSkill(target.sourceId)
    useCapabilitySkillStore.getState().removeMine(`prompt:${target.sourceId}`)
    return true
  }
  if (target.sourceId.startsWith('builtin:')) return false
  useCapabilitySkillStore.getState().removeMine(target.sourceId)
  return true
}

export function toggleRegisteredSkillFavorite(registryId: string) {
  const target = locator(registryId)
  if (target.kind === 'prompt') {
    useSkillStore.getState().toggleFavorite(target.sourceId)
    return
  }
  if (target.sourceId.startsWith('builtin:')) {
    useCapabilitySkillStore.getState().toggleFavorite(target.sourceId)
    return
  }
  const skill = useCapabilitySkillStore.getState().mine.find((item) => item.id === target.sourceId)
  useCapabilitySkillStore.getState().updateMine(target.sourceId, { favorite: skill?.favorite !== true })
}

export function setRegisteredSkillCoverImage(registryId: string, coverImageId?: string) {
  const target = locator(registryId)
  if (target.kind === 'prompt') {
    useSkillStore.getState().updateSkill(target.sourceId, { coverImageId })
    return
  }
  useCapabilitySkillStore.getState().setCoverImage(target.sourceId, coverImageId)
}

export function setRegisteredSkillReferenceImages(registryId: string, referenceImageIds: string[]) {
  const target = locator(registryId)
  if (target.kind === 'prompt') {
    useSkillStore.getState().updateSkill(target.sourceId, { coverImageId: referenceImageIds[0] })
    return
  }
  useCapabilitySkillStore.getState().setReferenceImages(target.sourceId, referenceImageIds)
}

export function replaceRegisteredSkillBackup(input: {
  promptSkills?: PromptSkill[]
  capabilitySkills?: Skill[]
  overrides?: Record<string, SkillOverride>
}) {
  if (input.promptSkills !== undefined) {
    useSkillStore.getState().replaceSkills(normalizePromptSkills(input.promptSkills))
  }
  if (input.capabilitySkills !== undefined) {
    useCapabilitySkillStore.getState().replaceMine(
      withoutLegacyPromptMirrors(normalizeCapabilitySkills(input.capabilitySkills)),
    )
  }
  if (input.overrides !== undefined) {
    useCapabilitySkillStore.getState().replaceOverrides(input.overrides)
  }
}

export function replaceRegisteredSkillState(input: {
  promptSkills: PromptSkill[]
  capabilitySkills: Skill[]
  overrides: Record<string, SkillOverride>
}) {
  useSkillStore.setState({ skills: normalizePromptSkills(input.promptSkills) })
  useCapabilitySkillStore.setState({
    mine: withoutLegacyPromptMirrors(normalizeCapabilitySkills(input.capabilitySkills)),
    builtinOverrides: input.overrides,
  })
}
