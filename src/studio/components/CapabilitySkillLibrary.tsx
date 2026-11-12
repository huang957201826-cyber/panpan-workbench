import { useEffect, useMemo, useState } from 'react'
import { ImagePlus, Plus, Search, Sparkles, Star, Trash2, X } from 'lucide-react'
import type { Skill, SkillSlotValue } from '../../types'
import { createInputImageFromFile, useStore } from '../../store'
import { loadBuiltinSkills, skillCoverColor, skillSlotImageIds } from '../../lib/capabilitySkills'
import { applySkillOverride, useCapabilitySkillStore } from '../../lib/capabilitySkillStore'
import { ensureImageCached } from '../../lib/imageCache'
import { SkillPickerModal } from './SkillPickerModal'

interface CapabilitySkillLibraryProps {
  onUsed?: () => void
}

export function CapabilitySkillLibrary({ onUsed }: CapabilitySkillLibraryProps) {
  const mine = useCapabilitySkillStore((s) => s.mine)
  const overrides = useCapabilitySkillStore((s) => s.builtinOverrides)
  const removeMine = useCapabilitySkillStore((s) => s.removeMine)
  const updateMine = useCapabilitySkillStore((s) => s.updateMine)
  const toggleFavorite = useCapabilitySkillStore((s) => s.toggleFavorite)
  const setCoverImage = useCapabilitySkillStore((s) => s.setCoverImage)
  const setBuiltinOverride = useCapabilitySkillStore((s) => s.setBuiltinOverride)
  const addMine = useCapabilitySkillStore((s) => s.addMine)
  const [builtin, setBuiltin] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('全部')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [picking, setPicking] = useState<Skill | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadBuiltinSkills()
      .then((skills) => { if (!cancelled) setBuiltin(skills) })
      .catch((err) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const skills = useMemo(() => [
    ...mine,
    ...builtin.map((skill) => applySkillOverride(skill, overrides)),
  ], [mine, builtin, overrides])
  const categories = useMemo(() => ['全部', ...new Set(skills.map((skill) => skill.category))], [skills])
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return skills.filter((skill) => {
      if (favoriteOnly && !skill.favorite) return false
      if (category !== '全部' && skill.category !== category) return false
      if (!keyword) return true
      return `${skill.name} ${skill.description} ${skill.category}`.toLowerCase().includes(keyword)
    })
  }, [skills, category, query, favoriteOnly])

  const apply = async (skill: Skill, values: Record<string, SkillSlotValue>) => {
    const assetIds = [skill.coverImageId, ...(skill.referenceImageIds ?? [])].filter((id): id is string => Boolean(id))
    for (const imageId of [...assetIds, ...skillSlotImageIds(skill, values)]) {
      if (useStore.getState().inputImages.some((image) => image.id === imageId)) continue
      const dataUrl = await ensureImageCached(imageId)
      if (dataUrl) useStore.getState().addInputImage({ id: imageId, dataUrl })
    }
    useStore.getState().setActiveSkillId(skill.id)
    useStore.getState().setSkillSlotValues(values)
    setPicking(null)
    onUsed?.()
  }

  const changeCover = async (skill: Skill, file: File | undefined) => {
    if (!file) return
    const image = await createInputImageFromFile(file)
    if (image) setCoverImage(skill.id, image.id)
  }

  return (
    <div className="flex h-full min-h-0 bg-[#f3f4f8] text-slate-800 dark:bg-[#0c0e14] dark:text-slate-100">
      <aside className="flex w-[256px] shrink-0 flex-col gap-1.5 border-r border-black/[0.04] bg-[#fbfcfd] p-3.5 dark:border-white/[0.05] dark:bg-[#12141c]">
        <div className="px-1 pb-2 pt-1">
          <h2 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">技能库</h2>
          <p className="mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {skills.length} 个可复用提示词
          </p>
        </div>

        <button
          type="button"
          onClick={() => setFavoriteOnly((value) => !value)}
          className={`flex h-[46px] items-center justify-between rounded-2xl px-3.5 text-left transition ${
            favoriteOnly
              ? 'bg-black text-white shadow-md dark:bg-white dark:text-black'
              : 'text-slate-600 hover:bg-black/[0.04] hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Star size={16} className="text-amber-500" fill="currentColor" />
            <span className="text-[13px] font-semibold">我的收藏精选</span>
          </span>
          <span className="font-mono text-[10px] opacity-60">{skills.filter((skill) => skill.favorite).length}</span>
        </button>

        <p className="px-2 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          技能分类
        </p>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto no-scrollbar">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`flex h-[46px] w-full items-center justify-between rounded-2xl px-3.5 text-left transition ${
                category === item
                  ? 'bg-black text-white shadow-md dark:bg-white dark:text-black'
                  : 'text-slate-600 hover:bg-black/[0.04] hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
              }`}
            >
              <span className="truncate text-[13px] font-semibold">{item}</span>
              <span className="font-mono text-[10px] opacity-55">
                {item === '全部' ? skills.length : skills.filter((skill) => skill.category === item).length}
              </span>
            </button>
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-[54px] shrink-0 items-center gap-2 border-b border-black/[0.04] bg-white px-6 dark:border-white/[0.05] dark:bg-[#12141c]">
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索技能名称、用途或分类"
            className="h-8 w-full max-w-sm rounded-full border border-black/[0.05] bg-[#f3f4f8] pl-9 pr-3 text-body-sm outline-none focus:border-black/20 dark:border-white/[0.06] dark:bg-white/[0.06] dark:focus:border-white/20"
          />
        </div>
        <span className="hidden text-caption text-slate-400 sm:inline">{filtered.length} 个技能</span>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-8 items-center gap-1.5 rounded-full bg-black px-3 text-caption font-medium text-white shadow-sm dark:bg-white dark:text-black"
        >
          <Plus size={13} />
          新增技能
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        {loading ? (
          <p className="py-16 text-center text-body-sm text-slate-400">正在加载技能…</p>
        ) : loadError ? (
          <p className="py-16 text-center text-body-sm text-red-500">{loadError}</p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-body-sm text-slate-400">没有匹配的技能</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((skill) => (
              <div key={skill.id} className="group relative overflow-hidden rounded-2xl border border-black/[0.07] bg-white transition-all hover:border-black/20 dark:border-white/[0.08] dark:bg-[#161822] dark:hover:border-white/20">
                <button
                  type="button"
                  onClick={() => toggleFavorite(skill.id)}
                  className={`absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full backdrop-blur ${skill.favorite ? 'bg-amber-500 text-white' : 'bg-black/25 text-white/80 hover:bg-black/40'}`}
                  title={skill.favorite ? '取消收藏' : '收藏'}
                  aria-label={skill.favorite ? '取消收藏' : '收藏'}
                >
                  <Star size={13} fill={skill.favorite ? 'currentColor' : 'none'} />
                </button>
                <button type="button" onClick={() => setPicking(skill)} className="block w-full text-left">
                  <SkillCover skill={skill} />
                  <div className="p-3">
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 flex-1 truncate text-body font-medium">{skill.name}</p>
                      <span className="shrink-0 rounded bg-black/[0.05] px-1 py-0.5 text-[10px] text-slate-500 dark:bg-white/[0.08] dark:text-slate-300">
                        {skill.source === 'builtin' ? '内置' : '我的'}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-caption leading-relaxed text-slate-500 dark:text-slate-400">{skill.description}</p>
                    <p className="mt-2 text-[10.5px] text-slate-400">{skill.category} · {skill.model || '通用'} · {skill.slots.length} 个输入项</p>
                  </div>
                </button>
                <div className="flex items-center justify-end gap-1 border-t border-black/[0.05] px-2 py-1.5 dark:border-white/[0.06]">
                  <label className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-slate-400 hover:bg-black/[0.05] hover:text-slate-700 dark:hover:bg-white/[0.08] dark:hover:text-white" title="更换封面">
                    <ImagePlus size={13} />
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => { void changeCover(skill, event.target.files?.[0]); event.target.value = '' }} />
                  </label>
                  {skill.source === 'mine' && (
                    <button type="button" onClick={() => removeMine(skill.id)} className="flex h-7 w-7 items-center justify-center rounded-full text-red-500 hover:bg-red-500/10" title="删除技能">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      {picking && (
        <SkillPickerModal
          onClose={() => setPicking(null)}
          onApply={(skill, values) => { void apply(skill, values) }}
          detailOnly
          onSave={(skill) => {
            if (skill.source === 'builtin') setBuiltinOverride(skill.id, { basePrompt: skill.basePrompt })
            else updateMine(skill.id, { basePrompt: skill.basePrompt, updatedAt: Date.now() })
            setPicking(null)
          }}
          canReset={picking.source === 'builtin' && Boolean(overrides[picking.id]?.basePrompt)}
          onReset={() => {
            setBuiltinOverride(picking.id, { basePrompt: undefined })
            setPicking(null)
          }}
          activeSkillId={picking.id}
        />
      )}

      {creating && (
        <NewSkillModal
          onClose={() => setCreating(false)}
          onCreate={(skill) => { addMine(skill); setCreating(false) }}
        />
      )}
    </div>
  )
}

function SkillCover({ skill }: { skill: Skill }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    if (!skill.coverImageId) return
    let cancelled = false
    void ensureImageCached(skill.coverImageId).then((url) => { if (!cancelled && url) setSrc(url) })
    return () => { cancelled = true }
  }, [skill.coverImageId])
  return (
    <div className="relative flex h-28 items-center justify-center overflow-hidden" style={{ backgroundColor: skill.coverColor }}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : (
        <>
          <Sparkles size={18} className="mr-1.5 text-black/30" />
          <span className="text-body font-semibold text-black/55">{skill.name.slice(0, 8)}</span>
        </>
      )}
      {(skill.referenceImageIds?.length ?? 0) > 0 && (
        <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-1.5 py-0.5 font-mono text-[9px] text-white">
          {skill.referenceImageIds?.length} 图
        </span>
      )}
    </div>
  )
}

function NewSkillModal({ onClose, onCreate }: { onClose: () => void; onCreate: (skill: Skill) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('我的')
  const [model, setModel] = useState('')
  const [basePrompt, setBasePrompt] = useState('')
  const [error, setError] = useState('')
  const inputClass = 'h-8 w-full rounded-lg border border-black/10 bg-white px-2 text-body-sm outline-none focus:border-black/30 dark:border-white/15 dark:bg-black/20 dark:focus:border-white/30'

  const create = () => {
    if (!name.trim() || !basePrompt.trim()) {
      setError('请填写技能名称和基座提示词')
      return
    }
    const now = Date.now()
    const id = `mine:${crypto.randomUUID()}`
    onCreate({
      id,
      name: name.trim().slice(0, 40),
      description: description.trim().slice(0, 120),
      category: category.trim().slice(0, 20) || '我的',
      coverColor: skillCoverColor(id),
      basePrompt: basePrompt.trim(),
      slots: [],
      source: 'mine',
      model: model.trim() || undefined,
      favorite: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[480px] max-w-[94vw] rounded-2xl border border-black/10 bg-white p-4 text-slate-800 shadow-2xl dark:border-white/15 dark:bg-[#161822] dark:text-slate-100" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-body font-semibold">新增技能</h2>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]" aria-label="关闭"><X size={15} /></button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block"><span className="mb-1 block text-caption text-slate-500">名称</span><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：我的空间摄影" /></label>
          <label className="block"><span className="mb-1 block text-caption text-slate-500">一句话</span><input className={inputClass} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="这个技能解决什么问题" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-caption text-slate-500">分类</span><input className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-caption text-slate-500">适用模型</span><input className={inputClass} value={model} onChange={(event) => setModel(event.target.value)} placeholder="留空为通用" /></label>
          </div>
          <label className="block"><span className="mb-1 block text-caption text-slate-500">基座提示词</span><textarea className="min-h-28 w-full rounded-lg border border-black/10 bg-white p-2 text-body-sm outline-none focus:border-black/30 dark:border-white/15 dark:bg-black/20 dark:focus:border-white/30" value={basePrompt} onChange={(event) => setBasePrompt(event.target.value)} placeholder="技能的专业框架、镜头、材质、构图要求" /></label>
          {error && <p className="text-caption text-red-500">{error}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-8 rounded-lg px-3 text-body-sm text-slate-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">取消</button>
          <button type="button" onClick={create} className="h-8 rounded-lg bg-black px-3 text-body-sm text-white dark:bg-white dark:text-black">保存</button>
        </div>
      </div>
    </div>
  )
}
