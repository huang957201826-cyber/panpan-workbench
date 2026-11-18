import React, { useState } from 'react';
import {
  Plus,
  Folder,
  FolderOpen,
  Search,
  Settings,
  Star,
  PanelLeftClose,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  ProjectFolder,
  ProjectScheme,
  ActiveActivity,
  WorkflowPreset,
  WorkflowCategoryId,
  SkillItem,
} from '../types.ts';
import { AppLogo } from './AppLogo.tsx';
import { MOCK_SKILLS } from '../data/mockSkills.ts';

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
  workflowSubView?: 'gallery' | 'canvas';
  workflowPresets?: WorkflowPreset[];
  activeWorkflowCategory?: 'all' | WorkflowCategoryId;
  onSelectWorkflowCategory?: (cat: 'all' | WorkflowCategoryId) => void;
  archiveRecordCount?: number;
  onOpenArchiveDrawer?: () => void;
  skills?: SkillItem[];
  activeSkillCategory?: string;
  onSelectSkillCategory?: (cat: string) => void;
  onOpenSettings: () => void;
  isCollapsed: boolean;
  onToggleCollapse?: () => void;
  width: number;
  onWidthChange: (w: number) => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  folders,
  activeFolderId,
  activeSchemeId,
  onSelectScheme,
  onToggleFolder,
  onNewFolder,
  activeActivity,
  onSelectActivity,
  workflowSubView = 'gallery',
  workflowPresets = [],
  activeWorkflowCategory = 'all',
  onSelectWorkflowCategory,
  archiveRecordCount = 0,
  onOpenArchiveDrawer,
  skills = MOCK_SKILLS,
  activeSkillCategory = 'all',
  onSelectSkillCategory,
  onOpenSettings,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Keep searchQuery filter helper available
  void folders.map((f) => {
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

  return (
    <div className="relative shrink-0 h-full flex z-30 select-none text-slate-800 dark:text-slate-200">
      {/* =========================================================================
          ZONE 1: 68px TACTILE ACTIVITY RAIL (Architectural Pillar, Balanced Proportions)
          ========================================================================= */}
      <aside className="w-[68px] shrink-0 h-full bg-white dark:bg-[#10121a] border-r border-black/[0.06] dark:border-white/[0.06] flex flex-col justify-between items-center py-6 z-20 transition-all">
        {/* Top: Flat Brand Logo Glyph (Pure vector, zero background box/button look) */}
        <div className="flex flex-col items-center w-full pt-0.5">
          <div
            className="w-9 h-9 flex items-center justify-center text-slate-900 dark:text-white cursor-default transition-opacity hover:opacity-80"
            title="盼盼工作台 · PANPAN STUDIO"
          >
            <AppLogo size={24} className="w-6 h-6 text-black dark:text-white stroke-[1.8]" />
          </div>
        </div>

        {/* Center: Vertically Centered Main Activity Navigation (Home, Projects, Workflow, Skills) */}
        <div className="flex flex-col items-center gap-4.5 w-full">
          {/* 1. Home Hub (全新首页灵感中心) */}
          <button
            onClick={() => onSelectActivity('home')}
            className={`w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all cursor-pointer group ${
              activeActivity === 'home'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-md'
                : 'text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
            title="首页灵感中心 (Home Hub)"
          >
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 9.5L10 3L17 9.5V17C17 17.5523 16.5523 18 16 18H4C3.44772 18 3 17.5523 3 17V9.5Z" />
              <path d="M9 18V12H11V18" />
            </svg>
          </button>

          {/* 2. Projects & Canvas (设计方案与工作区) */}
          <button
            onClick={() => onSelectActivity('projects')}
            className={`w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all cursor-pointer group ${
              activeActivity === 'projects'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-md'
                : 'text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
            title="空间方案与画布工作区 (Workspace Projects)"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="3" width="12" height="10" rx="1.5" />
              <line x1="2" y1="6.5" x2="14" y2="6.5" />
              <line x1="6.5" y1="3" x2="6.5" y2="6.5" />
            </svg>
          </button>

          {/* 3. Node Workflow (ComfyUI 工作流引擎) */}
          <button
            onClick={() => onSelectActivity('workflow')}
            className={`w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all cursor-pointer group ${
              activeActivity === 'workflow' || activeActivity === 'engine'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-md'
                : 'text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
            title="ComfyUI 节点工作流 (Node Workflow)"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="2.5" width="4.5" height="4.5" rx="1" />
              <rect x="9.5" y="9" width="4.5" height="4.5" rx="1" />
              <path d="M6.5 4.8h2a2 2 0 0 1 2 2v2.2" />
              <circle cx="6.5" cy="4.8" r="0.8" fill="currentColor" />
              <circle cx="9.5" cy="11.2" r="0.8" fill="currentColor" />
            </svg>
          </button>

          {/* 4. Skill & Prompt Hub (技能与配方库) */}
          <button
            onClick={() => onSelectActivity('skills')}
            className={`w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all cursor-pointer group ${
              activeActivity === 'skills' || activeActivity === 'models'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-md'
                : 'text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
            title="技能与配方库 (Skill & Prompt Hub)"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 1.5l1.5 4.5 4.5 1.5-4.5 1.5L8 13.5 6.5 9 2 7.5l4.5-1.5L8 1.5z" />
              <circle cx="13" cy="3" r="1" fill="currentColor" />
            </svg>
          </button>
        </div>

        {/* Bottom: Settings Action (Standard Gear Icon) */}
        <div className="flex flex-col items-center pb-1">
          <button
            onClick={onOpenSettings}
            className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all cursor-pointer"
            title="系统设置 (Settings)"
          >
            <Settings className="w-[18px] h-[18px] stroke-[1.6]" />
          </button>
        </div>
      </aside>

      {/* =========================================================================
          ZONE 2: 256px TACTILE SOFT DRAWER (Hidden in Home & Workflow Canvas Stage 2)
          ========================================================================= */}
      {!isCollapsed &&
        activeActivity !== 'home' &&
        !((activeActivity === 'workflow' || activeActivity === 'engine') &&
          workflowSubView === 'canvas') && (
        <div className="w-[256px] shrink-0 h-full bg-[#fbfcfd] dark:bg-[#12141c] border-r border-black/[0.04] dark:border-white/[0.05] flex flex-col z-10 transition-all duration-150 p-3.5 justify-between">
          {/* TAB CONTENT A: PROJECTS & SCHEMES */}
          {activeActivity === 'projects' && (
            <div className="flex flex-col h-full justify-between">
              <div className="space-y-4">
                {/* 1. Header: Big typography + Collapse Drawer Button + Search */}
                <div className="flex items-center justify-between px-1 pt-1">
                  <div>
                    <h2 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                      空间设计方案
                    </h2>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                      共 {folders.reduce((acc, f) => acc + f.schemes.length, 0)} 套专业工程方案
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsSearching(!isSearching)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                      title="搜索方案"
                    >
                      <Search className="w-3.5 h-3.5 stroke-[1.8]" />
                    </button>
                    {onToggleCollapse && (
                      <button
                        onClick={onToggleCollapse}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                        title="收回侧边抽屉 (纯净画布)"
                      >
                        <PanelLeftClose className="w-4 h-4 stroke-[1.8]" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Search Bar (if triggered) */}
                {isSearching && (
                  <div className="px-1">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f3f4f8] dark:bg-white/[0.06] text-[12px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="检索方案..."
                        className="bg-transparent border-none outline-none w-full text-slate-800 dark:text-slate-100 placeholder-slate-400 text-[11.5px]"
                        autoFocus
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 text-xs">
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Primary Navigation Group (Large 44px Chunky Pills, Reference UI "Classes ->") */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase px-2">
                    主要空间
                  </div>

                  {/* Pinned Top Favorites Item */}
                  <div
                    onClick={() => {
                      const allSchemes = folders.flatMap((f) => f.schemes);
                      const starred = allSchemes.filter((s) => s.artboards.some((a) => a.isStarred));
                      if (starred.length > 0) {
                        onSelectScheme(folders[0]?.id || '', starred[0]);
                      }
                    }}
                    className="group w-full h-[46px] px-3.5 rounded-2xl flex items-center justify-between transition-all duration-150 cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Star className="w-4 h-4 stroke-[1.8] text-amber-500 fill-amber-500/20 shrink-0" />
                      <span className="text-[13px] font-semibold truncate tracking-tight">
                        我的收藏精选
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                      置顶
                    </span>
                  </div>

                  {folders.map((folder) => {
                    // Check if current active scheme is in this folder
                    const isFolderActive = activeFolderId === folder.id;
                    const activeSchemeInFolder = folder.schemes.find((s) => s.id === activeSchemeId) || folder.schemes[0];

                    return (
                      <div
                        key={folder.id}
                        onClick={() => {
                          if (folder.schemes.length > 0) {
                            onSelectScheme(folder.id, activeSchemeInFolder);
                          } else {
                            onToggleFolder(folder.id);
                          }
                        }}
                        className={`group w-full h-[46px] px-3.5 rounded-2xl flex items-center justify-between transition-all duration-150 cursor-pointer ${
                          isFolderActive
                            ? 'bg-black text-white dark:bg-white dark:text-black shadow-md'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isFolderActive ? (
                            <FolderOpen className="w-4 h-4 stroke-[2] shrink-0" />
                          ) : (
                            <Folder className="w-4 h-4 stroke-[1.8] text-slate-400 group-hover:text-slate-600 shrink-0" />
                          )}
                          <span className="text-[13px] font-semibold truncate tracking-tight">
                            {folder.name}
                          </span>
                        </div>

                        {/* Right side: Arrow for active item (like "Classes ->"), or count chip */}
                        {isFolderActive ? (
                          <span className="text-sm font-bold opacity-90 transition-transform group-hover:translate-x-0.5">
                            →
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-slate-400 group-hover:text-slate-600">
                            {folder.schemes.length}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom New Space Action: Clean Minimal Button */}
              <div className="pt-2">
                <button
                  onClick={onNewFolder}
                  className="w-full h-9 rounded-2xl bg-[#f3f4f8] dark:bg-white/[0.06] hover:bg-[#eaecee] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 font-medium text-[11.5px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2]" />
                  <span>新建空间分类</span>
                </button>
              </div>
            </div>
          )}



          {/* TAB CONTENT B: WORKFLOW GALLERY SIDEBAR (Unified Intro + Pipeline Category Selection) */}
          {(activeActivity === 'workflow' || activeActivity === 'engine') &&
            workflowSubView === 'gallery' && (
              <div className="flex flex-col h-full justify-between">
                <div className="space-y-4 overflow-y-auto no-scrollbar pr-0.5">
                  {/* 1. Unified Header */}
                  <div className="flex items-center justify-between px-1 pt-1">
                    <div>
                      <h2 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                        工作流广场
                      </h2>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 tabular-nums">
                        共 {workflowPresets.length} 套 ComfyUI 节点管线
                      </p>
                    </div>
                    {onToggleCollapse && (
                      <button
                        type="button"
                        onClick={onToggleCollapse}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                        title="收回侧边栏"
                      >
                        <PanelLeftClose className="w-4 h-4 stroke-[1.8]" />
                      </button>
                    )}
                  </div>

                  {/* 2. Usage Introduction Card */}
                  <div className="p-3 rounded-2xl bg-[#f3f4f8] dark:bg-white/[0.05] space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-800 dark:text-slate-100">
                      <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>节点管线 · 即选即跑</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      选定预处理流后进入 4 分组电池画布，载入原图或从画布选图，一键跑出前后对比成果。
                    </p>
                  </div>

                  {/* 3. Interactive Pipeline Category Selector */}
                  <div className="space-y-1">
                    <div className="text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase px-2 pb-0.5">
                      管线类型选择
                    </div>
                    {(
                      [
                        { id: 'all', label: '全部工作流', count: workflowPresets.length },
                        {
                          id: 'model-to-render',
                          label: '模型转效果图',
                          count: workflowPresets.filter((p) => p.category === 'model-to-render')
                            .length,
                        },
                        {
                          id: 'inpaint',
                          label: '局部精修',
                          count: workflowPresets.filter((p) => p.category === 'inpaint').length,
                        },
                        {
                          id: 'upscale',
                          label: '无损放大',
                          count: workflowPresets.filter((p) => p.category === 'upscale').length,
                        },
                        {
                          id: 'cutout',
                          label: '智能抠图',
                          count: workflowPresets.filter((p) => p.category === 'cutout').length,
                        },
                        {
                          id: 'custom',
                          label: '本地已保存',
                          count: workflowPresets.filter((p) => p.category === 'custom').length,
                        },
                      ] as const
                    ).map((cat) => {
                      const isSel = activeWorkflowCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => onSelectWorkflowCategory?.(cat.id)}
                          className={`w-full h-[38px] px-3 rounded-xl flex items-center justify-between transition-all cursor-pointer text-[12.5px] ${
                            isSel
                              ? 'bg-black text-white dark:bg-white dark:text-black font-semibold shadow-sm'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white font-medium'
                          }`}
                        >
                          <span className="truncate">{cat.label}</span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full tabular-nums ${
                              isSel
                                ? 'bg-white/15 text-white dark:bg-black/15 dark:text-black'
                                : 'bg-black/[0.04] dark:bg-white/[0.08] text-slate-400'
                            }`}
                          >
                            {cat.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Ultra-Quiet Archive Drawer Entry */}
                {onOpenArchiveDrawer && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onOpenArchiveDrawer}
                      className="w-full h-9 px-3 rounded-2xl bg-[#f3f4f8] dark:bg-white/[0.05] hover:bg-[#eaecee] dark:hover:bg-white/[0.1] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-[11.5px] flex items-center justify-between transition-all cursor-pointer"
                      title="查看已归档的项目文件夹与运行记录"
                    >
                      <span className="flex items-center gap-1.5">
                        <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>运行归档记录</span>
                      </span>
                      <span className="text-[10px] font-mono opacity-70 tabular-nums">
                        {archiveRecordCount} →
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

          {/* TAB CONTENT C: PURE-TEXT PROMPT SKILL LIBRARY (Unified Monochrome Intro + Selection) */}
          {(activeActivity === 'skills' || activeActivity === 'models') && (
            <div className="flex flex-col h-full justify-between">
              <div className="space-y-4 overflow-y-auto no-scrollbar pr-0.5">
                {/* 1. Unified Header */}
                <div className="flex items-center justify-between px-1 pt-1">
                  <div>
                    <h2 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                      提示词技能库
                    </h2>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 tabular-nums">
                      共 {skills.length} 条纯文指令模板
                    </p>
                  </div>
                  {onToggleCollapse && (
                    <button
                      type="button"
                      onClick={onToggleCollapse}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                      title="收回侧边栏"
                    >
                      <PanelLeftClose className="w-4 h-4 stroke-[1.8]" />
                    </button>
                  )}
                </div>

                {/* 2. Usage Introduction Card */}
                <div className="p-3 rounded-2xl bg-[#f3f4f8] dark:bg-white/[0.05] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-800 dark:text-slate-100">
                    <Sparkles className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>纯文指令 · 选槽即用</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    选择分类浏览可复用提示词积木，点击「+ 追加 / 替换」按默认值直接写入生图框，点开卡片可微调 {'{变量}'}。
                  </p>
                </div>

                {/* 3. Interactive Category Selector */}
                <div className="space-y-1">
                  <div className="text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase px-2 pb-0.5">
                    技能分类选择
                  </div>
                  {[
                    { id: 'all', label: '全部技能', count: skills.length },
                    {
                      id: 'commercial',
                      label: '商业空间',
                      count: skills.filter((s) => s.category === 'commercial').length,
                    },
                    {
                      id: 'lighting',
                      label: '光影镜头',
                      count: skills.filter((s) => s.category === 'lighting').length,
                    },
                    {
                      id: 'materials',
                      label: '材质质感',
                      count: skills.filter((s) => s.category === 'materials').length,
                    },
                    {
                      id: 'styles',
                      label: '艺术风格',
                      count: skills.filter((s) => s.category === 'styles').length,
                    },
                    {
                      id: 'product',
                      label: '工业硬件',
                      count: skills.filter((s) => s.category === 'product').length,
                    },
                    {
                      id: 'negative',
                      label: '负向增强',
                      count: skills.filter((s) => s.category === 'negative').length,
                    },
                    {
                      id: 'favorites',
                      label: '我的收藏',
                      count: skills.filter((s) => s.isFavorite).length,
                    },
                  ].map((cat) => {
                    const isSel = activeSkillCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => onSelectSkillCategory?.(cat.id)}
                        className={`w-full h-[38px] px-3 rounded-xl flex items-center justify-between transition-all cursor-pointer text-[12.5px] ${
                          isSel
                            ? 'bg-black text-white dark:bg-white dark:text-black font-semibold shadow-sm'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white font-medium'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          {cat.id === 'favorites' && (
                            <Star
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSel ? 'text-amber-300 fill-amber-300' : 'text-amber-500 fill-amber-500/20'
                              }`}
                            />
                          )}
                          <span>{cat.label}</span>
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full tabular-nums ${
                            isSel
                              ? 'bg-white/15 text-white dark:bg-black/15 dark:text-black'
                              : 'bg-black/[0.04] dark:bg-white/[0.08] text-slate-400'
                          }`}
                        >
                          {cat.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Reset Action when filtered */}
              {activeSkillCategory !== 'all' && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onSelectSkillCategory?.('all')}
                    className="w-full h-9 rounded-2xl bg-[#f3f4f8] dark:bg-white/[0.06] hover:bg-[#eaecee] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 font-medium text-[11.5px] flex items-center justify-center transition-all cursor-pointer"
                  >
                    显示全部技能
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
