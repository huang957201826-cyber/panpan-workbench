import type { ReactNode } from 'react'

interface StudioHeaderProps {
  /** 当前画布名 */
  title: string
  /** 所属项目名，展示为「项目 / 画布」 */
  projectName?: string
  /** 当前视图的任务/卡片数量 */
  count: number
  runningCount: number
  /** 右侧工具区（筛选、多选、视图切换） */
  children: ReactNode
}

/** 工作台主区头部：画布与九宫格共用同一条，固定 48px、不浮动、不随内容滚动 */
export function StudioHeader({ title, projectName, count, runningCount, children }: StudioHeaderProps) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {projectName && (
          <>
            <span className="hidden max-w-[120px] truncate text-body-sm text-ink-3 lg:inline">{projectName}</span>
            <span className="text-body-sm text-ink-3">/</span>
          </>
        )}
        <h1 className="min-w-0 truncate text-title text-ink-1">{title}</h1>
        <span className="rounded-chip bg-surface-2 px-1.5 py-0.5 font-mono text-caption text-ink-3">{count}</span>
        {runningCount > 0 && (
          <span className="flex items-center gap-1 rounded-chip bg-brand-soft px-1.5 py-0.5 text-caption text-brand">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
            生成中 {runningCount}
          </span>
        )}
      </div>
      <div className="ml-auto flex min-w-0 max-w-[70%] shrink-0 items-center justify-end gap-1.5">{children}</div>
    </header>
  )
}
