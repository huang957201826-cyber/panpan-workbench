import type { MouseEvent } from 'react'
import { Check, Copy, Trash2, Zap } from 'lucide-react'
import type { PromptSkill } from '../../../types'
import { Button, Card, Chip } from '../../../ui'
import { SkillCover } from './SkillCover'

interface SkillCardProps {
  skill: PromptSkill
  copied: boolean
  onOpen: () => void
  onToggleFavorite: () => void
  onCopy: () => void
  onApply: () => void
  onDelete: (skill: PromptSkill) => void
}

export function SkillCard({ skill, copied, onOpen, onToggleFavorite, onCopy, onApply, onDelete }: SkillCardProps) {
  const stop = (event: MouseEvent, action: () => void) => {
    event.stopPropagation()
    action()
  }

  return (
    <Card onClick={onOpen} className="group flex flex-col overflow-hidden">
      <div className="overflow-hidden">
        <div className="transition-transform duration-200 group-hover:scale-[1.02]">
          <SkillCover skill={skill} onToggleFavorite={onToggleFavorite} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="truncate text-body font-semibold text-ink-1" title={skill.title}>{skill.title}</h3>
        <p className="line-clamp-2 min-h-[34px] whitespace-pre-wrap text-body-sm leading-[1.5] text-ink-2">{skill.prompt}</p>
        <div className="flex flex-wrap gap-1">
          {skill.tags.slice(0, 3).map((tag) => (
            <Chip key={tag} className="max-w-[120px] truncate">#{tag}</Chip>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-3 py-2.5">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => stop(event, onCopy)}
            className="-ml-1.5"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copied ? '已复制' : '复制配方'}
          </Button>
          <button
            type="button"
            aria-label="删除技能"
            onClick={(event) => stop(event, () => onDelete(skill))}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-danger transition-colors duration-fast hover:bg-danger/10"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={(event) => stop(event, onApply)}
          className="rounded-full"
        >
          <Zap size={14} />
          一键调用
        </Button>
      </div>
    </Card>
  )
}
