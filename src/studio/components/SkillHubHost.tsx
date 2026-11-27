import { useEffect, useMemo, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useStore } from '../../store'
import { loadBuiltinSkills } from '../../lib/capabilitySkills'
import { useCapabilitySkillStore } from '../../lib/capabilitySkillStore'
import { useSkillStore } from '../../lib/skillStore'
import { useWorkspaceStore } from '../../lib/workspaceStore'
import {
  buildRegisteredSkillCatalog,
  removeRegisteredSkill,
  savePromptSkill,
  toggleRegisteredSkillFavorite,
  updateRegisteredSkill,
} from '../../lib/skillRegistry'
import type { Skill } from '../../types'
import { SkillHubView } from '../modules/skills/SkillHubView'
import type { SkillItem } from '../modules/skills/types'
import {
  SIDEBAR_BODY_CLASS,
  SIDEBAR_HEADER_CLASS,
  SIDEBAR_ICON_BUTTON_CLASS,
  SIDEBAR_ITEM_ACTIVE_CLASS,
  SIDEBAR_ITEM_CLASS,
  SIDEBAR_ITEM_IDLE_CLASS,
  SIDEBAR_PANEL_CLASS,
  SIDEBAR_SUBTITLE_CLASS,
  SIDEBAR_TITLE_CLASS,
} from './sidebarStyles'

/** 分类显示名按现有 A–H 前缀顺序排列；展示时去掉字母前缀 */
const CATEGORY_LABELS = [
  '空间与场地',
  '改造与材质',
  '产品与电商',
  '平面与传播',
  '动态',
  'UI 与网页',
  '角色与配景',
  '风格包',
]

const DESC_TAG = 'desc:'

function categoryLabel(raw: string) {
  return raw.replace(/^[A-Ha-h][\s.、]*/, '').trim() || raw
}

function toItem(skill: Skill): SkillItem {
  const label = categoryLabel(skill.category)
  return {
    id: skill.registryId ?? skill.id,
    title: skill.name,
    category: label,
    categoryLabel: label,
    description: skill.description,
    recommendedModel: skill.model || '通用',
    promptTemplate: skill.basePrompt,
    tags: skill.tags ?? [],
    variables: skill.slots
      .filter((slot) => slot.type !== 'image' && slot.type !== 'multi-image')
      .map((slot) => ({
        key: slot.key,
        label: slot.label,
        defaultValue:
          typeof slot.defaultValue === 'string' ? slot.defaultValue : (slot.options?.[0] ?? ''),
        placeholder: slot.placeholder,
        options: slot.options,
      })),
    isFavorite: skill.favorite === true,
    isCustom: skill.source !== 'builtin',
    author: skill.author,
  }
}

function seedFromItem(item: SkillItem, title?: string) {
  return {
    title: title ?? item.title,
    prompt: item.promptTemplate,
    negativePrompt: item.negativePrompt,
    category: item.categoryLabel,
    tags: [DESC_TAG + item.description],
    variables: item.variables,
    author: item.author,
  }
}

/** 技能库：内置 27 条（只读）+ 用户自建（可编辑删除），共用一个列表 */
export function SkillHubHost({ onApplied }: { onApplied: () => void }) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [category, setCategory] = useState('all')
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('panpan-skill-sidebar-collapsed')
      if (saved === '1') return true
      if (saved === '0') return window.innerWidth < 680
      return window.innerWidth < 1080
    } catch {
      return window.innerWidth < 1080
    }
  })
  const overrides = useCapabilitySkillStore((state) => state.builtinOverrides)
  const mineCapabilitySkills = useCapabilitySkillStore((state) => state.mine)
  const customSkills = useSkillStore((state) => state.skills)
  const setPrompt = useStore((state) => state.setPrompt)
  const clearSkillChip = useStore((state) => state.clearSkillChip)

  useEffect(() => {
    try {
      localStorage.setItem('panpan-skill-sidebar-collapsed', collapsed ? '1' : '0')
    } catch {
      // 折叠偏好写失败不影响使用
    }
  }, [collapsed])

  useEffect(() => {
    let active = true
    loadBuiltinSkills()
      .then((list) => {
        if (active) setSkills(list)
      })
      .catch((err) => console.error('读取技能库失败：', err))
    return () => {
      active = false
    }
  }, [])

  const registrySkills = useMemo(
    () => buildRegisteredSkillCatalog({
      promptSkills: customSkills,
      capabilitySkills: mineCapabilitySkills,
      builtinSkills: skills,
      overrides,
    }),
    [skills, overrides, customSkills, mineCapabilitySkills],
  )
  const items = useMemo(() => registrySkills.map(toItem), [registrySkills])

  const handleApplySkill = (item: SkillItem, text: string, mode: 'replace' | 'append' = 'replace') => {
    const current = useStore.getState().prompt.trim()
    setPrompt(mode === 'append' && current ? `${current}，${text}` : text)
    onApplied()
  }

  return (
    <div className="flex h-full min-h-0 flex-col min-[680px]:flex-row bg-[#f3f4f8] dark:bg-[#0c0e14]">
      <div className="flex min-[680px]:hidden shrink-0 items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-black/[0.05] bg-[#fbfcfd] px-3 py-2 dark:border-white/[0.06] dark:bg-[#12141c]">
        {['all', 'mine', ...CATEGORY_LABELS, 'favorites'].map((label) => {
          const title = label === 'all' ? '全部' : label === 'mine' ? '我的' : label === 'favorites' ? '收藏' : label
          const active = category === label
          return (
            <button
              key={label}
              type="button"
              onClick={() => setCategory(label)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-caption font-medium transition ${
                active
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-black/[0.04] text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'
              }`}
            >
              {title}
            </button>
          )
        })}
      </div>
      <aside
        data-skill-rail
        className={`hidden min-[680px]:flex ${collapsed ? 'w-12 shrink-0 flex-col overflow-y-auto border-r border-black/[0.04] bg-[#fbfcfd] p-2 dark:border-white/[0.05] dark:bg-[#12141c]' : SIDEBAR_PANEL_CLASS} transition-[width] duration-150`}
      >
        <div className={`${SIDEBAR_HEADER_CLASS} ${collapsed ? 'items-center justify-center px-0' : ''}`}>
          {!collapsed && (
            <div>
              <h2 className={SIDEBAR_TITLE_CLASS}>技能库</h2>
              <p className={SIDEBAR_SUBTITLE_CLASS}>
                {items.filter((item) => !item.isCustom).length} 条内置 · {items.filter((item) => item.isCustom).length} 条自定义
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? '展开左栏' : '收起左栏'}
            className={SIDEBAR_ICON_BUTTON_CLASS}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
        {!collapsed &&
          <div className={`${SIDEBAR_BODY_CLASS} space-y-1`}>
          {['all', 'mine', ...CATEGORY_LABELS, 'favorites'].map((label) => {
            const title = label === 'all' ? '全部技能' : label === 'mine' ? '我的技能' : label === 'favorites' ? '我的收藏' : label
            const count =
              label === 'all'
                ? items.length
                : label === 'mine'
                ? items.filter((item) => item.isCustom).length
                : label === 'favorites'
                ? items.filter((item) => item.isFavorite).length
                : items.filter((item) => item.category === label).length
            const active = category === label
            return (
              <button
                key={label}
                type="button"
                onClick={() => setCategory(label)}
                className={`${SIDEBAR_ITEM_CLASS} justify-between text-left ${active ? `${SIDEBAR_ITEM_ACTIVE_CLASS} font-semibold` : SIDEBAR_ITEM_IDLE_CLASS}`}
              >
                <span className="truncate">{title}</span>
                <span className={`text-micro tabular-nums ${active ? 'opacity-80' : 'text-slate-400'}`}>{count}</span>
              </button>
            )
          })}
          </div>}
      </aside>
      <div className="flex-1 min-w-0 h-full">
        <SkillHubView
          skills={items}
          onApplySkill={handleApplySkill}
          onToggleFavorite={toggleRegisteredSkillFavorite}
          onCreateSkill={(item) => {
            try {
              const created = savePromptSkill(seedFromItem(item))
              useStore.getState().showToast(`已保存技能「${created.title}」`, 'success')
            } catch (err) {
              useStore
                .getState()
                .showToast(`保存失败：${err instanceof Error ? err.message : String(err)}`, 'error')
            }
          }}
          onUpdateSkill={(id, item) => {
            updateRegisteredSkill(id, {
              name: item.title,
              description: item.description,
              basePrompt: item.promptTemplate,
              negativePrompt: item.negativePrompt,
              category: item.categoryLabel,
              slots: item.variables?.map((variable) => ({
                key: variable.key,
                label: variable.label,
                type: variable.options?.length ? 'enum' : 'text',
                defaultValue: variable.defaultValue,
                options: variable.options,
              })),
            })
          }}
          onDeleteSkill={(id) => {
            const skill = registrySkills.find((item) => item.registryId === id)
            if (!skill || skill.source === 'builtin') {
              useStore.getState().showToast('内置技能不能删除，可以复制为自定义后再改', 'info')
              return
            }
            if (!window.confirm('删除这条自定义技能？')) return
            removeRegisteredSkill(id)
            const activeId = useStore.getState().activeSkillId
            if (activeId === id || activeId === skill.sourceId) clearSkillChip()
            useWorkspaceStore.setState((state) => ({
              canvases: state.canvases.map((canvas) =>
                canvas.activeSkillId === id || canvas.activeSkillId === skill.sourceId
                  ? { ...canvas, activeSkillId: null, skillSlotValues: {} }
                  : canvas,
              ),
            }))
          }}
          onDuplicateSkill={(item) => {
            savePromptSkill(seedFromItem(item, `${item.title} 副本`))
            useStore.getState().showToast(`已复制为自定义技能「${item.title} 副本」`, 'success')
          }}
          activeCategory={category}
          onSelectCategory={setCategory}
        />
      </div>
    </div>
  )
}
