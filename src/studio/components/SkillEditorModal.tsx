import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { PromptSkill } from '../../types'
import { useSkillStore } from '../../lib/skillStore'
import { SKILL_CATEGORIES, type SkillCategory } from '../../lib/skillCategories'
import { normalizeSkillVariables } from '../../lib/promptSkills'
import { Select } from '../../ui'

function splitTags(value: string) {
  return [...new Set(value.split(/[,，\s]+/).map((tag) => tag.trim()).filter(Boolean))]
}

interface VariableDraft {
  key: string
  label: string
  defaultValue: string
  /** 编辑态用逗号分隔的字符串，保存时再拆成数组 */
  options: string
}

const emptyVariable = (): VariableDraft => ({ key: '', label: '', defaultValue: '', options: '' })

export function SkillEditorModal() {
  const editor = useSkillStore((s) => s.editor)
  const skills = useSkillStore((s) => s.skills)
  const addSkill = useSkillStore((s) => s.addSkill)
  const updateSkill = useSkillStore((s) => s.updateSkill)
  const close = useSkillStore((s) => s.closeSkillEditor)
  const editing = editor.skillId ? skills.find((skill) => skill.id === editor.skillId) : undefined
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [tags, setTags] = useState('')
  const [category, setCategory] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [author, setAuthor] = useState('')
  const [variables, setVariables] = useState<VariableDraft[]>([])
  const [includeParams, setIncludeParams] = useState(false)
  const [size, setSize] = useState('')
  const [quality, setQuality] = useState('')
  const [model, setModel] = useState('')
  const [count, setCount] = useState('1')

  useEffect(() => {
    if (!editor.open) return
    const source = editing ?? editor.seed
    setTitle(editing?.title ?? editor.seed?.title ?? '')
    setPrompt(editing?.prompt ?? editor.seed?.prompt ?? '')
    setTags((editing?.tags ?? editor.seed?.tags ?? []).join(', '))
    setCategory(editing?.category ?? editor.seed?.category ?? '')
    setNegativePrompt(editing?.negativePrompt ?? editor.seed?.negativePrompt ?? '')
    setAuthor(editing?.author ?? editor.seed?.author ?? '')
    setVariables((editing?.variables ?? editor.seed?.variables ?? []).map((item) => ({
      key: item.key,
      label: item.label,
      defaultValue: item.defaultValue,
      options: (item.options ?? []).join(', '),
    })))
    const params = source?.params
    setIncludeParams(Boolean(params && (params.size || params.quality || params.model || params.n)))
    setSize(params?.size ?? '')
    setQuality(params?.quality ?? '')
    setModel(params?.model ?? '')
    setCount(String(params?.n ?? 1))
  }, [editor.open, editor.skillId, editor.seed, editing])

  if (!editor.open) return null

  const changeVariable = (index: number, patch: Partial<VariableDraft>) => {
    setVariables((previous) => previous.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  const save = () => {
    if (!prompt.trim()) return
    const params = includeParams
      ? {
          ...(size.trim() ? { size: size.trim() } : {}),
          ...(quality.trim() ? { quality: quality.trim() } : {}),
          ...(model.trim() ? { model: model.trim() } : {}),
          ...(Number(count) > 0 ? { n: Math.max(1, Math.round(Number(count))) } : {}),
        }
      : undefined
    const variablesPayload = normalizeSkillVariables(variables.map((item) => ({
      key: item.key,
      label: item.label,
      defaultValue: item.defaultValue,
      options: item.options.split(/[,，]/).map((option) => option.trim()).filter(Boolean),
    })))
    const base = {
      title: title.trim() || prompt.trim().split(/\r?\n/)[0]?.slice(0, 40) || '未命名技能',
      prompt: prompt.trim(),
      tags: splitTags(tags),
      ...(category.trim() ? { category: category.trim() } : {}),
      params: params && Object.keys(params).length ? params : undefined,
      negativePrompt: negativePrompt.trim() || undefined,
      author: author.trim() || undefined,
      variables: variablesPayload.length ? variablesPayload : undefined,
      ...(editing?.sourceTaskId ?? editor.seed?.sourceTaskId ? { sourceTaskId: editing?.sourceTaskId ?? editor.seed?.sourceTaskId } : {}),
    }
    if (editing) {
      updateSkill(editing.id, base)
    } else {
      const skill: PromptSkill = {
        id: crypto.randomUUID(),
        ...base,
        ...(editor.seed?.coverImageId ? { coverImageId: editor.seed.coverImageId } : {}),
        ...(editor.seed?.favorite ? { favorite: true } : {}),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      addSkill(skill)
    }
    close()
  }

  const categoryOptions = [
    // 旧技能可能存着自由文本分类，编辑时保留原值，避免一打开就被强制改掉
    ...(category && !(SKILL_CATEGORIES as readonly string[]).includes(category)
      ? [{ value: category, label: `${category}（原分类）` }]
      : []),
    ...SKILL_CATEGORIES.map((item: SkillCategory) => ({ value: item, label: item })),
  ]

  const inputClass = 'h-9 w-full rounded-lg border border-black/10 bg-black/[0.03] px-3 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/[0.06]'
  const smallInputClass = 'h-8 w-full rounded-md border border-black/10 bg-black/[0.03] px-2 outline-none dark:border-white/10 dark:bg-white/[0.06]'

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" onClick={close}>
      <div
        className="flex max-h-[86vh] w-full max-w-2xl flex-col rounded-2xl border border-black/10 bg-white p-5 text-slate-800 shadow-2xl dark:border-white/10 dark:bg-[#161822] dark:text-slate-100"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? '编辑技能' : '保存为技能'}
      >
        <h3 className="shrink-0 text-[15px] font-semibold">{editing ? '编辑技能' : '保存为技能'}</h3>
        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-body-sm">
          <label className="block">
            <span className="mb-1 block text-slate-500 dark:text-slate-400">名称</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="例如：商业空间夜景" />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-500 dark:text-slate-400">提示词（可用 {'{{key}}'} 放参数槽）</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} className="w-full resize-y rounded-lg border border-black/10 bg-black/[0.03] p-3 leading-relaxed outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/[0.06]" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-slate-500 dark:text-slate-400">标签（逗号分隔）</span>
              <input value={tags} onChange={(event) => setTags(event.target.value)} className={inputClass} />
            </label>
            <div>
              <span className="mb-1 block text-slate-500 dark:text-slate-400">分类</span>
              <Select value={category} label="技能分类" placeholder="未分类" options={categoryOptions} onChange={setCategory} className="w-full justify-between" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-slate-500 dark:text-slate-400">作者</span>
              <input value={author} onChange={(event) => setAuthor(event.target.value)} className={inputClass} placeholder="本地" />
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-500 dark:text-slate-400">负向提示词（合成时拼到提示词尾部）</span>
              <input value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} className={inputClass} placeholder="不要文字、不要水印" />
            </label>
          </div>

          <div className="rounded-lg border border-black/[0.08] p-3 dark:border-white/[0.1]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">参数槽 · 调用时可在详情里替换</span>
              <button type="button" onClick={() => setVariables((previous) => [...previous, emptyVariable()])} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
                <Plus size={13} /> 添加
              </button>
            </div>
            {variables.length === 0 ? (
              <p className="text-slate-400 dark:text-slate-500">暂无参数槽，提示词会原样注入。</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_24px] gap-1.5 text-caption text-slate-400">
                  <span>key</span><span>显示名</span><span>默认值</span><span>选项（逗号分隔）</span><span />
                </div>
                {variables.map((item, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_1fr_1fr_24px] items-center gap-1.5">
                    <input value={item.key} onChange={(event) => changeVariable(index, { key: event.target.value })} placeholder="room" className={smallInputClass} />
                    <input value={item.label} onChange={(event) => changeVariable(index, { label: event.target.value })} placeholder="空间" className={smallInputClass} />
                    <input value={item.defaultValue} onChange={(event) => changeVariable(index, { defaultValue: event.target.value })} placeholder="明亮" className={smallInputClass} />
                    <input value={item.options} onChange={(event) => changeVariable(index, { options: event.target.value })} placeholder="明亮,昏暗" className={smallInputClass} />
                    <button type="button" aria-label="删除参数槽" onClick={() => setVariables((previous) => previous.filter((_, i) => i !== index))} className="flex h-8 w-6 items-center justify-center text-slate-400 hover:text-red-500">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={includeParams} onChange={(event) => setIncludeParams(event.target.checked)} className="accent-blue-500" />
            同时保存生成参数
          </label>
          {includeParams && (
            <div className="grid grid-cols-4 gap-2">
              <input value={size} onChange={(event) => setSize(event.target.value)} placeholder="尺寸" className={smallInputClass} />
              <input value={quality} onChange={(event) => setQuality(event.target.value)} placeholder="质量" className={smallInputClass} />
              <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="模型" className={smallInputClass} />
              <input value={count} onChange={(event) => setCount(event.target.value)} type="number" min={1} placeholder="数量" className={smallInputClass} />
            </div>
          )}
        </div>
        <div className="mt-4 flex shrink-0 justify-end gap-2 text-body-sm">
          <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 text-slate-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">取消</button>
          <button type="button" onClick={save} disabled={!prompt.trim()} className="rounded-lg bg-black px-3 py-1.5 text-white disabled:opacity-40 dark:bg-white dark:text-black">保存</button>
        </div>
      </div>
    </div>
  )
}
