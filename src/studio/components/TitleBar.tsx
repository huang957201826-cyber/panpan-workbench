import React, { useState, useRef, useEffect } from 'react';
import {
  FilePlus,
  FolderPlus,
  Sliders,
  RotateCcw,
  RotateCw,
  Trash2,
  Copy,
} from 'lucide-react';
import type { ProjectFolder, ProjectScheme } from '../types.ts';

interface TitleBarProps {
  currentProjectTitle: string;
  folders: ProjectFolder[];
  activeFolderId: string;
  activeSchemeId: string;
  onSelectScheme: (folderId: string, scheme: ProjectScheme) => void;
  onNewScheme: (folderId?: string) => void;
  onNewFolder: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearPrompt: () => void;
  onCopyConfig: () => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onTitleBarMouseDown?: (e: React.MouseEvent) => void;
  /** P1 只读阶段：新建项目/画布先禁用，P2 打开 */
  canManageProjects?: boolean;
  /** Web 版隐藏窗口按钮 */
  showWindowControls?: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  currentProjectTitle,
  onNewScheme,
  onNewFolder,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearPrompt,
  onCopyConfig,
  isMaximized,
  onToggleMaximize,
  onMinimize,
  onClose,
  onOpenSettings,
  isSidebarCollapsed,
  onToggleSidebar,
  onTitleBarMouseDown,
  canManageProjects = true,
  showWindowControls = true,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      onMouseDown={onTitleBarMouseDown}
      data-tauri-drag-region
      className="ui-scale-chrome h-[38px] w-full shrink-0 flex items-center justify-between px-2 bg-[#fcfcfd] dark:bg-[#12141c] border-b border-black/[0.06] dark:border-white/[0.07] text-slate-700 dark:text-slate-300 text-body-sm select-none relative z-40 transition-colors cursor-default"
    >
      {/* Left: Sidebar Collapse Toggle + Minimalist Menus (Directly matching DSH Desktop) */}
      <div className="flex items-center gap-1.5 z-10" ref={menuBarRef}>
        {/* Clean geometric panel toggle button */}
        <button
          onClick={onToggleSidebar}
          className={`w-[26px] h-[26px] rounded-md flex items-center justify-center hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-slate-500 dark:text-slate-400 transition cursor-pointer ${
            isSidebarCollapsed ? 'bg-black/[0.06] dark:bg-white/[0.1] text-slate-900 dark:text-white' : ''
          }`}
          title={isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {/* Ultra-clean geometric split icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
            <rect x="1" y="1.5" width="12" height="11" rx="1.5" />
            <line x1="5" y1="1.5" x2="5" y2="12.5" />
          </svg>
        </button>

        {/* Menu: 应用 */}
        <div className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === 'app' ? null : 'app')}
            className={`px-2 py-1 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition text-body-sm font-normal cursor-pointer ${
              activeMenu === 'app' ? 'bg-black/[0.08] dark:bg-white/[0.1] text-slate-900 dark:text-white' : ''
            }`}
          >
            应用
          </button>
          {activeMenu === 'app' && (
            <div className="absolute top-[30px] left-0 w-44 rounded-lg py-1 shadow-xl z-50 text-body-sm border border-black/10 dark:border-white/10 bg-white/98 dark:bg-[#181b26]/98 backdrop-blur-xl">
              <button
                disabled={!canManageProjects}
                title={canManageProjects ? undefined : 'P2 开放'}
                onClick={() => {
                  onNewScheme();
                  setActiveMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-black/[0.06] dark:hover:bg-white/[0.1] flex items-center justify-between transition cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed text-slate-800 dark:text-slate-100"
              >
                <div className="flex items-center gap-2">
                  <FilePlus className="w-3.5 h-3.5 stroke-[1.4]" />
                  <span>新建创作方案</span>
                </div>
              </button>
              <button
                disabled={!canManageProjects}
                title={canManageProjects ? undefined : 'P2 开放'}
                onClick={() => {
                  onNewFolder();
                  setActiveMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-black/[0.06] dark:hover:bg-white/[0.1] flex items-center gap-2 transition cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed text-slate-800 dark:text-slate-100"
              >
                <FolderPlus className="w-3.5 h-3.5 stroke-[1.4]" />
                <span>新建工作区</span>
              </button>
              <div className="h-px bg-black/[0.06] dark:bg-white/[0.08] my-1"></div>
              <button
                onClick={() => {
                  onOpenSettings();
                  setActiveMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-black/[0.06] dark:hover:bg-white/[0.1] flex items-center gap-2 transition cursor-pointer text-slate-800 dark:text-slate-100"
              >
                <Sliders className="w-3.5 h-3.5 stroke-[1.4]" />
                <span>偏好设置...</span>
              </button>
            </div>
          )}
        </div>

        {/* Menu: 编辑 */}
        <div className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
            className={`px-2 py-1 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition text-body-sm font-normal cursor-pointer ${
              activeMenu === 'edit' ? 'bg-black/[0.08] dark:bg-white/[0.1] text-slate-900 dark:text-white' : ''
            }`}
          >
            编辑
          </button>
          {activeMenu === 'edit' && (
            <div className="absolute top-[30px] left-0 w-44 rounded-lg py-1 shadow-xl z-50 text-body-sm border border-black/10 dark:border-white/10 bg-white/98 dark:bg-[#181b26]/98 backdrop-blur-xl">
              <div className="h-px bg-black/[0.06] dark:bg-white/[0.08] my-1"></div>
              <button
                onClick={() => {
                  onClearPrompt();
                  setActiveMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-black/[0.06] dark:hover:bg-white/[0.1] flex items-center gap-2 transition cursor-pointer text-slate-800 dark:text-slate-100"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[1.4]" />
                <span>清空提示词</span>
              </button>
              <button
                onClick={() => {
                  onCopyConfig();
                  setActiveMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-black/[0.06] dark:hover:bg-white/[0.1] flex items-center gap-2 transition cursor-pointer text-slate-800 dark:text-slate-100"
              >
                <Copy className="w-3.5 h-3.5 stroke-[1.4]" />
                <span>复制当前方案配置</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center: project title + pure drag whitespace */}
      <div data-tauri-drag-region className="flex-1 h-full mx-4 flex items-center justify-center pointer-events-none">
        <span className="truncate max-w-[42vw] text-body-sm text-slate-400 dark:text-slate-500">{currentProjectTitle}</span>
      </div>

      {/* Right: Native Windows 11 Caption Controls Only */}
      {showWindowControls && (
      <div className="flex items-center h-full z-10">
        <div className="flex items-center -mr-2 h-full border-l border-black/[0.06] dark:border-white/[0.08]">
          {/* Minimize: 10px single horizontal stroke */}
          <button
            onClick={onMinimize}
            className="w-[44px] h-[38px] flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="最小化"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </button>

          {/* Maximize / Restore: 10px square */}
          <button
            onClick={onToggleMaximize}
            className="w-[44px] h-[38px] flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title={isMaximized ? '向下还原' : '最大化'}
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="0.5" width="7.5" height="7.5" stroke="currentColor" strokeWidth="1" />
                <polyline points="0.5,2.5 0.5,9.5 7.5,9.5" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
              </svg>
            )}
          </button>

          {/* Close: 10px cross with Windows 11 red hover */}
          <button
            onClick={onClose}
            className="w-[44px] h-[38px] flex items-center justify-center hover:bg-[#e81123] hover:text-white text-slate-600 dark:text-slate-300 transition cursor-pointer group"
            title="关闭"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0.5 0.5L9.5 9.5M9.5 0.5L0.5 9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      )}
    </header>
  );
};
