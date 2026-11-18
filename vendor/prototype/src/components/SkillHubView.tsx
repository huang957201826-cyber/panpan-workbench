import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Star,
  Copy,
  Check,
  Zap,
  X,
  PanelLeftOpen,
  Plus,
  Trash2,
} from 'lucide-react';
import { SkillItem, SkillVariable } from '../types';

interface SkillHubViewProps {
  skills: SkillItem[];
  onApplySkill: (skill: SkillItem, customizedPrompt: string, mode?: 'replace' | 'append') => void;
  onToggleFavorite: (skillId: string) => void;
  onCreateSkill: (skill: SkillItem) => void;
  onDeleteSkill: (skillId: string) => void;
  activeCategory?: string;
  onSelectCategory?: (category: string) => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

const CATEGORY_TITLES: Record<string, string> = {
  all: '全部技能',
  commercial: '商业空间',
  lighting: '光影镜头',
  materials: '材质质感',
  styles: '艺术风格',
  product: '工业硬件',
  negative: '负向增强',
  favorites: '我的收藏',
};

const CREATE_CATEGORY_OPTIONS: { id: SkillItem['category']; label: string }[] = [
  { id: 'commercial', label: '商业空间' },
  { id: 'lighting', label: '光影镜头' },
  { id: 'materials', label: '材质质感' },
  { id: 'styles', label: '艺术风格' },
  { id: 'product', label: '工业硬件' },
  { id: 'negative', label: '负向增强' },
];

function renderFormulaWithVariables(template: string) {
  const parts = template.split(/(\{[^}]+\})/g);
  return parts.map((part, idx) => {
    if (/^\{[^}]+\}$/.test(part)) {
      return (
        <span
          key={idx}
          className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded-md bg-black text-white dark:bg-white dark:text-black text-[10.5px] font-mono font-semibold align-baseline"
        >
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function resolvePromptWithDefaults(skill: SkillItem): string {
  let result = skill.promptTemplate;
  if (skill.variables) {
    skill.variables.forEach((v) => {
      result = result.replace(new RegExp(`\\{${v.key}\\}`, 'g'), v.defaultValue);
    });
  }
  return result;
}

function extractVariablesFromTemplate(template: string): SkillVariable[] {
  const matches = template.match(/\{([^}]+)\}/g) || [];
  const seen = new Set<string>();
  const vars: SkillVariable[] = [];
  matches.forEach((m) => {
    const key = m.slice(1, -1).trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      vars.push({
        key,
        label: key,
        defaultValue: key,
        placeholder: `输入${key}...`,
      });
    }
  });
  return vars;
}

export const SkillHubView: React.FC<SkillHubViewProps> = ({
  skills,
  onApplySkill,
  onToggleFavorite,
  onCreateSkill,
  onDeleteSkill,
  activeCategory: controlledCategory,
  onSelectCategory,
  isSidebarCollapsed = false,
  onToggleSidebar,
}) => {
  const [internalCategory, setInternalCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const activeCategory = controlledCategory ?? internalCategory;
  const setActiveCategory = (cat: string) => {
    setInternalCategory(cat);
    onSelectCategory?.(cat);
  };

  // Pure-Text Variable Slot Inspector Modal
  const [inspectingSkill, setInspectingSkill] = useState<SkillItem | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create Custom Skill Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<SkillItem['category']>('commercial');
  const [newDesc, setNewDesc] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newNegative, setNewNegative] = useState('');

  const handleCopyText = (text: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleOpenDetail = (skill: SkillItem) => {
    setInspectingSkill(skill);
    const defaults: Record<string, string> = {};
    if (skill.variables) {
      skill.variables.forEach((v) => {
        defaults[v.key] = v.defaultValue;
      });
    }
    setVariableValues(defaults);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newPrompt.trim()) return;
    const catOption =
      CREATE_CATEGORY_OPTIONS.find((c) => c.id === newCategory) || CREATE_CATEGORY_OPTIONS[0];
    const extractedVars = extractVariablesFromTemplate(newPrompt);

    const created: SkillItem = {
      id: `skill-custom-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      categoryLabel: catOption.label,
      description: newDesc.trim() || '自定义纯文字提示词技能模板',
      recommendedModel: '通用',
      promptTemplate: newPrompt.trim(),
      negativePrompt: newNegative.trim() || undefined,
      tags: [],
      variables: extractedVars.length > 0 ? extractedVars : undefined,
      isFavorite: false,
      author: '我的自建',
    };

    onCreateSkill(created);
    setNewTitle('');
    setNewDesc('');
    setNewPrompt('');
    setNewNegative('');
    setIsCreateModalOpen(false);
    setActiveCategory('all');
  };

  const assembledPrompt = useMemo(() => {
    if (!inspectingSkill) return '';
    let result = inspectingSkill.promptTemplate;
    if (inspectingSkill.variables) {
      inspectingSkill.variables.forEach((v) => {
        const val = variableValues[v.key] || v.defaultValue;
        result = result.replace(new RegExp(`\\{${v.key}\\}`, 'g'), val);
      });
    }
    return result;
  }, [inspectingSkill, variableValues]);

  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      if (activeCategory === 'favorites') {
        if (!s.isFavorite) return false;
      } else if (activeCategory !== 'all') {
        if (s.category !== activeCategory) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = s.title.toLowerCase().includes(q);
        const inDesc = s.description.toLowerCase().includes(q);
        const inPrompt = s.promptTemplate.toLowerCase().includes(q);
        if (!inTitle && !inDesc && !inPrompt) return false;
      }

      return true;
    });
  }, [skills, activeCategory, searchQuery]);

  return (
    <div className="relative w-full h-full bg-[#f3f4f8] dark:bg-[#0c0e14] text-slate-800 dark:text-slate-100 flex flex-col overflow-hidden font-sans select-none">
      {/* =========================================================================
          MINIMAL TOP HEADER (Search + New Skill; No Category Bar, No Model Pills)
          ========================================================================= */}
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
              {CATEGORY_TITLES[activeCategory] || '全部技能'}
            </h1>
            <span className="text-[11.5px] font-mono text-slate-400 tabular-nums shrink-0">
              {filteredSkills.length} 条技能
            </span>
          </div>
        </div>

        {/* Right: Clean Search + Create Skill CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-9 px-3 rounded-full bg-white dark:bg-[#141620] border border-black/[0.05] dark:border-white/[0.08] soft-card-shadow flex items-center gap-2 w-48 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索技能标题或指令词..."
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
            onClick={() => setIsCreateModalOpen(true)}
            className="h-9 px-3.5 rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-90 active:scale-95 transition text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>新建技能</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2-COLUMN PURE-TEXT SKILL INSTRUCTION CARDS (0 Images, 0 Tags)
          ========================================================================= */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-1">
        {filteredSkills.length === 0 ? (
          <div className="h-full min-h-[280px] rounded-3xl bg-white/70 dark:bg-[#141620]/70 border border-black/[0.05] dark:border-white/[0.06] flex flex-col items-center justify-center gap-2.5 text-center p-8">
            <Sparkles className="w-7 h-7 text-slate-300 dark:text-slate-600" />
            <div className="text-[13.5px] font-semibold text-slate-700 dark:text-slate-200">
              未匹配到相关提示词技能
            </div>
            <p className="text-[12px] text-slate-400 max-w-sm">
              试试更换搜索关键词或在左侧栏切换分类，也可以点击右上角自建纯文指令。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredSkills.map((skill) => {
              const isCustom = skill.id.startsWith('skill-custom-');
              const resolvedDefaultPrompt = resolvePromptWithDefaults(skill);
              const varCount = skill.variables?.length || 0;

              return (
                <div
                  key={skill.id}
                  onClick={() => handleOpenDetail(skill)}
                  className="group rounded-2xl bg-white dark:bg-[#141620] border border-black/[0.05] dark:border-white/[0.07] soft-card-shadow hover:shadow-lg transition-all duration-150 p-4 cursor-pointer flex flex-col justify-between gap-3"
                >
                  {/* Row 1: Identity Header (Title + Category Badge + Star) */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-bold text-[14px] text-slate-900 dark:text-white tracking-tight truncate">
                          {skill.title}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 text-[10px] font-medium shrink-0">
                          {skill.categoryLabel}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-slate-400 dark:text-slate-500 line-clamp-1">
                        {skill.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isCustom && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSkill(skill.id);
                            if (inspectingSkill?.id === skill.id) setInspectingSkill(null);
                          }}
                          className="w-7 h-7 rounded-full hover:bg-rose-500/10 text-slate-300 hover:text-rose-500 flex items-center justify-center transition cursor-pointer"
                          title="删除自建技能"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(skill.id);
                        }}
                        className="w-7 h-7 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center justify-center transition cursor-pointer"
                        title={skill.isFavorite ? '取消收藏' : '加入收藏'}
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            skill.isFavorite
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Full-Width Structured Prompt Instruction Block */}
                  <div className="rounded-xl bg-[#f7f8fb] dark:bg-black/30 border border-black/[0.04] dark:border-white/[0.06] px-3.5 py-2.5 text-[12px] leading-relaxed text-slate-700 dark:text-slate-300 line-clamp-4">
                    {renderFormulaWithVariables(skill.promptTemplate)}
                  </div>

                  {/* Row 3: Quiet Metadata + Copy / Append / Replace */}
                  <div className="pt-2 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 min-w-0">
                      {varCount > 0 ? (
                        <span className="truncate">{varCount} 个可调变量 · 点击卡片微调</span>
                      ) : (
                        <span className="truncate">固定指令 · 开箱即用</span>
                      )}
                      {skill.negativePrompt && (
                        <span className="px-1.5 py-0.2 rounded bg-black/[0.04] dark:bg-white/[0.08] text-slate-500 dark:text-slate-400 text-[10px] shrink-0">
                          含负向词
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleCopyText(resolvedDefaultPrompt, skill.id, e)}
                        className="h-7.5 px-2.5 rounded-full bg-[#f3f4f8] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 transition cursor-pointer"
                        title="按默认值复制完整指令文本"
                      >
                        {copiedId === skill.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600 stroke-[2]" />
                            <span className="text-emerald-600 font-medium">已复制</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 stroke-[1.7]" />
                            <span>复制</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplySkill(skill, resolvedDefaultPrompt, 'append');
                        }}
                        className="h-7.5 px-2.5 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-slate-700 dark:text-slate-200 font-medium text-[11px] flex items-center gap-1 transition cursor-pointer"
                        title="按默认值合成后追加到当前提示词末尾"
                      >
                        <Plus className="w-3 h-3 stroke-[2]" />
                        <span>追加</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplySkill(skill, resolvedDefaultPrompt, 'replace');
                        }}
                        className="h-7.5 px-3 rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-85 active:scale-95 font-semibold text-[11px] flex items-center gap-1 transition cursor-pointer"
                        title="按默认值合成后替换当前提示词"
                      >
                        <Zap className="w-3 h-3 fill-current stroke-none" />
                        <span>替换</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          PURE-TEXT VARIABLE SLOT INSPECTOR MODAL (Zero Images)
          ========================================================================= */}
      {inspectingSkill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/55 backdrop-blur-xs"
          onClick={() => setInspectingSkill(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[84vh] rounded-3xl bg-white dark:bg-[#141620] border border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="h-14 px-5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2.5 py-0.5 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] text-[10.5px] font-medium text-slate-600 dark:text-slate-300 shrink-0">
                  {inspectingSkill.categoryLabel}
                </span>
                <span className="font-bold text-[14px] text-slate-900 dark:text-white tracking-tight truncate">
                  {inspectingSkill.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectingSkill(null)}
                className="w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Pure Text Slots vs Live Assembled Prompt */}
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Description & Parameter Slots */}
              <div className="flex flex-col gap-3">
                <div className="p-3.5 rounded-2xl bg-[#f3f4f8] dark:bg-white/[0.04] space-y-1.5">
                  <div className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">
                    适用说明
                  </div>
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {inspectingSkill.description}
                  </p>
                </div>

                {inspectingSkill.variables && inspectingSkill.variables.length > 0 ? (
                  <div className="p-3.5 rounded-2xl bg-[#f3f4f8] dark:bg-white/[0.04] space-y-3 flex-1">
                    <div className="flex items-center justify-between text-[11.5px] font-bold text-slate-800 dark:text-slate-200">
                      <span>可调参数槽</span>
                      <span className="text-[10.5px] font-normal text-slate-400">
                        修改后右侧实时合成
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {inspectingSkill.variables.map((v) => (
                        <div key={v.key} className="space-y-1">
                          <label className="text-[10.5px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                            <span>{v.label}</span>
                            <span className="font-mono opacity-75">{`{${v.key}}`}</span>
                          </label>

                          {v.options && v.options.length > 0 ? (
                            <select
                              value={variableValues[v.key] || v.defaultValue}
                              onChange={(e) =>
                                setVariableValues({ ...variableValues, [v.key]: e.target.value })
                              }
                              className="w-full h-8.5 bg-white dark:bg-[#141620] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-2.5 text-[11.5px] text-slate-800 dark:text-slate-200 outline-none"
                            >
                              {v.options.map((opt, i) => (
                                <option key={i} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={variableValues[v.key] || ''}
                              onChange={(e) =>
                                setVariableValues({ ...variableValues, [v.key]: e.target.value })
                              }
                              placeholder={v.placeholder || '输入自定义内容...'}
                              className="w-full h-8.5 bg-white dark:bg-[#141620] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-2.5 text-[11.5px] text-slate-800 dark:text-slate-200 outline-none"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-[#f3f4f8] dark:bg-white/[0.04] text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed flex-1">
                    该技能为固定指令模板，无可变参数槽，可直接复制或一键追加到现有描述中。
                  </div>
                )}
              </div>

              {/* Right Column: Live Assembled Positive Prompt + Optional Negative Prompt */}
              <div className="flex flex-col gap-3">
                <div className="flex-1 flex flex-col p-3.5 rounded-2xl bg-[#f3f4f8] dark:bg-white/[0.04] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">
                      实时合成提示词
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(assembledPrompt, 'modal-prompt')}
                      className="text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === 'modal-prompt' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500 stroke-[2]" />
                          <span className="text-emerald-500">已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 stroke-[1.6]" />
                          <span>复制全文</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex-1 p-3.5 rounded-xl bg-white dark:bg-[#141620] border border-black/[0.06] dark:border-white/[0.06] text-slate-700 dark:text-slate-200 text-[12px] leading-relaxed overflow-y-auto min-h-[140px]">
                    {assembledPrompt}
                  </div>
                </div>

                {inspectingSkill.negativePrompt && (
                  <div className="p-3.5 rounded-2xl bg-[#f3f4f8] dark:bg-white/[0.04] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        配套负向过滤词
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(inspectingSkill.negativePrompt || '', 'modal-neg')
                        }
                        className="text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === 'modal-neg' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500 stroke-[2]" />
                            <span className="text-emerald-500">已复制</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 stroke-[1.6]" />
                            <span>复制负向词</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 leading-relaxed">
                      {inspectingSkill.negativePrompt}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="h-14 px-5 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400">
                可追加到当前底栏提示词末尾，或直接替换
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInspectingSkill(null)}
                  className="h-8.5 px-3.5 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-black/10 transition text-[11.5px] font-medium cursor-pointer"
                >
                  关闭
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApplySkill(inspectingSkill, assembledPrompt, 'append');
                    setInspectingSkill(null);
                  }}
                  className="h-8.5 px-3.5 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-slate-800 dark:text-slate-100 font-semibold text-[11.5px] flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>追加</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApplySkill(inspectingSkill, assembledPrompt, 'replace');
                    setInspectingSkill(null);
                  }}
                  className="h-8.5 px-4 rounded-full bg-black text-white dark:bg-white dark:text-black font-semibold text-[11.5px] flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 fill-current stroke-none" />
                  <span>替换</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CREATE CUSTOM PURE-TEXT SKILL MODAL (+ 新建技能)
          ========================================================================= */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/55 backdrop-blur-xs"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <form
            onSubmit={handleCreateSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#141620] border border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden text-xs"
          >
            <div className="h-14 px-5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between shrink-0">
              <h2 className="font-bold text-[14px] text-slate-900 dark:text-white">
                新建纯文提示词技能
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    技能名称 *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="例如：商业中庭黄昏泛光"
                    className="w-full h-9 px-3 rounded-xl bg-[#f3f4f8] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] outline-none text-[12px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    所属分类
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as SkillItem['category'])}
                    className="w-full h-9 px-3 rounded-xl bg-[#f3f4f8] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] outline-none text-[12px]"
                  >
                    {CREATE_CATEGORY_OPTIONS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  一句话说明（可选）
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="说明该条提示词的适用场景"
                  className="w-full h-9 px-3 rounded-xl bg-[#f3f4f8] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] outline-none text-[12px]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    提示词公式模板 *
                  </label>
                  <span className="text-[10.5px] text-slate-400">
                    用 <code className="font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10">{'{变量名}'}</code> 自动生成可调参数槽
                  </span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="例如：现代商业空间{主体}，采用{主材质}与3000K暖光洗墙灯，两点透视建筑摄影，8k高细节。"
                  className="w-full p-3 rounded-xl bg-[#f3f4f8] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] outline-none text-[12px] leading-relaxed resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  配套负向过滤词（可选）
                </label>
                <input
                  type="text"
                  value={newNegative}
                  onChange={(e) => setNewNegative(e.target.value)}
                  placeholder="模糊, 变形, 低分辨率, 塑料质感, 水印"
                  className="w-full h-9 px-3 rounded-xl bg-[#f3f4f8] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] outline-none text-[12px]"
                />
              </div>
            </div>

            <div className="h-14 px-5 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="h-8.5 px-4 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-black/10 transition text-[11.5px] font-medium cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="h-8.5 px-4 rounded-full bg-black text-white dark:bg-white dark:text-black font-semibold text-[11.5px] hover:opacity-90 transition cursor-pointer"
              >
                保存技能
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
