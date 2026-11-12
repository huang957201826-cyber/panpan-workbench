import { useEffect, useMemo, useState } from 'react'
import { Search, Sparkles, X } from 'lucide-react'
import type { Skill, SkillSlot, SkillSlotValue } from '../../types'
import { createInputImageFromFile, useStore } from '../../store'
import { composeSkillPrompt, defaultSkillValues, loadBuiltinSkills, validateSkillValues } from '../../lib/capabilitySkills'
import { useCapabilitySkillStore, applySkillOverride } from '../../lib/capabilitySkillStore'
import { ensureImageCached } from '../../lib/imageCache'
import { Button } from '../../ui'

interface SkillPickerModalProps {
  onClose: () => void
  onApply: (skill: Skill, values: Record<string, SkillSlotValue>) => void
  onApplyAndGenerate?: (skill: Skill, values: Record<string, SkillSlotValue>) => void
  onSave?: (skill: Skill) => void
  onReset?: () => void
  canReset?: boolean
  detailOnly?: boolean
  activeSkillId?: string | null
  initialValues?: Record<string, SkillSlotValue>
}

export function SkillPickerModal({ onClose, onApply, onApplyAndGenerate, onSave, onReset, canReset = false, detailOnly = false, activeSkillId, initialValues }: SkillPickerModalProps) {
  const mine = useCapabilitySkillStore((s) => s.mine)
  const overrides = useCapabilitySkillStore((s) => s.builtinOverrides)
  const setReferenceImages = useCapabilitySkillStore((s) => s.setReferenceImages)
  const setCoverImage = useCapabilitySkillStore((s) => s.setCoverImage)
  const [builtin, setBuiltin] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('全部')
  const [selected, setSelected] = useState<Skill | null>(null)
  const [values, setValues] = useState<Record<string, SkillSlotValue>>({})
  const [basePrompt, setBasePrompt] = useState('')
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void loadBuiltinSkills()
      .then((skills) => { if (!cancelled) setBuiltin(skills) })
      .catch((err) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const skills = useMemo(() => [...mine, ...builtin.map((skill) => applySkillOverride(skill, overrides))], [mine, builtin, overrides])
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const skill of skills) counts.set(skill.category, (counts.get(skill.category) ?? 0) + 1)
    return counts
  }, [skills])
  const categories = useMemo(() => ['全部', ...categoryCounts.keys()], [categoryCounts])
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return skills.filter((skill) => {
      if (category !== '全部' && skill.category !== category) return false
      if (!keyword) return true
      return `${skill.name} ${skill.description} ${skill.category}`.toLowerCase().includes(keyword)
    })
  }, [skills, category, query])

  useEffect(() => {
    if (!activeSkillId) return
    const skill = skills.find((item) => item.id === activeSkillId)
    if (!skill) return
    setSelected(skill)
    setValues(initialValues ?? defaultSkillValues(skill))
    setBasePrompt(skill.basePrompt)
  }, [activeSkillId, initialValues, skills])

  const choose = (skill: Skill) => {
    setSelected(skill)
    setValues(defaultSkillValues(skill))
    setBasePrompt(skill.basePrompt)
    setPreviews({})
    setError('')
  }

  const setValue = (key: string, value: SkillSlotValue) => {
    setValues((previous) => ({ ...previous, [key]: value }))
    setError('')
  }

  const addImages = async (slot: SkillSlot, files: FileList | null) => {
    if (!files?.length) return
    const images = await Promise.all([...files].map((file) => createInputImageFromFile(file)))
    const valid = images.filter((image): image is NonNullable<typeof image> => Boolean(image))
    if (!valid.length) return
    const current = values[slot.key]
    const existing = Array.isArray(current) ? current : typeof current === 'string' && current ? [current] : []
    const next = slot.type === 'multi-image'
      ? [...new Set([...existing, ...valid.map((image) => image.id)])].slice(0, 6)
      : [valid[0].id]
    setValue(slot.key, next)
    setPreviews((previous) => ({ ...previous, ...Object.fromEntries(valid.map((image) => [image.id, image.dataUrl])) }))
  }

  const removeImage = async (slot: SkillSlot, imageId: string) => {
    const current = values[slot.key]
    const next = Array.isArray(current) ? current.filter((id) => id !== imageId) : []
    setValue(slot.key, next)
  }

  const apply = () => {
    if (!selected) return
    const errors = validateSkillValues(selected, values)
    if (errors.length) {
      setError(errors[0])
      return
    }
    onApply(selected, values)
  }

  const preview = selected ? composeSkillPrompt(selected, values, '') : ''

  const addReferenceFiles = async (skill: Skill, files: FileList | null) => {
    if (!files?.length) return
    const ids: string[] = []
    for (const file of Array.from(files)) {
      const image = await createInputImageFromFile(file)
      if (image) ids.push(image.id)
    }
    if (!ids.length) return
    const next = [...(skill.referenceImageIds ?? []), ...ids]
    setReferenceImages(skill.id, next)
    setSelected({ ...skill, referenceImageIds: next })
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        data-skill-picker
        style={{ height: 'min(640px, 86vh)' }}
        className="flex w-[880px] max-w-[96vw] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white text-slate-800 shadow-2xl dark:border-white/15 dark:bg-[#161822] dark:text-slate-100"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-black/[0.06] px-4 dark:border-white/[0.08]">
          <Sparkles size={16} className="text-slate-500" />
          <h2 className="text-body font-semibold">{detailOnly ? '技能详情' : '选用技能'}</h2>
          <button type="button" onClick={onClose} className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]" aria-label="关闭">
            <X size={15} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {!detailOnly && (
            <aside className="flex w-[170px] shrink-0 flex-col border-r border-black/[0.06] dark:border-white/[0.08]">
              <div className="px-3 pb-1 pt-3 text-caption font-medium text-slate-400">分类</div>
              <div data-skill-categories className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
                {categories.map((item) => {
                  const count = item === '全部' ? skills.length : categoryCounts.get(item) ?? 0
                  const active = category === item
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCategory(item)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-body-sm transition-colors ${
                        active
                          ? 'bg-black text-white dark:bg-white dark:text-black'
                          : 'text-slate-600 hover:bg-black/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      <span className="truncate">{item}</span>
                      <span className={`shrink-0 font-mono text-caption ${active ? 'text-white/60 dark:text-black/60' : 'text-slate-400'}`}>{count}</span>
                    </button>
                  )
                })}
              </div>
            </aside>
          )}

          {!detailOnly && (
            <div className="flex w-[300px] shrink-0 flex-col border-r border-black/[0.06] dark:border-white/[0.08]">
              <div className="shrink-0 px-3 pb-2 pt-3">
                <div className="relative">
                  <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索技能"
                    className="h-8 w-full rounded-lg border border-black/10 bg-white pl-8 pr-2 text-body-sm outline-none focus:border-black/30 dark:border-white/15 dark:bg-black/20 dark:focus:border-white/30"
                  />
                </div>
              </div>
              <div data-skill-list className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                {loading ? (
                  <p className="px-2 py-8 text-center text-body-sm text-slate-400">正在加载技能…</p>
                ) : loadError ? (
                  <p className="px-2 py-8 text-center text-body-sm text-red-500">{loadError}</p>
                ) : filtered.length === 0 ? (
                  <p className="px-2 py-8 text-center text-body-sm text-slate-400">没有匹配的技能</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {filtered.map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => choose(skill)}
                        className={`group overflow-hidden rounded-xl border text-left transition-all ${selected?.id === skill.id ? 'border-black/40 ring-1 ring-black/30 dark:border-white/40 dark:ring-white/30' : 'border-black/[0.08] hover:border-black/25 dark:border-white/[0.1] dark:hover:border-white/25'}`}
                      >
                        <div className="relative flex h-16 items-center justify-center" style={{ backgroundColor: skill.coverColor }}>
                          <span className="text-body font-semibold text-black/60">{skill.name.slice(0, 6)}</span>
                          {skill.source === 'builtin' && (
                            <span className="absolute left-1.5 top-1.5 rounded bg-black/20 px-1 py-0.5 text-[10px] text-black/60">内置</span>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="truncate text-body-sm font-medium">{skill.name}</p>
                          <p className="mt-0.5 line-clamp-2 text-caption text-slate-500 dark:text-slate-400">{skill.description}</p>
                          <p className="mt-1 text-[10px] text-slate-400">{skill.category}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={`flex min-w-0 flex-col ${detailOnly ? 'w-full' : 'flex-1'}`}>
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <Sparkles size={22} className="text-slate-300" />
                <p className="text-body text-slate-500">选择一个技能查看输入项</p>
                <p className="text-caption text-slate-400">应用后会合并成输入框里的一个技能胶囊。</p>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <h3 className="text-body font-semibold">{selected.name}</h3>
                  <p className="mt-1 text-caption leading-relaxed text-slate-500 dark:text-slate-400">{selected.description}</p>
                  {detailOnly && (
                    <label className="mt-3 block">
                      <span className="mb-1 flex items-center justify-between gap-2 text-caption text-slate-500">
                        <span>基座提示词</span>
                        {canReset && onReset && (
                          <button
                            type="button"
                            onClick={onReset}
                            className="rounded-full px-2 py-0.5 text-[11px] text-slate-400 hover:bg-black/[0.05] hover:text-slate-700 dark:hover:bg-white/[0.08] dark:hover:text-white"
                          >
                            恢复默认
                          </button>
                        )}
                      </span>
                      <textarea
                        value={basePrompt}
                        onChange={(event) => setBasePrompt(event.target.value)}
                        className="min-h-24 w-full rounded-lg border border-black/10 bg-white p-2 text-body-sm leading-relaxed outline-none focus:border-black/30 dark:border-white/15 dark:bg-black/20 dark:focus:border-white/30"
                      />
                    </label>
                  )}
                  {detailOnly && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-caption text-slate-500">主图 / 参考图</span>
                        <label className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-slate-400 hover:bg-black/[0.05] hover:text-slate-700 dark:hover:bg-white/[0.08] dark:hover:text-white">
                          + 添加图片
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              void addReferenceFiles(selected, event.target.files)
                              event.target.value = ''
                            }}
                          />
                        </label>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selected.coverImageId && (
                          <SkillAssetThumb
                            imageId={selected.coverImageId}
                            label="主图"
                            onRemove={() => {
                              setCoverImage(selected.id, undefined)
                              setSelected({ ...selected, coverImageId: undefined })
                            }}
                          />
                        )}
                        {(selected.referenceImageIds ?? []).map((imageId) => (
                          <SkillAssetThumb
                            key={imageId}
                            imageId={imageId}
                            label="参考"
                            onSetCover={() => {
                              setCoverImage(selected.id, imageId)
                              setSelected({ ...selected, coverImageId: imageId })
                            }}
                            onRemove={() => {
                              const next = (selected.referenceImageIds ?? []).filter((id) => id !== imageId)
                              setReferenceImages(selected.id, next)
                              setSelected({ ...selected, referenceImageIds: next })
                            }}
                          />
                        ))}
                        {!selected.coverImageId && !(selected.referenceImageIds ?? []).length && (
                          <span className="text-[11px] text-slate-400">还没有图片；可添加主图和参考图。</span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="mt-4 space-y-3">
                    {selected.slots.map((slot) => (
                      <SkillSlotField
                        key={slot.key}
                        slot={slot}
                        value={values[slot.key]}
                        previews={previews}
                        onChange={(value) => setValue(slot.key, value)}
                        onFiles={(files) => { void addImages(slot, files) }}
                        onRemoveImage={(imageId) => { void removeImage(slot, imageId) }}
                      />
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                    <p className="text-caption font-medium text-slate-500">最终提示词预览</p>
                    <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-caption leading-relaxed text-slate-600 dark:text-slate-300">{preview}</pre>
                  </div>
                  {error && <p className="mt-2 text-caption text-red-500">{error}</p>}
                </div>
                <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
                  <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
                  {detailOnly && onSave && selected && (
                    <Button variant="primary" size="sm" onClick={() => onSave({ ...selected, basePrompt })}>保存</Button>
                  )}
                  {!detailOnly && <Button variant="primary" size="sm" onClick={apply}>应用技能</Button>}
                  {!detailOnly && onApplyAndGenerate && (
                    <Button variant="secondary" size="sm" onClick={() => {
                      if (!selected) return
                      const errors = validateSkillValues(selected, values)
                      if (errors.length) {
                        setError(errors[0])
                        return
                      }
                      onApplyAndGenerate(selected, values)
                    }}>应用并生成</Button>
                  )}
                </footer>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SkillSlotField({ slot, value, previews, onChange, onFiles, onRemoveImage }: {
  slot: SkillSlot
  value: SkillSlotValue | undefined
  previews: Record<string, string>
  onChange: (value: SkillSlotValue) => void
  onFiles: (files: FileList | null) => void
  onRemoveImage: (imageId: string) => void
}) {
  const inputClass = 'h-8 w-full rounded-lg border border-black/10 bg-white px-2 text-body-sm outline-none focus:border-black/30 dark:border-white/15 dark:bg-black/20 dark:focus:border-white/30'

  if (slot.type === 'bool') {
    return (
      <label className="flex items-center gap-2 text-body-sm">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        {slot.label}
      </label>
    )
  }

  if (slot.type === 'enum') {
    return (
      <label className="block">
        <span className="mb-1 block text-caption text-slate-500">{slot.label}{slot.required ? ' *' : ''}</span>
        <select className={inputClass} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} aria-label={slot.label}>
          <option value="">请选择</option>
          {(slot.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    )
  }

  if (slot.type === 'multi') {
    const selected = Array.isArray(value) ? value : []
    return (
      <div>
        <span className="mb-1 block text-caption text-slate-500">{slot.label}{slot.required ? ' *' : ''}</span>
        <div className="flex flex-wrap gap-1.5">
          {(slot.options ?? []).map((option) => {
            const active = selected.includes(option)
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(active ? selected.filter((item) => item !== option) : [...selected, option])}
                className={`rounded-full px-2 py-1 text-caption transition-colors ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-black/[0.05] text-slate-600 dark:bg-white/[0.08] dark:text-slate-300'}`}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (slot.type === 'image' || slot.type === 'multi-image') {
    const selected = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []
    return (
      <div>
        <span className="mb-1 block text-caption text-slate-500">{slot.label}{slot.required ? ' *' : ''}</span>
        <div className="flex flex-wrap items-center gap-2">
          {selected.map((imageId) => (
            <SkillImageThumb key={imageId} imageId={imageId} src={previews[imageId]} onRemove={() => onRemoveImage(imageId)} />
          ))}
          {(slot.type === 'multi-image' || selected.length === 0) && (
            <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-lg border border-dashed border-black/20 text-caption text-slate-400 hover:border-black/40 dark:border-white/20 dark:hover:border-white/40">
              +
              <input type="file" accept="image/*" multiple={slot.type === 'multi-image'} className="hidden" onChange={(event) => { onFiles(event.target.files); event.target.value = '' }} />
            </label>
          )}
        </div>
        <p className="mt-1 text-[10px] text-slate-400">图片会加入参考图，随任务一起提交。</p>
      </div>
    )
  }

  return (
    <label className="block">
      <span className="mb-1 block text-caption text-slate-500">{slot.label}{slot.required ? ' *' : ''}</span>
      <input
        className={inputClass}
        type={slot.type === 'number' ? 'number' : 'text'}
        value={value === undefined || Array.isArray(value) ? '' : String(value)}
        placeholder={slot.placeholder}
        aria-label={slot.label}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function SkillAssetThumb({ imageId, label, onSetCover, onRemove }: {
  imageId: string
  label: string
  onSetCover?: () => void
  onRemove: () => void
}) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let cancelled = false
    void ensureImageCached(imageId).then((url) => { if (!cancelled) setSrc(url ?? '') })
    return () => { cancelled = true }
  }, [imageId])
  return (
    <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-black/[0.08] bg-black/[0.04] dark:border-white/[0.1] dark:bg-white/[0.05]">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null}
      <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">{label}</span>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent px-1 pb-1 pt-3">
        {onSetCover && (
          <button type="button" onClick={onSetCover} className="rounded bg-white/20 px-1 text-[9px] text-white hover:bg-white/35" title="设为主图">主图</button>
        )}
        <button type="button" onClick={onRemove} className="rounded bg-red-500/80 px-1 text-[9px] text-white hover:bg-red-500" title="移除">删除</button>
      </div>
    </div>
  )
}

function SkillImageThumb({ imageId, src: initialSrc, onRemove }: { imageId: string; src?: string; onRemove: () => void }) {
  const [src, setSrc] = useState(initialSrc ?? '')
  useEffect(() => {
    if (src) return
    void ensureImageCached(imageId).then((url) => { if (url) setSrc(url) })
  }, [imageId, src])
  return (
    <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse bg-black/[0.06]" />}
      <button type="button" onClick={onRemove} className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[10px] text-white" aria-label="移除图片">×</button>
    </div>
  )
}
