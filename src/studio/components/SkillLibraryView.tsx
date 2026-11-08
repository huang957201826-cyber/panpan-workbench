import { useEffect, useMemo, useState } from 'react'
import {
  Aperture,
  Ban,
  Building2,
  Clock,
  Gem,
  Layers,
  MoreHorizontal,
  Palette,
  Pin,
  Plus,
  Search,
  Shapes,
  Sparkles,
  Star,
  X,
} from 'lucide-react'
import type { PromptSkill } from '../../types'
import { splitModelList } from '../../lib/apiProfiles'
import { SKILL_CATEGORIES, type SkillCategory } from '../../lib/skillCategories'
import {
  composeSkillPrompt,
  filterPromptSkills,
  skillCategoryOf,
  skillParamPatch,
  type SkillScope,
  type SkillSort,
} from '../../lib/promptSkills'
import { useSkillStore } from '../../lib/skillStore'
import { useStore } from '../../store'
import { Button, Chip, EmptyState, IconButton, PanelHeader, Segmented, Select, SkeletonGrid } from '../../ui'
import { SkillCard } from './skillhub/SkillCard'
import { SkillInspectorModal } from './skillhub/SkillInspectorModal'

type CategorySelection = SkillCategory | 'all'

const CATEGORY_ICONS: Record<CategorySelection, typeof Layers> = {
  all: Layers,
  商业空间: Building2,
  光影镜头: Aperture,
  材质质感: Gem,
  负向增强: Ban,
  艺术风格: Palette,
  其他: Shapes,
}

const SCOPE_ITEMS: Array<{ value: SkillScope; label: string; icon: typeof Layers }> = [
  { value: 'all', label: '全部', icon: Layers },
  { value: 'favorite', label: '已收藏', icon: Star },
  { value: 'pinned', label: '已置顶', icon: Pin },
  { value: 'used', label: '常用', icon: Clock },
]


export function SkillLibraryView({ onUsed }: { onUsed?: () => void }) {
  const skills = useSkillStore((state) => state.skills)
  const openNewSkill = useSkillStore((state) => state.openNewSkill)
  const toggleFavorite = useSkillStore((state) => state.toggleFavorite)
  const incrementUsage = useSkillStore((state) => state.incrementUsage)
  const currentPrompt = useStore((state) => state.prompt)
  const showToast = useStore((state) => state.showToast)

  const [hydrated, setHydrated] = useState(() => useSkillStore.persist.hasHydrated())
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SkillScope>('all')
  const [category, setCategory] = useState<CategorySelection>('all')
  const [tag, setTag] = useState('')
  const [model, setModel] = useState('')
  const [sort] = useState<SkillSort>('recent')
  const [showAllTags, setShowAllTags] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [inspectorId, setInspectorId] = useState<string | null>(null)

  useEffect(() => useSkillStore.persist.onFinishHydration(() => setHydrated(true)), [])

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries([
      ['all', skills.length],
      ...SKILL_CATEGORIES.map((item) => [item, 0]),
    ]) as Record<CategorySelection, number>
    for (const skill of skills) counts[skillCategoryOf(skill)] += 1
    return counts
  }, [skills])

  const scopeCounts = useMemo<Record<SkillScope, number>>(() => ({
    all: skills.length,
    favorite: skills.filter((skill) => skill.favorite).length,
    pinned: skills.filter((skill) => skill.pinned).length,
    used: skills.filter((skill) => (skill.usageCount ?? 0) > 0).length,
  }), [skills])

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const skill of skills) {
      for (const item of skill.tags) counts.set(item, (counts.get(item) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
  }, [skills])

  const modelOptions = useMemo(
    () => [...new Set(skills.map((skill) => skill.params?.model).filter((item): item is string => Boolean(item)))].sort(),
    [skills],
  )

  const filtered = useMemo(
    () => filterPromptSkills(skills, {
      query,
      scope,
      categoryGroup: category === 'all' ? undefined : category,
      tag: tag || undefined,
      model: model || undefined,
      sort,
    }),
    [skills, query, scope, category, tag, model, sort],
  )

  const inspector = skills.find((skill) => skill.id === inspectorId) ?? null

  const clearFilters = () => {
    setQuery('')
    setScope('all')
    setCategory('all')
    setTag('')
    setModel('')
  }

  const hasFilters = Boolean(query || scope !== 'all' || category !== 'all' || tag || model)

  const applySkill = (skill: PromptSkill, prompt: string) => {
    const state = useStore.getState()
    const apply = () => {
      state.setPrompt(prompt)
      state.setParams(skillParamPatch(skill))
      if (skill.params?.model) {
        const profile = state.settings.profiles.find((item) => item.id === state.settings.activeProfileId)
        if (profile && splitModelList(profile.model).includes(skill.params.model)) {
          state.setSettings({
            profiles: state.settings.profiles.map((item) => item.id === profile.id
              ? { ...item, selectedModel: skill.params?.model }
              : item),
          })
        }
      }
      incrementUsage(skill.id)
      state.showToast(`已使用技能「${skill.title}」`, 'success')
      onUsed?.()
    }
    if (state.prompt.trim()) {
      state.setConfirmDialog({
        title: '替换当前提示词',
        message: `使用「${skill.title}」会替换输入框里的提示词和参数，不会自动提交生成。`,
        confirmText: '替换',
        cancelText: '取消',
        action: apply,
      })
      return
    }
    apply()
  }

  const copySkill = (skill: PromptSkill) => {
    void navigator.clipboard.writeText(composeSkillPrompt(skill))
    setCopiedId(skill.id)
    window.setTimeout(() => setCopiedId(null), 1800)
  }

  const deleteSkill = (skill: PromptSkill) => {
    const state = useStore.getState()
    // 详情 Modal 层级(z-9998)高于全局 ConfirmDialog(z-110)：先收起详情，确认框才可见，也避免两层焦点陷阱叠加
    if (inspectorId === skill.id) setInspectorId(null)
    state.setConfirmDialog({
      title: '删除技能',
      message: `删除「${skill.title}」后不可撤销。若此前导出过 ZIP 备份，可通过备份恢复。`,
      confirmText: '删除',
      cancelText: '取消',
      action: () => {
        useSkillStore.getState().removeSkill(skill.id)
        state.showToast(`已删除技能「${skill.title}」`, 'success')
      },
    })
  }

  const seedFromCurrent = () => {
    const state = useStore.getState()
    openNewSkill({
      title: currentPrompt.trim().split(/\r?\n/)[0]?.slice(0, 40),
      prompt: currentPrompt,
      params: { size: state.params.size, quality: state.params.quality, n: state.params.n },
    })
  }

  const visibleTags = showAllTags ? tagCounts : tagCounts.slice(0, 6)

  return (
    <div className="flex h-full w-full overflow-hidden bg-surface text-ink-1">
      {/* 左栏 232px：与折叠后的 56px rail 组成三栏结构 */}
      <aside className="flex w-[232px] shrink-0 flex-col border-r border-line bg-surface">
        <PanelHeader
          title="技能与配方"
          meta={<Chip>Hub</Chip>}
          actions={<span className="font-mono text-caption text-ink-3">{skills.length} 条</span>}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="rounded-card bg-surface-2 p-3">
            <p className="text-body-sm font-semibold text-ink-1">一键调用说明</p>
            <p className="mt-1 text-body-sm leading-[1.6] text-ink-2">
              点击「一键调用」，把这条配方的提示词与参数直接注入当前工作区底栏，不会自动提交生成。
            </p>
          </div>

          <p className="mb-1 mt-4 px-1 text-body-sm font-semibold text-ink-3">分类</p>
          <div className="space-y-0.5">
            {(['all', ...SKILL_CATEGORIES] as CategorySelection[]).map((item) => {
              const Icon = CATEGORY_ICONS[item]
              const active = category === item
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`flex h-8 w-full items-center gap-2 rounded-control px-2 text-left text-body transition-colors duration-fast ${
                    active ? '' : 'text-ink-2 hover:bg-surface-2 hover:text-ink-1'
                  }`}
                  style={active ? { backgroundColor: 'var(--brand-soft)', color: 'var(--brand)' } : undefined}
                >
                  <Icon size={14} strokeWidth={1.6} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item === 'all' ? '全部技能' : item}</span>
                  <span className="font-mono text-body-sm opacity-70">{categoryCounts[item]}</span>
                </button>
              )
            })}
          </div>

          {tagCounts.length > 0 && (
            <>
              <p className="mb-2 mt-5 px-1 text-body-sm font-semibold text-ink-3">热门标签</p>
              <div className="flex flex-wrap gap-1">
                {visibleTags.map(([item, count]) => (
                  <Chip key={item} active={tag === item} onClick={() => setTag(tag === item ? '' : item)}>
                    #{item} <span className="font-mono opacity-60">{count}</span>
                  </Chip>
                ))}
                {!showAllTags && tagCounts.length > 6 && (
                  <Chip onClick={() => setShowAllTags(true)}>+{tagCounts.length - 6}</Chip>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex h-11 shrink-0 items-center border-t border-line px-3">
          <IconButton
            label="更多技能操作"
            onClick={() => showToast('技能的导入 / 导出将在后续版本开放', 'info')}
          >
            <MoreHorizontal size={15} />
          </IconButton>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto">
              <X size={13} />
              清除筛选
            </Button>
          )}
        </div>
      </aside>

      {/* 右栏：48px 顶栏 + 独立滚动的内容区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
          <Segmented
            value={scope}
            onChange={setScope}
            className="min-w-0 flex-1"
            options={SCOPE_ITEMS.map((item) => ({
              value: item.value,
              label: <>{item.label} <span className="font-mono text-caption opacity-60">{scopeCounts[item.value]}</span></>,
            }))}
          />

          <div className="relative shrink-0">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索配方与关键词…"
              aria-label="搜索配方与关键词"
              className="h-8 w-[150px] rounded-control border border-line bg-surface-2 pl-8 pr-2 text-body-sm text-ink-1 outline-none transition-all duration-fast focus:w-[220px] focus:border-brand xl:w-[200px] xl:focus:w-[240px]"
            />
          </div>

          <Select
            value={model}
            label="按底模筛选"
            placeholder="全部底模"
            options={[{ value: '', label: '全部底模' }, ...modelOptions.map((item) => ({ value: item, label: item }))]}
            onChange={setModel}
            width={180}
          />

          <Button variant="primary" size="sm" onClick={() => openNewSkill()}>
            <Plus size={14} />
            新建技能
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!hydrated ? (
            <SkeletonGrid count={3} label="正在加载技能库" />
          ) : skills.length === 0 ? (
            <EmptyState
              className="py-24"
              icon={<Sparkles size={20} />}
              title="技能库还是空的"
              description="保存常用提示词和参数，之后一键注入输入框；不会保存参考图、Key 或路径。"
              action={
                <div className="flex gap-2">
                  <Button variant="secondary" size="md" onClick={seedFromCurrent} disabled={!currentPrompt.trim()}>从当前提示词保存</Button>
                  <Button variant="primary" size="md" onClick={() => openNewSkill()}>新建技能</Button>
                </div>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              className="py-24"
              icon={<Search size={20} />}
              title="没有匹配的配方"
              description="试试换一个关键词，或把分类、标签、底模筛选清掉。"
              action={<Button variant="secondary" size="md" onClick={clearFilters}>清除筛选</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {filtered.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  copied={copiedId === skill.id}
                  onOpen={() => setInspectorId(skill.id)}
                  onToggleFavorite={() => toggleFavorite(skill.id)}
                  onCopy={() => copySkill(skill)}
                  onApply={() => applySkill(skill, composeSkillPrompt(skill))}
                  onDelete={deleteSkill}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <SkillInspectorModal
        skill={inspector}
        onClose={() => setInspectorId(null)}
        onApply={(prompt) => {
          if (inspector) applySkill(inspector, prompt)
          setInspectorId(null)
        }}
        onDelete={deleteSkill}
      />
    </div>
  )
}
