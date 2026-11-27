import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, ChevronDown, Plus, Sparkles, Trash2, X } from 'lucide-react'
import type { GenerationParams } from '../types'
import type { Skill, SkillSlotValue } from '../../types'
import { useStore } from '../../store'
import { Menu as PopMenu } from '../../ui'
import { loadBuiltinSkills, skillSlotImageIds } from '../../lib/capabilitySkills'
import { useCapabilitySkillStore } from '../../lib/capabilitySkillStore'
import { useSkillStore } from '../../lib/skillStore'
import { buildRegisteredSkillCatalog, resolveRegisteredSkill } from '../../lib/skillRegistry'
import { ensureImageCached } from '../../lib/imageCache'
import { addImageFileToCanvas } from '../../lib/canvasImageInput'
import { useWorkspaceStore } from '../../lib/workspaceStore'
import { STUDIO_FORMATS } from '../constants'
import { SkillPickerModal } from './SkillPickerModal'

interface HomeHubViewProps {
  modelOptions: Array<{ id: string; label: string }>
  params: GenerationParams
  sizeOptions: Array<{ label: string; res: string }>
  countOptions: number[]
  onParamsChange: (params: GenerationParams) => void
  onGenerate: (prompt: string, params: GenerationParams) => void
  onAddReferenceFile?: (file: File) => Promise<void> | void
  isGenerating: boolean
}

const QUALITY_OPTIONS = ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] as const

/** 首页灵感中心：中央输入岛 + 模型/尺寸/数量/格式/质量 + 技能入口 */
export function HomeHubView({
  modelOptions,
  params,
  sizeOptions,
  countOptions,
  onParamsChange,
  onGenerate,
  onAddReferenceFile,
  isGenerating,
}: HomeHubViewProps) {
  const [prompt, setPrompt] = useState('')
  const [focused, setFocused] = useState(false)
  const [showSkillPicker, setShowSkillPicker] = useState(false)
  const [builtinSkills, setBuiltinSkills] = useState<Skill[]>([])
  const [activeMenu, setActiveMenu] = useState<'model' | 'size' | 'count' | 'format' | 'quality' | null>(null)
  const modelRef = useRef<HTMLButtonElement>(null)
  const sizeRef = useRef<HTMLButtonElement>(null)
  const countRef = useRef<HTMLButtonElement>(null)
  const formatRef = useRef<HTMLButtonElement>(null)
  const qualityRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputImages = useStore((s) => s.inputImages)
  const removeInputImage = useStore((s) => s.removeInputImage)
  const clearInputImages = useStore((s) => s.clearInputImages)
  const activeSkillId = useStore((s) => s.activeSkillId)
  const skillSlotValues = useStore((s) => s.skillSlotValues)
  const setActiveSkillId = useStore((s) => s.setActiveSkillId)
  const setSkillSlotValues = useStore((s) => s.setSkillSlotValues)
  const clearSkillChip = useStore((s) => s.clearSkillChip)
  const mineSkills = useCapabilitySkillStore((s) => s.mine)
  const promptSkills = useSkillStore((s) => s.skills)
  const skillOverrides = useCapabilitySkillStore((s) => s.builtinOverrides)
  const activeSkill = resolveRegisteredSkill(buildRegisteredSkillCatalog({
    promptSkills,
    capabilitySkills: mineSkills,
    builtinSkills,
    overrides: skillOverrides,
  }), activeSkillId)
  const canGenerate = Boolean(prompt.trim() || activeSkillId) && !isGenerating
  const sizeLabel = sizeOptions.find((item) => item.res === params.dimension)?.label ?? params.dimension

  useEffect(() => {
    let cancelled = false
    void loadBuiltinSkills()
      .then((skills) => { if (!cancelled) setBuiltinSkills(skills) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const submit = (nextParams = params) => {
    if (!canGenerate) return
    onGenerate(prompt.trim(), nextParams)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target
    const files = inputEl.files ? Array.from(inputEl.files) : []
    if (files.length === 0) {
      inputEl.value = ''
      return
    }
    try {
      for (const file of files) {
        if (onAddReferenceFile) {
          await onAddReferenceFile(file)
        } else {
          await addImageFileToCanvas(useWorkspaceStore.getState().activeCanvasId, file)
        }
      }
    } finally {
      inputEl.value = ''
    }
  }

  const insertImageTag = (tagNum: number) => {
    const tag = `@图${tagNum} `
    const el = textareaRef.current
    if (!el) {
      setPrompt((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${tag}`)
      return
    }
    const start = el.selectionStart ?? prompt.length
    const end = el.selectionEnd ?? prompt.length
    const next = prompt.slice(0, start) + tag + prompt.slice(end)
    setPrompt(next)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(start + tag.length, start + tag.length)
      }
    }, 10)
  }

  const applySkill = async (skill: Skill, values: Record<string, SkillSlotValue>) => {
    for (const imageId of skillSlotImageIds(skill, values)) {
      if (useStore.getState().inputImages.some((image) => image.id === imageId)) continue
      const dataUrl = await ensureImageCached(imageId)
      if (dataUrl) useStore.getState().addInputImage({ id: imageId, dataUrl })
    }
    setActiveSkillId(skill.registryId ?? skill.id)
    setSkillSlotValues(values)
    setShowSkillPicker(false)
  }

  return (
    <div className="relative flex h-full w-full select-none flex-col items-center justify-center overflow-hidden bg-[#f3f4f8] px-6 transition-colors dark:bg-[#0c0e14]">
      <div data-home-glow className="pointer-events-none absolute left-1/2 top-1/3 h-[340px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-slate-400/[0.07] via-slate-300/[0.04] to-transparent blur-3xl" />

      <div data-home-stage className="relative z-10 flex w-full max-w-[780px] -translate-y-6 flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.04] bg-black/[0.03] px-3 py-0.5 text-[10.5px] font-mono uppercase tracking-widest text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.05] dark:text-slate-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            <span>Panpan Studio · Image Engine</span>
          </div>
          <h1 className="font-display text-balance bg-gradient-to-br from-slate-950 via-slate-800 to-slate-500 bg-clip-text text-[26px] font-black leading-[1.18] tracking-tight text-transparent drop-shadow-sm dark:from-white dark:via-slate-200 dark:to-slate-500 sm:text-[34px] lg:text-[42px]">
            让每一个画面构想，在此精准呈现
          </h1>
          <p className="max-w-md text-[13.5px] leading-relaxed tracking-wide text-slate-600 dark:text-slate-400 sm:text-[14px]">
            输入一段画面描述，秒级生成高保真图像
          </p>
        </div>

        <input
          id="home-prompt-ref-upload"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => { void handleFileUpload(e) }}
          className="sr-only"
        />

        <div
          className={`flex w-full flex-col gap-3 sm:gap-4 rounded-[24px] border bg-white p-4 sm:p-6 transition-all duration-200 dark:bg-[#141620] ${
            focused
              ? 'scale-[1.006] border-black/15 shadow-[0_20px_48px_rgba(15,23,42,0.13)] ring-2 ring-black/[0.03] dark:border-white/20 dark:ring-white/[0.04]'
              : 'border-black/[0.05] shadow-[0_10px_30px_-4px_rgba(15,23,42,0.05),0_2px_6px_-1px_rgba(15,23,42,0.02)] dark:border-white/[0.06]'
          }`}
        >
          {inputImages.length > 0 && (
            <div
              data-home-reference-shelf
              className="flex flex-col gap-1.5 rounded-xl border border-black/[0.05] bg-black/[0.02] px-3 py-2 dark:border-white/[0.07] dark:bg-white/[0.03]"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="truncate font-medium">
                  已添加 {inputImages.length} 张参考图 · 将随提示词一起发送并同步至工作台画布（点击缩略图插入 @图N）
                </span>
                <button
                  type="button"
                  onClick={clearInputImages}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-black/[0.06] hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-slate-200 transition cursor-pointer"
                  title="清空全部参考图"
                >
                  <Trash2 className="w-3 h-3 stroke-[1.5]" />
                  <span>清空</span>
                </button>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5 pb-0.5">
                {inputImages.map((img, idx) => (
                  <div key={img.id} className="relative group shrink-0">
                    <div
                      onClick={() => insertImageTag(idx + 1)}
                      className="w-[52px] h-[52px] rounded-xl overflow-hidden border border-black/15 dark:border-white/20 bg-black/5 dark:bg-white/5 shadow-sm relative cursor-pointer hover:scale-105 transition-all duration-150"
                      title={`点击在提示词插入 @图${idx + 1}`}
                    >
                      <img
                        src={img.dataUrl}
                        alt={`图${idx + 1}`}
                        className="w-full h-full object-cover pointer-events-none"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-1 left-1 min-w-4 rounded-full bg-black/80 px-1 text-white flex items-center justify-center text-caption font-mono font-bold shadow-xs">
                        图{idx + 1}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeInputImage(idx)
                      }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black/85 text-white hover:bg-red-600 flex items-center justify-center opacity-85 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs text-caption"
                      title="移除该参考图"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label
                  htmlFor="home-prompt-ref-upload"
                  className="w-[52px] h-[52px] rounded-xl border border-dashed border-black/20 dark:border-white/20 hover:border-black/40 dark:hover:border-white/40 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] flex flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer shrink-0"
                  title="继续添加参考图"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[1.6]" />
                  <span className="text-caption">添加</span>
                </label>
              </div>
            </div>
          )}

          {activeSkill && (
            <div className="flex px-1">
              <span className="inline-flex max-w-[280px] items-center gap-1 rounded-full bg-black/[0.06] py-0.5 pl-2 pr-1 text-caption text-slate-600 dark:bg-white/[0.09] dark:text-slate-300">
                <Sparkles className="h-3 w-3 shrink-0 opacity-70" />
                <span className="truncate font-medium">{activeSkill.name}</span>
                <button
                  type="button"
                  onClick={clearSkillChip}
                  className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/15"
                  title="移除技能（保留输入文字）"
                  aria-label="移除技能"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(event) => {
              const next = event.target.value
              setPrompt(next)
              if (!next.trim() && activeSkillId) clearSkillChip()
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                submit()
              }
            }}
            rows={3}
            placeholder="描述你想要的画面，例如：清晨的玻璃中庭，斜射天光，极简建筑摄影，8K 细节…"
            className="w-full resize-none border-none bg-transparent p-1 text-[15px] leading-relaxed text-slate-900 outline-none placeholder-slate-400 no-scrollbar dark:text-slate-100"
            autoFocus
          />

          <div className="flex flex-col gap-2.5 border-t border-black/[0.04] pt-3 dark:border-white/[0.05] sm:flex-row sm:items-center sm:gap-2">
            <div className="flex min-w-0 w-full items-center gap-2 overflow-x-auto no-scrollbar sm:flex-1">
              <div className="relative shrink-0">
                <button
                  ref={modelRef}
                  type="button"
                  onClick={() => setActiveMenu(activeMenu === 'model' ? null : 'model')}
                  className="flex h-7 items-center gap-1 rounded-full bg-black/[0.04] px-2.5 text-caption font-medium text-slate-700 transition hover:bg-black/[0.07] dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.1]"
                >
                  <span className="max-w-[120px] truncate font-mono">{params.model}</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>
                <PopMenu open={activeMenu === 'model'} anchorRef={modelRef} width={220} onClose={() => setActiveMenu(null)}>
                  {modelOptions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onParamsChange({ ...params, model: item.id })
                        setActiveMenu(null)
                      }}
                      className={`w-full rounded-md px-2 py-1 text-left text-caption transition ${
                        params.model === item.id
                          ? 'bg-black/[0.08] font-medium text-slate-900 dark:bg-white/[0.12] dark:text-white'
                          : 'text-slate-700 hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </PopMenu>
              </div>

              <div className="relative shrink-0">
                <button
                  ref={sizeRef}
                  type="button"
                  onClick={() => setActiveMenu(activeMenu === 'size' ? null : 'size')}
                  className="flex h-7 max-w-[240px] items-center gap-1 rounded-full bg-black/[0.04] px-2.5 text-caption font-medium text-slate-700 transition hover:bg-black/[0.07] dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.1]"
                >
                  <span className="truncate font-mono">{sizeLabel}</span>
                  <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
                </button>
                <PopMenu open={activeMenu === 'size'} anchorRef={sizeRef} width={260} onClose={() => setActiveMenu(null)}>
                  {sizeOptions.map((item) => (
                    <button
                      key={item.res}
                      type="button"
                      onClick={() => {
                        onParamsChange({ ...params, dimension: item.res })
                        setActiveMenu(null)
                      }}
                      className={`w-full rounded-md px-2 py-1 text-left text-caption transition ${
                        params.dimension === item.res
                          ? 'bg-black/[0.08] font-medium text-slate-900 dark:bg-white/[0.12] dark:text-white'
                          : 'text-slate-700 hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </PopMenu>
              </div>

              <div className="relative shrink-0">
                <button
                  ref={countRef}
                  type="button"
                  onClick={() => setActiveMenu(activeMenu === 'count' ? null : 'count')}
                  className="flex h-7 items-center gap-1 rounded-full bg-black/[0.04] px-2.5 text-caption font-medium text-slate-700 transition hover:bg-black/[0.07] dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.1]"
                >
                  <span className="text-slate-400">数量</span>
                  <span>{params.count}</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>
                <PopMenu open={activeMenu === 'count'} anchorRef={countRef} width={96} onClose={() => setActiveMenu(null)}>
                  {countOptions.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => {
                        onParamsChange({ ...params, count })
                        setActiveMenu(null)
                      }}
                      className={`w-full rounded-md px-2 py-1 text-left text-caption transition ${
                        params.count === count
                          ? 'bg-black/[0.08] font-medium text-slate-900 dark:bg-white/[0.12] dark:text-white'
                          : 'text-slate-700 hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/10'
                      }`}
                    >
                      {count} 张
                    </button>
                  ))}
                </PopMenu>
              </div>

              <div className="relative shrink-0">
                <button
                  ref={formatRef}
                  type="button"
                  onClick={() => setActiveMenu(activeMenu === 'format' ? null : 'format')}
                  className="flex h-7 items-center gap-1 rounded-full bg-black/[0.04] px-2.5 text-caption font-medium text-slate-700 transition hover:bg-black/[0.07] dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.1]"
                >
                  <span className="text-slate-400">格式</span>
                  <span className="font-mono">{params.format}</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>
                <PopMenu open={activeMenu === 'format'} anchorRef={formatRef} width={112} onClose={() => setActiveMenu(null)}>
                  {STUDIO_FORMATS.map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => {
                        onParamsChange({ ...params, format })
                        setActiveMenu(null)
                      }}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-caption transition ${
                        params.format === format
                          ? 'bg-black/[0.08] font-medium text-slate-900 dark:bg-white/[0.12] dark:text-white'
                          : 'text-slate-700 hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/10'
                      }`}
                    >
                      <span className="font-mono">{format}</span>
                      {params.format === format ? <Check className="h-3 w-3" /> : null}
                    </button>
                  ))}
                  {(params.format === 'GIF' || params.format === 'SVG') && (
                    <p className="px-2 pb-1 pt-1.5 text-caption leading-relaxed text-slate-400">
                      {params.format === 'GIF' ? '本地转换；GIF 最长边上限 2048px，超出等比缩小。' : '本地转换；SVG 内嵌位图。'}
                    </p>
                  )}
                </PopMenu>
              </div>

              <div className="relative shrink-0">
                <button
                  ref={qualityRef}
                  type="button"
                  onClick={() => setActiveMenu(activeMenu === 'quality' ? null : 'quality')}
                  className="flex h-7 items-center gap-1 rounded-full bg-black/[0.04] px-2.5 text-caption font-medium text-slate-700 transition hover:bg-black/[0.07] dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.1]"
                >
                  <span className="text-slate-400">质量</span>
                  <span className="font-mono">{params.quality}</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>
                <PopMenu open={activeMenu === 'quality'} anchorRef={qualityRef} width={112} onClose={() => setActiveMenu(null)}>
                  {QUALITY_OPTIONS.map((quality) => (
                    <button
                      key={quality}
                      type="button"
                      onClick={() => {
                        onParamsChange({ ...params, quality })
                        setActiveMenu(null)
                      }}
                      className={`w-full rounded-md px-2 py-1 text-left text-caption font-mono transition ${
                        params.quality === quality
                          ? 'bg-black/[0.08] font-medium text-slate-900 dark:bg-white/[0.12] dark:text-white'
                          : 'text-slate-700 hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/10'
                      }`}
                    >
                      {quality}
                    </button>
                  ))}
                </PopMenu>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2">
            <label
              htmlFor="home-prompt-ref-upload"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              className="flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-black/[0.04] px-3 text-caption text-slate-600 transition hover:bg-black/[0.08] dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.12]"
              title="添加本地参考图（同步加入画布并随提示词发送）"
              aria-label="添加本地参考图"
            >
              <Plus className="h-3.5 w-3.5 stroke-[1.8]" />
              <span>参考图{inputImages.length > 0 ? `(${inputImages.length})` : ''}</span>
            </label>

            <button
              type="button"
              onClick={() => setShowSkillPicker(true)}
              className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-black/[0.04] px-2.5 text-caption text-slate-600 transition hover:bg-black/[0.08] dark:bg-white/[0.07] dark:text-slate-200 dark:hover:bg-white/[0.12]"
              title="选用技能"
              aria-label="选用技能"
            >
              <Sparkles className="h-3.5 w-3.5 stroke-[1.8]" />
            </button>

            <button
              type="button"
              onClick={() => submit()}
              disabled={!canGenerate}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-black px-5 text-[12px] font-medium text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-25 dark:bg-white dark:text-black"
            >
              {isGenerating ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black" />
                  <span>生成中…</span>
                </>
              ) : (
                <>
                  <span>立即生成</span>
                  <ArrowUp className="h-3.5 w-3.5" />
                </>
              )}
            </button>
            </div>
          </div>
        </div>
      </div>

      {showSkillPicker && (
        <SkillPickerModal
          onClose={() => setShowSkillPicker(false)}
          onApply={(skill, values) => { void applySkill(skill, values) }}
          onApplyAndGenerate={(skill, values) => {
            void applySkill(skill, values).then(() => onGenerate(prompt.trim(), params))
          }}
          activeSkillId={activeSkillId}
          initialValues={skillSlotValues}
        />
      )}
    </div>
  )
}
