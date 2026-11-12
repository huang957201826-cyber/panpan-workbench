import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Folder,
  Search,
  Settings,
  Pencil,
  Trash2,
  Star,
  MoreHorizontal,
  PanelLeftClose,
} from 'lucide-react';
import type { ActiveActivity } from '../types.ts';
import { AppLogo } from './AppLogo.tsx';
import { UpdateEntry } from './UpdateEntry.tsx';

export interface SidebarProject {
  id: string;
  name: string;
  canvasCount: number;
  isFavorites?: boolean;
}

interface AppSidebarProps {
  projects: SidebarProject[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
  onRenameProject: (projectId: string, name: string) => void;
  onDeleteProject: (projectId: string) => void;
  onCollapse: () => void;
  activeActivity: ActiveActivity;
  onSelectActivity: (activity: ActiveActivity) => void;
  onOpenSettings: () => void;
  isCollapsed: boolean;
  /** 可用的功能入口：项目、工作流、技能库 */
  enabledActivities?: ActiveActivity[];
  /** 项目新建/重命名/删除入口 */
  canManageProjects?: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onNewProject,
  onRenameProject,
  onDeleteProject,
  onCollapse,
  activeActivity,
  onSelectActivity,
  onOpenSettings,
  isCollapsed,
  enabledActivities = ['home', 'projects', 'workflow', 'skills'],
  canManageProjects = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const cancelRenameRef = useRef(false);
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; projectId: string; name: string } | null>(null);

  useEffect(() => {
    if (!rowMenu) return;
    const close = () => setRowMenu(null);
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
    };
  }, [rowMenu]);

  // 侧栏搜索只匹配项目名，不再进入画布层
  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(query));
  }, [projects, searchQuery]);

  const commitRename = (project: SidebarProject) => {
    if (!project.isFavorites) onRenameProject(project.id, editingName.trim() || project.name);
    setEditingProjectId(null);
  };

  return (
    <div className="ui-scale-chrome relative z-30 flex h-full shrink-0 select-none text-slate-800 dark:text-slate-200">
      <aside data-app-rail className="z-20 flex h-full w-[68px] shrink-0 flex-col items-center border-r border-black/[0.05] bg-white py-6 dark:border-white/[0.06] dark:bg-[#10121a]">
        <div className="flex h-9 w-9 items-center justify-center text-slate-900 dark:text-white" title="盼盼工作台 · STUDIO">
          <AppLogo size={24} className="h-6 w-6" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-[18px]">
          {enabledActivities.includes('home') && (
            <button
              onClick={() => onSelectActivity('home')}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                activeActivity === 'home'
                  ? 'bg-black text-white shadow-md dark:bg-white dark:text-black'
                  : 'text-slate-400 hover:bg-black/[0.04] hover:text-slate-800 dark:hover:bg-white/[0.06] dark:hover:text-slate-200'
              }`}
              title="首页灵感中心"
              aria-label="首页"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 9.5L10 3L17 9.5V17C17 17.5523 16.5523 18 16 18H4C3.44772 18 3 17.5523 3 17V9.5Z" />
                <path d="M9 18V12H11V18" />
              </svg>
            </button>
          )}

          <button
            onClick={() => onSelectActivity('projects')}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
              activeActivity === 'projects'
                ? 'bg-black text-white shadow-md dark:bg-white dark:text-black'
                : 'text-slate-400 hover:bg-black/[0.04] hover:text-slate-800 dark:hover:bg-white/[0.06] dark:hover:text-slate-200'
            }`}
            title="工作区与设计方案"
            aria-label="工作区"
          >
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="3" width="12" height="10" rx="1.5" />
              <line x1="2" y1="6.5" x2="14" y2="6.5" />
              <line x1="6.5" y1="3" x2="6.5" y2="6.5" />
            </svg>
          </button>

          {enabledActivities.includes('workflow') && (
            <button
              onClick={() => onSelectActivity('workflow')}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                activeActivity === 'workflow'
                  ? 'bg-black text-white shadow-md dark:bg-white dark:text-black'
                  : 'text-slate-400 hover:bg-black/[0.04] hover:text-slate-800 dark:hover:bg-white/[0.06] dark:hover:text-slate-200'
              }`}
              title="工作流"
              aria-label="工作流"
            >
              <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="2" y="2.5" width="4.5" height="4.5" rx="1" />
                <rect x="9.5" y="9" width="4.5" height="4.5" rx="1" />
                <path d="M6.5 4.8h2a2 2 0 0 1 2 2v2.2" />
                <circle cx="6.5" cy="4.8" r="0.8" fill="currentColor" />
                <circle cx="9.5" cy="11.2" r="0.8" fill="currentColor" />
              </svg>
            </button>
          )}

          {enabledActivities.includes('skills') && (
            <button
              onClick={() => onSelectActivity('skills')}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                activeActivity === 'skills' || activeActivity === 'models'
                  ? 'bg-black text-white shadow-md dark:bg-white dark:text-black'
                  : 'text-slate-400 hover:bg-black/[0.04] hover:text-slate-800 dark:hover:bg-white/[0.06] dark:hover:text-slate-200'
              }`}
              title="技能库"
              aria-label="技能库"
            >
              <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M8 1.5l1.5 4.5 4.5 1.5-4.5 1.5L8 13.5 6.5 9 2 7.5l4.5-1.5L8 1.5z" />
                <circle cx="13" cy="3" r="1" fill="currentColor" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <UpdateEntry />
          <button
            onClick={onOpenSettings}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-slate-400 transition-all hover:bg-black/[0.04] hover:text-slate-800 dark:hover:bg-white/[0.06] dark:hover:text-white"
            title="设置"
            aria-label="设置"
          >
            <Settings className="h-[18px] w-[18px] stroke-[1.6]" />
          </button>
        </div>
      </aside>

      {!isCollapsed && activeActivity === 'projects' && (
        <div className="z-10 flex h-full w-[256px] shrink-0 flex-col border-r border-black/[0.04] bg-[#fbfcfd] transition-all duration-150 dark:border-white/[0.05] dark:bg-[#12141c]">
          <div className="flex items-start justify-between px-3 pb-3 pt-2">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">项目</h2>
              <p className="mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">共 {projects.length} 个项目</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (isSearching) setSearchQuery('')
                  setIsSearching(!isSearching)
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-black/5 hover:text-slate-800 dark:hover:bg-white/10 dark:hover:text-white"
                title="搜索项目"
                aria-label="搜索项目"
                aria-pressed={isSearching}
              >
                <Search className="h-3.5 w-3.5 stroke-[1.8]" />
              </button>
              <button
                onClick={onCollapse}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-black/5 hover:text-slate-800 dark:hover:bg-white/10 dark:hover:text-white"
                title="收起侧栏"
                aria-label="收起方案侧栏"
              >
                <PanelLeftClose className="h-3.5 w-3.5 stroke-[1.8]" />
              </button>
            </div>
          </div>

          {isSearching && (
            <div className="px-2 pb-2">
              <div className="flex items-center gap-1.5 rounded-md border border-black/[0.05] bg-black/[0.03] px-2 py-1 text-body-sm dark:border-white/[0.07] dark:bg-white/[0.05]">
                <Search className="h-3 w-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索项目..."
                  aria-label="搜索项目名"
                  className="w-full border-none bg-transparent text-body-sm text-slate-800 outline-none placeholder-slate-400 dark:text-slate-100"
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-caption text-slate-400 hover:text-slate-600" aria-label="清空项目搜索">
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 space-y-1 overflow-y-auto px-2 py-1 no-scrollbar">
            {filteredProjects.map((project) => {
              const isActive = project.id === activeProjectId;
              return (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  onContextMenu={(event) => {
                    if (!canManageProjects || project.isFavorites) return;
                    event.preventDefault();
                    setRowMenu({ x: event.clientX, y: event.clientY, projectId: project.id, name: project.name });
                  }}
                  onDoubleClick={() => {
                    if (!canManageProjects || project.isFavorites) return;
                    cancelRenameRef.current = false;
                    setEditingProjectId(project.id);
                    setEditingName(project.name);
                  }}
                  className={`group flex h-[42px] cursor-pointer items-center justify-between rounded-xl px-2.5 text-[12.5px] transition ${
                    isActive
                      ? 'bg-black text-white shadow-sm dark:bg-white dark:text-black'
                      : 'text-slate-600 hover:bg-black/[0.04] dark:text-slate-400 dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {project.isFavorites ? (
                      <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" fill="currentColor" strokeWidth={1.2} />
                    ) : (
                      <Folder className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={1.5} />
                    )}
                    {editingProjectId === project.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => setEditingName(event.target.value)}
                        onBlur={() => {
                          if (cancelRenameRef.current) {
                            cancelRenameRef.current = false;
                            setEditingProjectId(null);
                            return;
                          }
                          commitRename(project);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') commitRename(project);
                          if (event.key === 'Escape') {
                            cancelRenameRef.current = true;
                            setEditingProjectId(null);
                          }
                        }}
                        aria-label="项目名称"
                        className="min-w-0 flex-1 rounded border border-black/20 bg-white px-1 py-0.5 text-body-sm text-slate-800 outline-none dark:border-white/20 dark:bg-[#1a1c28] dark:text-slate-100"
                      />
                    ) : (
                      <span className="truncate font-medium">{project.name}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <span className={`font-mono text-caption ${isActive ? 'text-white/55 dark:text-black/55' : 'text-slate-400'}`}>
                      {project.canvasCount}
                    </span>
                    {canManageProjects && !project.isFavorites && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setRowMenu({ x: event.clientX, y: event.clientY, projectId: project.id, name: project.name });
                        }}
                        className={`rounded p-0.5 opacity-0 transition group-hover:opacity-100 ${isActive ? 'text-white/70 hover:bg-white/15' : 'text-slate-500 hover:bg-black/10 dark:hover:bg-white/15'}`}
                        title="更多项目操作"
                        aria-label="更多项目操作"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!filteredProjects.length && (
              <p className="px-3 py-6 text-center text-body-sm text-slate-400">没有匹配的项目</p>
            )}
          </div>

          <div className="border-t border-black/[0.04] p-2 dark:border-white/[0.05]">
            <button
              disabled={!canManageProjects}
              onClick={onNewProject}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-2xl bg-[#f3f4f8] text-[11.5px] font-medium text-slate-700 transition hover:bg-[#eaecee] disabled:opacity-35 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.1]"
              title={canManageProjects ? '新建项目' : '项目/画布管理尚未开放'}
            >
              <Plus className="h-3.5 w-3.5 stroke-[2]" />
              <span>新建项目</span>
            </button>
          </div>
        </div>
      )}

      {rowMenu && (
        <div
          className="fixed z-[9999] w-40 rounded-lg border border-black/10 bg-white/98 p-1 text-body-sm shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#1a1d28]/98"
          style={{ left: Math.min(rowMenu.x, window.innerWidth - 176), top: Math.min(rowMenu.y, window.innerHeight - 100) }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              cancelRenameRef.current = false;
              setEditingProjectId(rowMenu.projectId);
              setEditingName(rowMenu.name);
              setRowMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
          >
            <Pencil className="h-3 w-3" /> 重命名
          </button>
          <button
            type="button"
            onClick={() => {
              onDeleteProject(rowMenu.projectId);
              setRowMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-red-500 hover:bg-red-500/10"
          >
            <Trash2 className="h-3 w-3" /> 删除
          </button>
        </div>
      )}
    </div>
  );
};
