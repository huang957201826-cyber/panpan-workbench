import React, { useState, useRef } from 'react';
import {
  Search,
  FileJson,
  MoreHorizontal,
  Copy,
  Download,
  Pencil,
  Trash2,
  ArrowRight,
  Sparkles,
  FolderOpen,
  FolderPlus,
  Star,
  Send,
  RotateCcw,
  X,
  PanelLeftOpen,
} from 'lucide-react';
import {
  WorkflowPreset,
  WorkflowCategoryId,
  WorkflowProject,
  WorkflowHistoryRecord,
} from '../types';
import { WORKFLOW_DEMO_ASSETS } from '../data/mockWorkflows';

interface WorkflowGalleryViewProps {
  presets: WorkflowPreset[];
  onSelectPreset: (presetId: string) => void;
  onImportPresetJson: (preset: WorkflowPreset) => void;
  onDuplicatePreset: (preset: WorkflowPreset) => void;
  onRenamePreset: (presetId: string, newName: string) => void;
  onDeletePreset: (presetId: string) => void;
  onExportPresetJson: (preset: WorkflowPreset) => void;
  activeCategory?: 'all' | WorkflowCategoryId;
  onSelectCategory?: (category: 'all' | WorkflowCategoryId) => void;
  isArchiveDrawerOpen?: boolean;
  onToggleArchiveDrawer?: (open: boolean) => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  workflowProjects?: WorkflowProject[];
  activeWorkflowProjectId?: string;
  onSelectWorkflowProject?: (projectId: string) => void;
  onCreateWorkflowProject?: (name: string) => void;
  onToggleStarWorkflowProject?: (projectId: string) => void;
  onDeleteHistoryRecord?: (projectId: string, recordId: string) => void;
  onSendToCanvas?: (record: WorkflowHistoryRecord) => void;
  onReuseRecord?: (record: WorkflowHistoryRecord) => void;
}

const CATEGORY_TITLES: Record<'all' | WorkflowCategoryId, string> = {
  all: '全部工作流',
  'model-to-render': '模型转效果图',
  inpaint: '局部精修',
  upscale: '无损放大',
  cutout: '智能抠图',
  custom: '本地已保存',
};

export const WorkflowGalleryView: React.FC<WorkflowGalleryViewProps> = ({
  presets,
  onSelectPreset,
  onImportPresetJson,
  onDuplicatePreset,
  onRenamePreset,
  onDeletePreset,
  onExportPresetJson,
  activeCategory: controlledCategory,
  onSelectCategory,
  isArchiveDrawerOpen: controlledArchiveOpen,
  onToggleArchiveDrawer,
  isSidebarCollapsed = false,
  onToggleSidebar,
  workflowProjects = [],
  activeWorkflowProjectId = '',
  onSelectWorkflowProject,
  onCreateWorkflowProject,
  onToggleStarWorkflowProject,
  onDeleteHistoryRecord,
  onSendToCanvas,
  onReuseRecord,
}) => {
  const [internalCategory, setInternalCategory] = useState<'all' | WorkflowCategoryId>('all');
  const [internalArchiveOpen, setInternalArchiveOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const activeCategory = controlledCategory ?? internalCategory;
  const setActiveCategory = (cat: 'all' | WorkflowCategoryId) => {
    setInternalCategory(cat);
    onSelectCategory?.(cat);
  };

  const isArchiveDrawerOpen = controlledArchiveOpen ?? internalArchiveOpen;
  const setIsArchiveDrawerOpen = (open: boolean) => {
    setInternalArchiveOpen(open);
    onToggleArchiveDrawer?.(open);
  };

  const activeArchiveProject =
    workflowProjects.find((p) => p.id === activeWorkflowProjectId) || workflowProjects[0];
  const totalArchiveRecords = workflowProjects.reduce((acc, p) => acc + p.records.length, 0);

  const filteredPresets = presets.filter((p) => {
    if (activeCategory !== 'all' && p.category !== activeCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.categoryLabel.toLowerCase().includes(q)
    );
  });

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(String(ev.target?.result || '{}'));
        const base = presets[0];
        const imported: WorkflowPreset = {
          id: `wf-import-${Date.now()}`,
          name: raw.name || file.name.replace(/\.json$/i, ''),
          category: 'custom',
          categoryLabel: '本地已保存',
          badge: '导入 JSON',
          isCustom: true,
          description: raw.description || `从 ${file.name} 导入的本地工作流模板`,
          coverBeforeUrl: base?.coverBeforeUrl || WORKFLOW_DEMO_ASSETS.clayModel,
          coverAfterUrl: base?.coverAfterUrl || WORKFLOW_DEMO_ASSETS.renderedAtrium,
          groups: raw.groups || JSON.parse(JSON.stringify(base?.groups || [])),
          nodes:
            raw.nodes && Array.isArray(raw.nodes) && raw.nodes[0]?.type
              ? raw.nodes
              : JSON.parse(JSON.stringify(base?.nodes || [])),
          connections: raw.connections || JSON.parse(JSON.stringify(base?.connections || [])),
        };
        onImportPresetJson(imported);
        setActiveCategory('custom');
      } catch {
        // ignore invalid json
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className="relative w-full h-full bg-[#f3f4f8] dark:bg-[#0c0e14] text-slate-800 dark:text-slate-100 flex flex-col overflow-hidden font-sans"
      onClick={() => setOpenMenuId(null)}
    >
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileImport}
        className="hidden"
      />

      {/* CLEAN TOP HEADER (Category moved to Left Sidebar; Search + Import on Right) */}
      <div className="px-6 pt-4 pb-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {isSidebarCollapsed && onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="h-9 px-3 rounded-full bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.1] soft-card-shadow flex items-center gap-1.5 text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition cursor-pointer shrink-0"
            >
              <PanelLeftOpen className="w-3.5 h-3.5" />
              <span>展开分类</span>
            </button>
          )}

          <div className="flex items-baseline gap-2.5 min-w-0">
            <h1 className="text-[16px] font-bold tracking-tight text-slate-900 dark:text-white truncate">
              {CATEGORY_TITLES[activeCategory]}
            </h1>
            <span className="text-[11.5px] font-mono text-slate-400 tabular-nums shrink-0">
              {filteredPresets.length} 套流程
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="h-9 px-3 rounded-full bg-white dark:bg-[#141620] border border-black/[0.05] dark:border-white/[0.08] soft-card-shadow flex items-center gap-2 w-44 sm:w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索工作流..."
              className="bg-transparent border-none outline-none w-full text-[12px] text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="h-9 px-3.5 rounded-full bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.08] soft-card-shadow text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition flex items-center gap-1.5 cursor-pointer"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>导入 .json</span>
          </button>

          {isSidebarCollapsed && (
            <button
              type="button"
              onClick={() => setIsArchiveDrawerOpen(true)}
              className="h-9 px-3 rounded-full bg-white/80 dark:bg-[#141620]/80 border border-black/[0.05] dark:border-white/[0.08] text-[12px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-[#141620] transition flex items-center gap-1.5 cursor-pointer"
              title="查看已归档的项目文件夹与运行记录"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">归档</span>
              {totalArchiveRecords > 0 && (
                <span className="text-[10px] font-mono opacity-65 tabular-nums">
                  {totalArchiveRecords}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* VISUAL WORKFLOW GALLERY GRID (Before -> After Visual Pipeline Cards) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-1">
        {filteredPresets.length === 0 ? (
          <div className="h-full min-h-[280px] rounded-3xl bg-white/70 dark:bg-[#141620]/70 border border-black/[0.05] dark:border-white/[0.06] flex flex-col items-center justify-center gap-2.5 text-center p-8">
            <Sparkles className="w-7 h-7 text-slate-300 dark:text-slate-600" />
            <div className="text-[13.5px] font-semibold text-slate-700 dark:text-slate-200">
              {activeCategory === 'custom' ? '暂无本地保存的工作流' : '未找到匹配的工作流'}
            </div>
            <p className="text-[12px] text-slate-400 max-w-sm">
              {activeCategory === 'custom'
                ? '你可以先点开任意预设工作流，调顺参数后点击右上角「保存到本地」，或点击右上角直接导入 ComfyUI .json 文件。'
                : '试试更换搜索关键词或在左侧栏切换到「全部工作流」。'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredPresets.map((preset) => {
              const beforeUrl = preset.coverBeforeUrl || WORKFLOW_DEMO_ASSETS.clayModel;
              const afterUrl = preset.coverAfterUrl || WORKFLOW_DEMO_ASSETS.renderedAtrium;
              const isCutout = preset.category === 'cutout';
              const isRenaming = renamingId === preset.id;

              return (
                <div
                  key={preset.id}
                  onClick={() => {
                    if (!isRenaming) onSelectPreset(preset.id);
                  }}
                  className="group relative rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.05] dark:border-white/[0.07] soft-card-shadow hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 overflow-hidden cursor-pointer flex flex-col"
                >
                  {/* Visual Left-to-Right Before / After Split Preview Cover */}
                  <div className="relative h-[210px] sm:h-[230px] w-full overflow-hidden bg-[#eaecf2] dark:bg-[#0d0f16] shrink-0">
                    <div className="w-full h-full grid grid-cols-2">
                      {/* Left: Original Input */}
                      <div className="relative overflow-hidden border-r border-white/80 dark:border-black/60">
                        <img
                          src={beforeUrl}
                          alt="Before"
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        />
                        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/55 text-white text-[10px] backdrop-blur-xs whitespace-nowrap">
                          原图
                        </span>
                      </div>

                      {/* Right: Processed Result or Transparent Cutout */}
                      {isCutout ? (
                        <div
                          className="relative overflow-hidden flex items-center justify-center"
                          style={{
                            backgroundImage:
                              'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
                            backgroundSize: '16px 16px',
                            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          <img
                            src={afterUrl}
                            alt={preset.name}
                            className="max-w-[82%] max-h-[84%] object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
                          />
                          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/65 text-white text-[10px] backdrop-blur-xs whitespace-nowrap">
                            透明 PNG 抠像
                          </span>
                        </div>
                      ) : (
                        <div className="relative overflow-hidden">
                          <img
                            src={afterUrl}
                            alt="After"
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                          />
                          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/65 text-white text-[10px] backdrop-blur-xs whitespace-nowrap">
                            效果成图
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Center Left-to-Right Transformation Indicator */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/95 dark:bg-[#141620]/95 text-slate-800 dark:text-white shadow-md flex items-center justify-center pointer-events-none">
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.2]" />
                    </div>

                    {/* Top-Left Category Pill */}
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/75 text-white text-[10px] font-medium backdrop-blur-xs">
                      {preset.isCustom ? '本地已保存' : preset.categoryLabel}
                    </span>

                    {/* Top-Right More Actions Button */}
                    <div
                      className="absolute top-2 right-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === preset.id ? null : preset.id);
                      }}
                    >
                      <button
                        type="button"
                        className="w-7 h-7 rounded-full bg-black/55 hover:bg-black text-white flex items-center justify-center backdrop-blur-xs opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        title="管理工作流"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {openMenuId === preset.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-8 w-36 rounded-xl bg-white dark:bg-[#1a1d2a] border border-black/[0.08] dark:border-white/[0.1] shadow-xl p-1 z-30 text-[11.5px]"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onDuplicatePreset(preset);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 text-left cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>复制一份到本地</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onExportPresetJson(preset);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 text-left cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-400" />
                            <span>导出 .json</span>
                          </button>
                          {preset.isCustom && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setRenamingId(preset.id);
                                  setRenameValue(preset.name);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 text-left cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5 text-slate-400" />
                                <span>重命名</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onDeletePreset(preset.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 text-rose-600 flex items-center gap-2 text-left cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>删除</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Metadata */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-2">
                    <div className="space-y-1">
                      {isRenaming ? (
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && renameValue.trim()) {
                              onRenamePreset(preset.id, renameValue.trim());
                              setRenamingId(null);
                            } else if (e.key === 'Escape') {
                              setRenamingId(null);
                            }
                          }}
                          onBlur={() => {
                            if (renameValue.trim()) {
                              onRenamePreset(preset.id, renameValue.trim());
                            }
                            setRenamingId(null);
                          }}
                          className="w-full h-7 px-2 rounded-lg bg-[#f3f4f8] dark:bg-black/30 border border-black/20 text-[12.5px] font-bold outline-none"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-[13px] font-bold text-slate-900 dark:text-white truncate">
                            {preset.name}
                          </h3>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-black dark:group-hover:text-white group-hover:translate-x-0.5 transition shrink-0" />
                        </div>
                      )}
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QUIET SLIDE-OVER ARCHIVE RECORDS DRAWER */}
      {isArchiveDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] flex justify-end"
          onClick={() => setIsArchiveDrawerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[440px] h-full bg-[#f8f9fc] dark:bg-[#12141c] border-l border-black/[0.08] dark:border-white/[0.08] shadow-2xl flex flex-col"
          >
            {/* Drawer Header */}
            <div className="h-14 px-5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between shrink-0 bg-white dark:bg-[#141620]">
              <div>
                <div className="text-[13.5px] font-bold text-slate-900 dark:text-white">
                  归档项目与运行记录
                </div>
                <div className="text-[11px] text-slate-400">
                  共 {workflowProjects.length} 个归档目录 · {totalArchiveRecords} 条成果记录
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {onCreateWorkflowProject && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                    className="h-7.5 px-2.5 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-black hover:text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer transition"
                  >
                    <FolderPlus className="w-3 h-3" />
                    <span>新建目录</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsArchiveDrawerOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Inline Folder Creator */}
            {isCreatingFolder && (
              <div className="px-5 py-2.5 bg-white dark:bg-[#141620] border-b border-black/[0.06] dark:border-white/[0.08] flex items-center gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newFolderName.trim()) {
                      onCreateWorkflowProject?.(newFolderName.trim());
                      setNewFolderName('');
                      setIsCreatingFolder(false);
                    }
                  }}
                  placeholder="输入新归档项目名称..."
                  className="flex-1 h-8 px-3 rounded-xl bg-[#f3f4f8] dark:bg-black/30 text-[12px] outline-none border border-black/10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newFolderName.trim()) return;
                    onCreateWorkflowProject?.(newFolderName.trim());
                    setNewFolderName('');
                    setIsCreatingFolder(false);
                  }}
                  className="h-8 px-3 rounded-xl bg-black text-white dark:bg-white dark:text-black text-[11.5px] font-semibold cursor-pointer"
                >
                  创建
                </button>
              </div>
            )}

            {/* Folder Selector Strip */}
            <div className="px-5 py-3 border-b border-black/[0.05] dark:border-white/[0.06] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {workflowProjects
                .slice()
                .sort((a, b) => Number(Boolean(b.isStarred)) - Number(Boolean(a.isStarred)))
                .map((proj) => {
                  const isSel = proj.id === activeArchiveProject?.id;
                  return (
                    <div
                      key={proj.id}
                      onClick={() => onSelectWorkflowProject?.(proj.id)}
                      className={`h-7.5 px-2.5 rounded-full flex items-center gap-1.5 text-[11.5px] cursor-pointer shrink-0 transition ${
                        isSel
                          ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                          : 'bg-white dark:bg-[#141620] text-slate-600 dark:text-slate-300 border border-black/[0.06] dark:border-white/[0.08] hover:border-black/25'
                      }`}
                    >
                      {onToggleStarWorkflowProject && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleStarWorkflowProject(proj.id);
                          }}
                          className="cursor-pointer"
                          title={proj.isStarred ? '取消置顶' : '置顶目录'}
                        >
                          <Star
                            className={`w-3 h-3 ${
                              proj.isStarred
                                ? 'text-amber-400 fill-amber-400'
                                : 'opacity-45 hover:opacity-90'
                            }`}
                          />
                        </button>
                      )}
                      <span>{proj.name}</span>
                      <span className="text-[10px] font-mono opacity-65 tabular-nums">
                        {proj.records.length}
                      </span>
                    </div>
                  );
                })}
            </div>

            {/* Records List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
              {!activeArchiveProject || activeArchiveProject.records.length === 0 ? (
                <div className="h-52 rounded-2xl bg-white/70 dark:bg-[#141620]/60 border border-black/[0.05] flex flex-col items-center justify-center gap-1.5 text-center p-6">
                  <FolderOpen className="w-6 h-6 text-slate-300" />
                  <div className="text-[12.5px] font-semibold text-slate-600 dark:text-slate-300">
                    「{activeArchiveProject?.name || '当前项目'}」暂无运行记录
                  </div>
                  <p className="text-[11px] text-slate-400">
                    在任意工作流画布点击运行后，成果将自动归档到此目录。
                  </p>
                </div>
              ) : (
                activeArchiveProject.records.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.08] soft-card-shadow p-3 space-y-2.5"
                  >
                    <div className="grid grid-cols-2 gap-2 h-24">
                      <div className="relative rounded-xl overflow-hidden bg-[#f3f4f8]">
                        <img src={rec.inputUrl} alt="Before" className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.2 rounded bg-black/60 text-white text-[9px]">
                          原图
                        </span>
                      </div>
                      <div className="relative rounded-xl overflow-hidden bg-[#f3f4f8]">
                        <img src={rec.outputUrl} alt="After" className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.2 rounded bg-black/75 text-white text-[9px]">
                          成图
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12px] font-bold text-slate-900 dark:text-white truncate">
                          {rec.title}
                        </div>
                        <div className="text-[10.5px] text-slate-400 truncate mt-0.5">
                          {rec.summary} · {rec.createdAt}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-black/[0.05] dark:border-white/[0.06]">
                      <div className="flex items-center gap-1.5">
                        {onReuseRecord && (
                          <button
                            type="button"
                            onClick={() => {
                              onReuseRecord(rec);
                              setIsArchiveDrawerOpen(false);
                            }}
                            className="h-7 px-2.5 rounded-lg bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-black hover:text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer transition"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>载入工作流</span>
                          </button>
                        )}
                        {onSendToCanvas && (
                          <button
                            type="button"
                            onClick={() => {
                              onSendToCanvas(rec);
                              setIsArchiveDrawerOpen(false);
                            }}
                            className="h-7 px-2.5 rounded-lg bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-black hover:text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer transition"
                          >
                            <Send className="w-3 h-3" />
                            <span>入画布</span>
                          </button>
                        )}
                      </div>

                      {onDeleteHistoryRecord && (
                        <button
                          type="button"
                          onClick={() => onDeleteHistoryRecord(activeArchiveProject.id, rec.id)}
                          className="w-7 h-7 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-600 flex items-center justify-center cursor-pointer transition"
                          title="删除记录"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
