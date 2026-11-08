/** 技能分类枚举：左侧分类面板与顶部 Tab 的计数都基于这组固定值聚合 */
export const SKILL_CATEGORIES = [
  '商业空间',
  '光影镜头',
  '材质质感',
  '负向增强',
  '艺术风格',
  '其他',
] as const

export type SkillCategory = (typeof SKILL_CATEGORIES)[number]

export const OTHER_CATEGORY: SkillCategory = '其他'

/**
 * 把自由文本分类收敛到枚举。旧数据里的自定义分类归入「其他」，原文存进 legacyCategory，
 * 这样计数能稳定聚合，又不会静默丢掉用户写过的分类名。
 */
export function normalizeSkillCategory(value: unknown): { category?: SkillCategory; legacyCategory?: string } {
  if (typeof value !== 'string' || !value.trim()) return {}
  const trimmed = value.trim().slice(0, 40)
  if ((SKILL_CATEGORIES as readonly string[]).includes(trimmed)) {
    return { category: trimmed as SkillCategory }
  }
  return { category: OTHER_CATEGORY, legacyCategory: trimmed }
}

/** 按 id 做 FNV-1a 哈希，保证同一条技能永远拿到同一张封面渐变 */
function hashId(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

/** 无封面技能的兜底：确定性双色渐变 + 点阵纹理，深浅主题下都可读 */
export function skillCoverStyle(id: string) {
  const hue = hashId(id) % 360
  const secondHue = (hue + 46) % 360
  return {
    backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.20) 1px, transparent 0), linear-gradient(135deg, hsl(${hue} 58% 46%), hsl(${secondHue} 52% 28%))`,
    backgroundSize: '12px 12px, cover',
  }
}
