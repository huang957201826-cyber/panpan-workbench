import React from 'react'
import type { ProjectFolder, ProjectScheme } from '../types.ts'

interface TitleBarProps {
  currentProjectTitle: string
  folders: ProjectFolder[]
  activeFolderId: string
  activeSchemeId: string
  onSelectScheme: (folderId: string, scheme: ProjectScheme) => void
  onNewScheme: (folderId?: string) => void
  onNewFolder: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClearPrompt: () => void
  onCopyConfig: () => void
  isMaximized: boolean
  onToggleMaximize: () => void
  onMinimize: () => void
  onClose: () => void
  onOpenSettings: () => void
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
  onTitleBarMouseDown?: (e: React.MouseEvent) => void
  canManageProjects?: boolean
  showWindowControls?: boolean
}

/** 36px 沉浸式顶栏：无品牌文字、无菜单，只保留拖拽区与系统窗口三键 */
export const TitleBar: React.FC<TitleBarProps> = ({
  isMaximized,
  onToggleMaximize,
  onMinimize,
  onClose,
  onTitleBarMouseDown,
  showWindowControls = true,
}) => {
  return (
    <header
      onMouseDown={onTitleBarMouseDown}
      data-tauri-drag-region
      className="ui-scale-chrome relative z-40 flex h-[36px] w-full shrink-0 select-none items-center justify-between border-b border-black/[0.04] bg-white/70 px-3 text-slate-700 backdrop-blur-md transition-colors dark:border-white/[0.05] dark:bg-[#10121a]/70 dark:text-slate-300"
    >
      <div className="h-full w-12" data-tauri-drag-region />
      <div className="pointer-events-none mx-4 h-full flex-1 cursor-default" data-tauri-drag-region />
      {showWindowControls && (
        <div className="z-10 flex h-full items-center">
          <div className="-mr-2 flex h-full items-center border-l border-black/[0.06] dark:border-white/[0.08]">
            <button
              onClick={onMinimize}
              className="flex h-[36px] w-[44px] items-center justify-center text-slate-600 transition hover:bg-black/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.1]"
              title="最小化"
              aria-label="最小化"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={onToggleMaximize}
              className="flex h-[36px] w-[44px] items-center justify-center text-slate-600 transition hover:bg-black/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.1]"
              title={isMaximized ? '向下还原' : '最大化'}
              aria-label={isMaximized ? '向下还原' : '最大化'}
            >
              {isMaximized ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="2" y="0.5" width="7.5" height="7.5" stroke="currentColor" strokeWidth="1" />
                  <polyline points="0.5,2.5 0.5,9.5 7.5,9.5" stroke="currentColor" strokeWidth="1" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
                </svg>
              )}
            </button>
            <button
              onClick={onClose}
              className="group flex h-[36px] w-[44px] items-center justify-center text-slate-600 transition hover:bg-[#e81123] hover:text-white dark:text-slate-300"
              title="关闭"
              aria-label="关闭"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M0.5 0.5L9.5 9.5M9.5 0.5L0.5 9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
