import type { ReactNode } from 'react'

/** 基础骨架块：微光扫过，颜色跟随设计令牌，深浅主题都成立 */
export function Skeleton({ className = '', rounded = 'rounded-control' }: { className?: string; rounded?: string }) {
  return <div aria-hidden="true" className={`skeleton-shimmer bg-surface-2 ${rounded} ${className}`} />
}

/** 16:9 封面卡骨架，与技能库 / 九宫格卡片同构 */
export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="aspect-[16/9] w-full">
        <Skeleton className="h-full w-full" rounded="rounded-none" />
      </div>
      <div className="space-y-2 p-3">
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-2.5 w-4/5" />
        <div className="flex items-center gap-2 pt-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
    </div>
  )
}

interface SkeletonGridProps {
  count?: number
  className?: string
  label?: string
  /** 需要额外包一层时（例如带标题的视图）传入 */
  children?: ReactNode
}

/** 响应式骨架网格：断点与技能库 / 九宫格一致（1 / 2 / 3 列） */
export function SkeletonGrid({
  count = 6,
  className = 'grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3',
  label = '正在加载',
}: SkeletonGridProps) {
  return (
    <div role="status" aria-label={label} className={className}>
      {Array.from({ length: count }, (_, index) => <SkeletonCard key={index} />)}
    </div>
  )
}
