import { Star } from 'lucide-react'
import type { PromptSkill } from '../../../types'
import { skillCoverStyle } from '../../../lib/skillCategories'
import { skillCategoryOf } from '../../../lib/promptSkills'
import { ArtboardThumb } from '../ArtboardThumb'

interface SkillCoverProps {
  skill: PromptSkill
  /** 传了才显示收藏星；详情弹窗里也想展示四角信息但不需要星标 */
  onToggleFavorite?: () => void
}

/** 16:9 封面：有图用任务输出图，没有就按 id 生成确定性双色渐变 + 点阵，避免一片灰块 */
export function SkillCover({ skill, onToggleFavorite }: SkillCoverProps) {
  const category = skillCategoryOf(skill)
  const model = skill.params?.model || '通用底模'
  const slotCount = skill.variables?.length ?? 0

  return (
    <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-surface-2">
      {skill.coverImageId ? (
        <ArtboardThumb
          imageId={skill.coverImageId}
          alt={skill.title}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full" style={skillCoverStyle(skill.id)} />
      )}

      {/* 底部渐变保证四角文字在任意封面上都可读 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/75 to-transparent" />

      <span className="absolute left-2 top-2 flex h-5 items-center rounded-chip bg-black/60 px-2 text-caption font-medium text-white/95 backdrop-blur-md">
        {category}
      </span>

      {onToggleFavorite && (
        <button
          type="button"
          aria-label={skill.favorite ? '取消收藏' : '收藏'}
          aria-pressed={Boolean(skill.favorite)}
          onClick={(event) => {
            // 星标不能触发卡片打开
            event.stopPropagation()
            onToggleFavorite()
          }}
          className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-black/25 hover:text-white"
        >
          <Star size={16} strokeWidth={1.6} className={skill.favorite ? 'fill-amber-400 text-amber-400' : ''} />
        </button>
      )}

      <span className="absolute bottom-2 left-2.5 font-mono text-caption text-white/90">{model}</span>
      <span className="absolute bottom-2 right-2.5 font-mono text-caption text-white/60">{slotCount} 参数槽</span>
    </div>
  )
}
