/** 技能包的前端只读模型；源包在构建时同步到 public/skill-kit。 */

export type SkillKitInputType = 'image' | 'enum' | 'text' | 'number' | 'multi' | 'bool'
export type SkillKitValue = string | string[] | boolean | number

export interface SkillKitInput {
  k: string
  label: string
  type: SkillKitInputType
  required?: boolean
  options?: string[]
}

export interface SkillKitSkill {
  key: string
  name: string
  category: string
  priority: string
  version?: string
  status?: string
  purpose?: string
  notFor?: string
  inputs: SkillKitInput[]
  locks?: string[]
  steps?: string[]
  checks?: string[]
  output?: string
  notes?: string[]
}

export interface SkillKitEntry {
  key: string
  skill: SkillKitSkill
  prompt: string
}

export interface SkillKitManifest {
  kit?: string
  version?: string
  status?: string
  generatedAt?: string
  total?: number
  skills: Array<{ key: string; name?: string; category?: string; priority?: string; path: string }>
}

export interface SkillKit {
  manifest: SkillKitManifest
  skills: SkillKitEntry[]
}

const BASE = './skill-kit'

let cached: Promise<SkillKit> | null = null

async function fetchText(path: string): Promise<string> {
  const response = await fetch(`${BASE}/${path}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`技能包文件读取失败：${path}（HTTP ${response.status}）`)
  return response.text()
}

/** 只读加载 MANIFEST + 每条技能的 skill.json / prompt.md */
export function loadSkillKit(): Promise<SkillKit> {
  if (cached) return cached
  cached = (async () => {
    let manifest: SkillKitManifest
    try {
      manifest = JSON.parse(await fetchText('MANIFEST.json')) as SkillKitManifest
    } catch (error) {
      throw new Error(`未找到技能包：${error instanceof Error ? error.message : String(error)}`)
    }
    if (!Array.isArray(manifest.skills) || manifest.skills.length === 0) {
      throw new Error('技能包 MANIFEST 没有 skills 列表')
    }
    const skills = await Promise.all(manifest.skills.map(async (item) => {
      const base = item.path.endsWith('/') ? item.path : `${item.path}/`
      const [skillText, prompt] = await Promise.all([
        fetchText(`${base}skill.json`),
        fetchText(`${base}prompt.md`),
      ])
      const skill = JSON.parse(skillText) as SkillKitSkill
      if (!skill.key || !Array.isArray(skill.inputs)) {
        throw new Error(`技能 ${item.key} 的 skill.json 缺少 key/inputs`)
      }
      return { key: skill.key, skill, prompt }
    }))
    return { manifest, skills }
  })()
  return cached
}

export function clearSkillKitCache() {
  cached = null
}
