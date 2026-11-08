import React, { useState } from 'react';
import {
  Plus,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Search,
  FolderPlus,
  Check,
  RefreshCw,
  HardDrive,
  Cpu,
  Settings,
  Pencil,
  Trash2,
  Star,
} from 'lucide-react';
import { isFavoritesCanvas, isFavoritesProject } from '../../lib/favorites';
import { REPO_ISSUES_URL } from '../../lib/repoLinks';
import type { ProjectFolder, ProjectScheme, ActiveActivity, LocalModelItem } from '../types.ts';
import { INITIAL_LOCAL_MODELS } from '../constants.ts';
import { AppLogo } from './AppLogo.tsx';
import { UpdateEntry } from './UpdateEntry.tsx';

interface AppSidebarProps {
  folders: ProjectFolder[];
  activeFolderId: string;
  activeSchemeId: string;
  onSelectScheme: (folderId: string, scheme: ProjectScheme) => void;
  onToggleFolder: (folderId: string) => void;
  onNewScheme: (folderId?: string) => void;
  onNewFolder: () => void;
  activeActivity: ActiveActivity;
  onSelectActivity: (activity: ActiveActivity) => void;
  onOpenSettings: () => void;
  isCollapsed: boolean;
  width: number;
  onWidthChange: (w: number) => void;
  /** 可用的功能入口：项目、工作流、技能库 */
  enabledActivities?: ActiveActivity[];
  /** P1 只读阶段：新建项目/画布先禁用，P2 打开 */
  canManageProjects?: boolean;
  onRenameFolder?: (folderId: string, name: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onRenameScheme?: (folderId: string, schemeId: string, name: string) => void;
  onDeleteScheme?: (schemeId: string) => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  folders,
  activeFolderId,
  activeSchemeId,
  onSelectScheme,
  onToggleFolder,
  onNewScheme,
  onNewFolder,
  activeActivity,
  onSelectActivity,
  onOpenSettings,
  isCollapsed,
  enabledActivities = ['projects', 'workflow', 'skills'],
  canManageProjects = true,
  onRenameFolder,
  onDeleteFolder,
  onRenameScheme,
  onDeleteScheme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [models, setModels] = useState<LocalModelItem[]>(INITIAL_LOCAL_MODELS);
  const [modelFilter, setModelFilter] = useState<'all' | 'checkpoint' | 'lora'>('all');

  // Filter schemes if searching
  const filteredFolders = folders.map((f) => {
    if (!searchQuery.trim()) return f;
    const q = searchQuery.toLowerCase();
    const matchedSchemes = f.schemes.filter(
      (s) => s.title.toLowerCase().includes(q) || s.prompt.toLowerCase().includes(q)
    );
    return {
      ...f,
      isExpanded: matchedSchemes.length > 0 ? true : f.isExpanded,
      schemes: matchedSchemes,
    };
  });

  const toggleModelActive = (id: string) => {
    setModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isActive: !m.isActive } : m))
    );
  };

  const updateLoraWeight = (id: string, weight: number) => {
    setModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, weight } : m))
    );
  };

  return (
    <div className="ui-scale-chrome relative shrink-0 h-full flex z-30 select-none text-slate-800 dark:text-slate-200">
      {/* =========================================================================
          ZONE 1: 56px ACTIVITY RAIL (Always visible or toggled)
          ========================================================================= */}
      <aside className="w-14 shrink-0 h-full bg-[#f8f9fa] dark:bg-[#0e1017] border-r border-black/[0.06] dark:border-white/[0.07] flex flex-col justify-between items-center py-2.5 z-20">
        {/* Top: Logo & Activity Icons */}
        <div className="flex flex-col items-center gap-2 w-full">
          {/* Studio Geometric Logo (Featuring outer squircle + circle & square) */}
          <div
            className="w-8 h-8 rounded-lg bg-black dark:bg-black flex items-center justify-center text-white shadow-xs mb-1 cursor-default"
            title="盼盼工作台 · STUDIO"
          >
            <AppLogo size={18} className="w-[16px] h-[16px]" />
          </div>

          <div className="w-5 h-px bg-black/[0.06] dark:bg-white/[0.08] my-0.5"></div>

          {/* 1. Activity: Projects / Workspace (Minimal Geometric Container Icon) */}
          <button
            onClick={() => onSelectActivity('projects')}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer group ${
              activeActivity === 'projects'
                ? 'bg-black/[0.08] dark:bg-white/[0.12] text-slate-900 dark:text-white font-medium shadow-2xs'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
            }`}
            title="工作区与设计方案 (Workspace & Artboards)"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
              <rect x="2" y="3" width="12" height="10" rx="1.5" />
              <line x1="2" y1="6.5" x2="14" y2="6.5" />
              <line x1="6.5" y1="3" x2="6.5" y2="6.5" />
            </svg>
          </button>

          {/* 2. Activity: ComfyUI Node Workflow (Battery / Node Connectors Icon) */}
          {enabledActivities.includes('workflow') && (
          <button
            disabled={!enabledActivities.includes('workflow')}
            onClick={() => onSelectActivity('workflow')}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer group disabled:opacity-35 disabled:cursor-not-allowed ${
              activeActivity === 'workflow' || activeActivity === 'engine'
                ? 'bg-black/[0.08] dark:bg-white/[0.12] text-slate-900 dark:text-white font-medium shadow-2xs'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
            }`}
            title="工作流"
            aria-label="工作流"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
              <rect x="2" y="2.5" width="4.5" height="4.5" rx="1" />
              <rect x="9.5" y="9" width="4.5" height="4.5" rx="1" />
              <path d="M6.5 4.8h2a2 2 0 0 1 2 2v2.2" />
              <circle cx="6.5" cy="4.8" r="0.8" fill="currentColor" />
              <circle cx="9.5" cy="11.2" r="0.8" fill="currentColor" />
            </svg>
          </button>
          )}

          {/* 3. Activity: Skill & Prompt Hub (Sparkles / Recipe Icon) */}
          {enabledActivities.includes('skills') && (
          <button
            disabled={!enabledActivities.includes('skills')}
            onClick={() => onSelectActivity('skills')}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer group disabled:opacity-35 disabled:cursor-not-allowed ${
              activeActivity === 'skills' || activeActivity === 'models'
                ? 'bg-black/[0.08] dark:bg-white/[0.12] text-slate-900 dark:text-white font-medium shadow-2xs'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
            }`}
            title="技能库"
            aria-label="技能库"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path d="M8 1.5l1.5 4.5 4.5 1.5-4.5 1.5L8 13.5 6.5 9 2 7.5l4.5-1.5L8 1.5z" />
              <circle cx="13" cy="3" r="1" fill="currentColor" />
            </svg>
          </button>
          )}
        </div>

        {/* Bottom: Settings (Single primary setting icon at bottom of the rail) */}
        <div className="flex flex-col items-center gap-1">
          <UpdateEntry />
          <button
            onClick={onOpenSettings}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-500 hover:bg-blue-500/[0.1] dark:text-slate-300 dark:hover:text-blue-400 dark:hover:bg-blue-500/[0.15] transition-all cursor-pointer"
            title="设置"
            aria-label="设置"
          >
            <Settings className="w-5 h-5 stroke-[1.6]" />
          </button>
        </div>
      </aside>

      {/* =========================================================================
          ZONE 2: 230px COLLAPSIBLE DRAWER (Smoothly toggles with TitleBar button)
          ========================================================================= */}
      {!isCollapsed && (
        <div className="w-[230px] shrink-0 h-full bg-[#fbfcfd] dark:bg-[#11131b] border-r border-black/[0.06] dark:border-white/[0.07] flex flex-col z-10 transition-all duration-150">
          {/* TAB CONTENT A: PROJECTS & SCHEMES */}
          {activeActivity === 'projects' && (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="h-[44px] px-3 flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.05]">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-body tracking-tight text-slate-900 dark:text-white">
                    工作区方案
                  </span>
                  <span className="text-caption text-slate-400 font-mono">
                    ({folders.reduce((acc, f) => acc + f.schemes.length, 0)})
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsSearching(!isSearching)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/[0.04] transition"
                    title="搜索方案"
                  >
                    <Search className="w-3.5 h-3.5 stroke-[1.4]" />
                  </button>
                  <button
                    disabled={!canManageProjects}
                    onClick={onNewFolder}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/[0.04] transition disabled:opacity-35 disabled:cursor-not-allowed"
                    title={canManageProjects ? '新建文件夹' : '项目/画布管理 P2 开放'}
                  >
                    <FolderPlus className="w-3.5 h-3.5 stroke-[1.4]" />
                  </button>
                </div>
              </div>

              {/* Action Button: + 新建创作方案 */}
              <div className="p-2 pb-1.5">
                <button
                  disabled={!canManageProjects}
                  onClick={() => onNewScheme(activeFolderId)}
                  className="w-full h-[28px] rounded-lg bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.09] border border-black/[0.06] dark:border-white/[0.07] text-slate-800 dark:text-slate-100 font-medium text-body-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer group disabled:opacity-35 disabled:cursor-not-allowed"
                  title={canManageProjects ? undefined : '项目/画布管理 P2 开放'}
                >
                  <Plus className="w-3.5 h-3.5 stroke-[1.8] text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                  <span>新建创作方案</span>
                </button>
              </div>

              {/* Search Box */}
              {isSearching && (
                <div className="px-2 pb-1.5">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.07] text-body-sm">
                    <Search className="w-3 h-3 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索方案或关键词..."
                      className="bg-transparent border-none outline-none w-full text-slate-800 dark:text-slate-100 placeholder-slate-400 text-body-sm"
                      autoFocus
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 text-caption">
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Folder & Scheme Tree */}
              <div className="flex-1 overflow-y-auto no-scrollbar px-2 py-1 space-y-1">
                {filteredFolders.map((folder) => (
                  <div key={folder.id} className="space-y-0.5">
                    <div
                      onClick={() => onToggleFolder(folder.id)}
                      onDoubleClick={() => {
                        if (!canManageProjects) return;
                        setEditingFolderId(folder.id);
                        setEditingName(folder.name);
                      }}
                      className="group flex items-center justify-between px-2 py-1 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer text-body-sm text-slate-600 dark:text-slate-400 transition"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-slate-400">
                          {folder.isExpanded ? (
                            <ChevronDown className="w-3 h-3 stroke-[1.8]" />
                          ) : (
                            <ChevronRight className="w-3 h-3 stroke-[1.8]" />
                          )}
                        </span>
                        {isFavoritesProject(folder.id) ? (
                          <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" strokeWidth={1.2} />
                        ) : folder.isExpanded ? (
                          <FolderOpen className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 stroke-[1.5] shrink-0" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 text-slate-400 stroke-[1.5] shrink-0" />
                        )}
                        {editingFolderId === folder.id ? (
                          <input
                            autoFocus
                            value={editingName}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => {
                              onRenameFolder?.(folder.id, editingName.trim() || folder.name);
                              setEditingFolderId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                onRenameFolder?.(folder.id, editingName.trim() || folder.name);
                                setEditingFolderId(null);
                              }
                              if (e.key === 'Escape') setEditingFolderId(null);
                            }}
                            className="min-w-0 flex-1 bg-white dark:bg-[#1a1c28] border border-black/20 dark:border-white/20 rounded px-1 py-0.5 text-body-sm outline-none"
                          />
                        ) : (
                          <span className="truncate font-medium text-slate-700 dark:text-slate-300">{folder.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition">
                        {canManageProjects && onRenameFolder && !isFavoritesProject(folder.id) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFolderId(folder.id);
                              setEditingName(folder.name);
                            }}
                            className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/15 text-slate-500"
                            title="重命名项目"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </button>
                        )}
                        {canManageProjects && onDeleteFolder && !isFavoritesProject(folder.id) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteFolder(folder.id);
                            }}
                            className="p-0.5 rounded hover:bg-red-500/15 text-slate-500 hover:text-red-500"
                            title="删除项目"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                        {!isFavoritesProject(folder.id) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNewScheme(folder.id);
                            }}
                            className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/15 text-slate-500"
                            title="在此目录下新建方案"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {folder.isExpanded && (
                      <div className="pl-2 space-y-0.5 border-l border-black/[0.04] dark:border-white/[0.05] ml-3">
                        {folder.schemes.map((scheme) => {
                          const isSelected = activeFolderId === folder.id && activeSchemeId === scheme.id;
                          return (
                            <div
                              key={scheme.id}
                              onClick={() => onSelectScheme(folder.id, scheme)}
                              onDoubleClick={() => {
                                if (!canManageProjects) return;
                                setEditingSchemeId(scheme.id);
                                setEditingName(scheme.title);
                              }}
                              className={`group px-2 py-1.5 rounded-md flex items-center justify-between text-body-sm cursor-pointer transition ${
                                isSelected
                                  ? 'bg-black/[0.06] dark:bg-white/[0.1] text-slate-900 dark:text-white font-medium shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] hover:text-slate-800 dark:hover:text-slate-200'
                              }`}
                            >
                              {editingSchemeId === scheme.id ? (
                                <input
                                  autoFocus
                                  value={editingName}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onBlur={() => {
                                    onRenameScheme?.(folder.id, scheme.id, editingName.trim() || scheme.title);
                                    setEditingSchemeId(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      onRenameScheme?.(folder.id, scheme.id, editingName.trim() || scheme.title);
                                      setEditingSchemeId(null);
                                    }
                                    if (e.key === 'Escape') setEditingSchemeId(null);
                                  }}
                                  className="min-w-0 flex-1 bg-white dark:bg-[#1a1c28] border border-black/20 dark:border-white/20 rounded px-1 py-0.5 text-body-sm outline-none"
                                />
                              ) : (
                                <span className="truncate pr-2">{scheme.title}</span>
                              )}
                              <div className="flex items-center gap-0.5 shrink-0">
                                {canManageProjects && onRenameScheme && !isFavoritesCanvas(scheme.id) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingSchemeId(scheme.id);
                                      setEditingName(scheme.title);
                                    }}
                                    className="opacity-60 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/15 text-slate-500"
                                    title="重命名画布"
                                  >
                                    <Pencil className="w-2.5 h-2.5" />
                                  </button>
                                )}
                                {canManageProjects && onDeleteScheme && !isFavoritesCanvas(scheme.id) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteScheme(scheme.id);
                                    }}
                                    className="opacity-60 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/15 text-slate-500 hover:text-red-500"
                                    title="删除画布"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                )}
                                <span className="text-caption text-slate-400 font-mono">
                                  {scheme.updatedAt.includes('今天') ? '刚刚' : scheme.updatedAt.slice(-5)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 规划中的模块：保留入口，但说明状态和去向，避免被当成功能损坏 */}
          {(activeActivity === 'workflow' || activeActivity === 'engine' || activeActivity === 'skills' || activeActivity === 'models') && (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <p className="text-body font-semibold text-slate-800 dark:text-slate-100">
                {activeActivity === 'skills' || activeActivity === 'models' ? '技能库' : '工作流'}
              </p>
              <p className="mt-2 text-body-sm text-slate-500 dark:text-slate-400">该模块仍在规划中，项目已开源</p>
              <button
                type="button"
                onClick={() => window.open(REPO_ISSUES_URL, '_blank', 'noopener')}
                className="mt-3 rounded-full border border-black/10 px-3 py-1 text-caption text-slate-600 transition hover:bg-black/5 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
              >
                到 GitHub 提建议
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
