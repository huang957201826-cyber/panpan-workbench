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

/** 浮动工具条：不再显示面包屑、数量与运行状态，只保留右侧操作 */
export function StudioHeader({ children }: StudioHeaderProps) {
  return (
    <header className="pointer-events-none absolute right-3 top-14 z-30 flex justify-end">
      <div className="pointer-events-auto flex max-w-[calc(100vw-340px)] items-center gap-1 overflow-x-auto rounded-full border border-black/[0.04] bg-white/90 px-2 py-1 text-body-sm shadow-[0_10px_30px_-4px_rgba(15,23,42,0.05)] backdrop-blur-xl no-scrollbar dark:border-white/[0.06] dark:bg-[#141620]/90">
        {children}
      </div>
    </header>
  )
}
