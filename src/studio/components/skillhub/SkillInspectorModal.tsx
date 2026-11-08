import { useEffect, useState } from 'react'
import { Check, Copy, Pencil, Trash2, Zap } from 'lucide-react'
import type { PromptSkill } from '../../../types'
import {
  composeSkillPrompt,
  defaultSkillVariableValues,
  skillCategoryOf,
} from '../../../lib/promptSkills'
import { useSkillStore } from '../../../lib/skillStore'
import { Button, Chip, Modal, Select } from '../../../ui'
import { SkillCover } from './SkillCover'

interface SkillInspectorModalProps {
  skill: PromptSkill | null
  onClose: () => void
  /** 注入当前合成后的提示词，不自动提交生成 */
  onApply: (prompt: string) => void
  onDelete: (skill: PromptSkill) => void
}

/** 详情 Inspector：左封面与元信息，右参数槽与实时合成提示词 */
export function SkillInspectorModal({ skill, onClose, onApply, onDelete }: SkillInspectorModalProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setValues(skill ? defaultSkillVariableValues(skill) : {})
    setCopied(false)
  }, [skill?.id])

  const composed = skill ? composeSkillPrompt(skill, values) : ''
  const variables = skill?.variables ?? []

  const copy = () => {
    void navigator.clipboard.writeText(composed)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  // 编辑交给 store 驱动的 SkillEditorModal；先关详情，避免两层弹窗叠加与焦点陷阱冲突
  const edit = () => {
    if (!skill) return
    useSkillStore.getState().openEditSkill(skill.id)
    onClose()
  }

  return (
    <Modal
      open={Boolean(skill)}
      onClose={onClose}
      width={720}
      title={
        <span className="flex min-w-0 items-center gap-2">
          <Chip active>{skill ? skillCategoryOf(skill) : ''}</Chip>
          <span className="truncate">{skill?.title ?? ''}</span>
        </span>
      }
      footer={
        <>
          <Button variant="danger" size="md" onClick={() => { if (skill) onDelete(skill) }} className="mr-auto">
            <Trash2 size={14} />
            删除技能
          </Button>
          <Button variant="secondary" size="md" onClick={edit}>
            <Pencil size={14} />
            编辑
          </Button>
          <Button variant="secondary" size="md" onClick={onClose}>关闭</Button>
          <Button variant="primary" size="md" onClick={() => onApply(composed)}>
            <Zap size={14} />
            注入到当前工作区
          </Button>
        </>
      }
    >
      {skill && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* 左栏：封面 + 配方原文 + 元信息 */}
          <div className="min-w-0 space-y-3">
            <div className="overflow-hidden rounded-card border border-line">
              <SkillCover skill={skill} />
            </div>
            <div>
              <p className="mb-1 text-caption font-semibold text-ink-3">配方原文</p>
              <p className="line-clamp-5 whitespace-pre-wrap text-body-sm leading-relaxed text-ink-2">{skill.prompt}</p>
            </div>
            <dl className="space-y-1.5 text-body-sm">
              {[
                ['推荐底模', skill.params?.model || '通用底模'],
                ['参数槽', `${variables.length} 个`],
                ['作者', skill.author || '本地'],
                ['使用次数', `${skill.usageCount ?? 0} 次`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-2 border-b border-line pb-1.5">
                  <dt className="text-ink-3">{label}</dt>
                  <dd className="truncate font-mono text-caption text-ink-1">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* 右栏：参数槽 + 实时合成 + 负向词 */}
          <div className="min-w-0 space-y-3">
            <div>
              <p className="mb-2 text-caption font-semibold text-ink-3">参数槽</p>
              {variables.length === 0 ? (
                <p className="rounded-control bg-surface-2 px-3 py-2 text-caption text-ink-3">这条配方没有参数槽，可直接调用。</p>
              ) : (
                <div className="space-y-2">
                  {variables.map((variable) => (
                    <label key={variable.key} className="block">
                      <span className="mb-1 block text-caption text-ink-2">
                        {variable.label}
                        <span className="ml-1 font-mono text-ink-3">{'{{'}{variable.key}{'}}'}</span>
                      </span>
                      {variable.options?.length ? (
                        <Select
                          value={values[variable.key] ?? variable.defaultValue}
                          label={variable.label}
                          options={variable.options.map((option) => ({ value: option, label: option }))}
                          onChange={(next) => setValues((previous) => ({ ...previous, [variable.key]: next }))}
                          className="w-full justify-between"
                        />
                      ) : (
                        <input
                          value={values[variable.key] ?? variable.defaultValue}
                          onChange={(event) => setValues((previous) => ({ ...previous, [variable.key]: event.target.value }))}
                          className="h-8 w-full rounded-control border border-line bg-surface-2 px-2.5 text-body-sm text-ink-1 outline-none focus:border-brand"
                        />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-caption font-semibold text-ink-3">合成后的提示词</p>
                <Button variant="ghost" size="sm" onClick={copy}>
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  {copied ? '已复制' : '复制'}
                </Button>
              </div>
              <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-control border border-line bg-surface-2 p-2.5 text-caption leading-relaxed text-ink-1">{composed}</pre>
            </div>

            {skill.negativePrompt?.trim() && (
              <div className="rounded-control border border-danger/25 bg-danger/[0.06] p-2.5">
                <p className="mb-1 text-caption font-semibold text-danger">负向提示词</p>
                <p className="whitespace-pre-wrap text-caption leading-relaxed text-ink-2">{skill.negativePrompt}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
