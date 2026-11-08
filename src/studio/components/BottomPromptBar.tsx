import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Plus,
  ArrowUp,
  Check,
  Trash2,
  X,
  Sliders,
  Layers,
  Crosshair,
  Link as LinkIcon,
  BookmarkPlus,
} from 'lucide-react';
import type { GenerationParams, ReferenceImage } from '../types.ts';
import { getAtImageQuery, imageMentionMatches } from '../../lib/promptImageMentions';
import { MAX_PROMPT_LENGTH, clampPrompt } from '../../lib/promptLimits';
import { submitShortcutHint } from '../../lib/platform';
import { useStore } from '../../store';
import { Menu as PopMenu } from '../../ui';
import { PromptMentionOverlay } from './PromptMentionOverlay';
import SizePickerModal from '../../components/SizePickerModal';
import AddImageUrlsModal from '../../components/input/addImageUrlsModal';

interface BottomPromptBarProps {
  prompt: string;
  onPromptChange: (newPrompt: string) => void;
  onGenerate: (promptText: string, params: GenerationParams) => void;
  isGenerating: boolean;
  referenceImages: ReferenceImage[];
  onAddReferenceImage?: (image: ReferenceImage) => void;
  onAddReferenceFile?: (file: File) => void;
  onOpenMask?: () => void;
  batchEnabled?: boolean;
  onToggleBatch?: () => void;
  onRemoveReferenceImage?: (id: string) => void;
  onClearReferenceImages?: () => void;
  onReorderReferenceImages?: (newOrder: ReferenceImage[]) => void;
  params?: GenerationParams;
  onParamsChange?: (params: GenerationParams) => void;
  onDockRight?: () => void;
  modelOptions?: Array<{ id: string; label: string }>;
  aspectRatios?: Array<{ label: string; res: string }>;
  countOptions?: number[];
  onStartCanvasPick?: () => void;
  canvasPickActive?: boolean;
  onSaveAsSkill?: () => void;
  /** 打开设置里的模型配置（模型列表由 API profile 的逗号分隔字段决定） */
  onManageModels?: () => void;
}

export const BottomPromptBar: React.FC<BottomPromptBarProps> = ({
  prompt,
  onPromptChange,
  onGenerate,
  isGenerating,
  referenceImages,
  onAddReferenceImage,
  onAddReferenceFile,
  onOpenMask,
  batchEnabled = false,
  onToggleBatch,
  onRemoveReferenceImage,
  onClearReferenceImages,
  onReorderReferenceImages,
  params: externalParams,
  onParamsChange,
  onDockRight,
  onStartCanvasPick,
  canvasPickActive = false,
  onSaveAsSkill,
  onManageModels,
  modelOptions = [{ id: 'gpt-image-2.5', label: 'gpt-image-2.5' }],
  aspectRatios = [
    { label: '1:1', res: '1024x1024' },
    { label: '3:2', res: '1536x1024' },
    { label: '2:3', res: '1024x1536' },
  ],
  countOptions = [1, 2, 4],
}) => {
  const [internalParams, setInternalParams] = useState<GenerationParams>({
    model: 'gpt-image-2.5',
    dimension: '2560×1440',
    quality: 'auto',
    count: 1,
    format: 'PNG',
    transparent: false,
    filter: 'auto',
  });

  const params = externalParams || internalParams;
  const setParams = (newP: GenerationParams) => {
    if (onParamsChange) {
      onParamsChange(newP);
    } else {
      setInternalParams(newP);
    }
  };

  const [draggedRefIndex, setDraggedRefIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [promptHeight, setPromptHeight] = useState(64)
  const [promptScrollTop, setPromptScrollTop] = useState(0);
  const [isResizingPromptHeight, setIsResizingPromptHeight] = useState(false);
  const startDragYRef = useRef(0);
  const startPromptHeightRef = useRef(64);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [showAddImageUrls, setShowAddImageUrls] = useState(false);

  const atMenuRef = useRef<HTMLDivElement>(null);
  const submitHint = submitShortcutHint;
  const modelMenuRef = useRef<HTMLButtonElement>(null);
  const sizeMenuRef = useRef<HTMLButtonElement>(null);
  const qualityMenuRef = useRef<HTMLButtonElement>(null);
  const countMenuRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upward pull handle drag logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingPromptHeight) return;
      const deltaY = startDragYRef.current - e.clientY;
      const newHeight = Math.max(50, Math.min(240, startPromptHeightRef.current + deltaY));
      setPromptHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingPromptHeight(false);
    };

    if (isResizingPromptHeight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingPromptHeight]);

  const missingReference = referenceImages.some((ref) => ref.missing);
  const handleSend = () => {
    if (!prompt.trim() || isGenerating) return;
    if (missingReference) {
      useStore.getState().showToast('参考图中有已被删除的素材，请先移除后再提交。', 'error');
      return;
    }
    onGenerate(clampPrompt(prompt), params);
  };

  const enterSubmit = useStore((s) => s.settings.enterSubmit);
  const isComposingRef = useRef(false);
  const [atMenuOpen, setAtMenuOpen] = useState(false);
  const [atMenuIndex, setAtMenuIndex] = useState(0);

  // 下拉菜单的外部点击由 Menu 组件自己用 pointerdown 处理（它会同时排除锚点与 portal 内容）。
  // 这里只负责内联的 @参考图候选层：早期版本在此监听 document mousedown 并用
  // dropdownRef.contains 判断外部点击，但 P5 把 Menu 改成 portal 挂到 document.body 后，
  // 菜单不在 dropdownRef 内，mousedown 会把「点选项」误判成「点在外面」，
  // 菜单在 click 之前被卸载，导致所有下拉选项静默失效（BUG-01）。
  useEffect(() => {
    if (!atMenuOpen) return;
    const handleAtMenuOutside = (event: PointerEvent) => {
      if (atMenuRef.current?.contains(event.target as Node)) return;
      setAtMenuOpen(false);
      setAtMenuIndex(0);
    };
    document.addEventListener('pointerdown', handleAtMenuOutside);
    return () => document.removeEventListener('pointerdown', handleAtMenuOutside);
  }, [atMenuOpen]);

  const atOptions = referenceImages.filter((_, index) => {
    const cursor = textareaRef.current?.selectionStart ?? prompt.length;
    const query = getAtImageQuery(prompt, cursor, referenceImages);
    return query ? imageMentionMatches(query.query, index) : false;
  });

  const closeAtMenu = () => {
    setAtMenuOpen(false);
    setAtMenuIndex(0);
  };

  const refreshAtMenu = (value: string, cursor: number) => {
    setAtMenuOpen(Boolean(getAtImageQuery(value, cursor, referenceImages)));
    setAtMenuIndex(0);
  };

  // 选中候选或点击参考图：把 @ 查询替换为 @图N
  const insertImageTag = (tagNum: number, replaceQuery = false) => {
    const tag = `@图${tagNum} `;
    const el = textareaRef.current;
    if (!el) {
      onPromptChange(clampPrompt(`${prompt} ${tag}`));
      closeAtMenu();
      return;
    }
    const cursor = el.selectionStart ?? prompt.length;
    const query = replaceQuery ? getAtImageQuery(prompt, cursor, referenceImages) : null;
    const start = query ? query.start : (el.selectionStart ?? prompt.length);
    const end = query ? cursor : (el.selectionEnd ?? prompt.length);
    const updated = clampPrompt(prompt.slice(0, start) + tag + prompt.slice(end));
    onPromptChange(updated);
    closeAtMenu();
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + tag.length, start + tag.length);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 中文输入法组字期间用 Enter 选词，不能当作提交
    if (e.key === 'Enter' && (e.nativeEvent.isComposing || isComposingRef.current || e.nativeEvent.keyCode === 229)) {
      return;
    }
    if (atMenuOpen && atOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAtMenuIndex((idx) => (idx + 1) % atOptions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAtMenuIndex((idx) => (idx - 1 + atOptions.length) % atOptions.length);
        return;
      }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
        e.preventDefault();
        const option = atOptions[atMenuIndex] ?? atOptions[0];
        if (option) insertImageTag(option.tagNumber, true);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAtMenu();
        return;
      }
    }
    if (e.key === 'Enter') {
      const withModifier = e.metaKey || e.ctrlKey;
      if ((enterSubmit && !e.shiftKey) || withModifier) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  // Handle local file upload as reference
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    e.target.value = '';
    if (onAddReferenceFile) {
      onAddReferenceFile(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && onAddReferenceImage) {
        const newRef: ReferenceImage = {
          id: `ref-${Date.now()}`,
          url: event.target.result as string,
          name: file.name,
          tagNumber: (referenceImages?.length || 0) + 1,
          weight: 0.75,
          role: 'ref',
        };
        onAddReferenceImage(newRef);
      }
    };
    reader.readAsDataURL(file);
  };

  // 输入台宽度随窗口分级增长：窄窗铺满可用宽度，大屏封顶保证行长可读
  return (
    <div className="w-full max-w-[1320px] mx-auto px-4 lg:px-6 pb-1 z-30 shrink-0 pointer-events-auto">
      {/* =========================================================================
          1. FLOATING REFERENCE IMAGE SHELF (Exact replica of user reference image)
          ========================================================================= */}
      {referenceImages && referenceImages.length > 0 && (
        <div className="mb-2 flex items-center gap-2 overflow-x-auto no-scrollbar py-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2 px-1">
            {referenceImages.map((ref, idx) => (
              <div
                key={ref.id}
                draggable
                onDragStart={(e) => {
                  setDraggedRefIndex(idx);
                  e.dataTransfer.effectAllowed = 'copyMove';
                  e.dataTransfer.setData('application/x-studio-image', JSON.stringify({ imageId: ref.id, url: ref.url, name: ref.name }));
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverIndex !== idx) setDragOverIndex(idx);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedRefIndex !== null && draggedRefIndex !== idx && onReorderReferenceImages) {
                    const next = [...referenceImages];
                    const [removed] = next.splice(draggedRefIndex, 1);
                    next.splice(idx, 0, removed);
                    onReorderReferenceImages(next);
                  }
                  setDraggedRefIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDraggedRefIndex(null);
                  setDragOverIndex(null);
                }}
                className={`relative group shrink-0 transition-all duration-150 ${
                  draggedRefIndex === idx ? 'opacity-30 scale-95' : ''
                } ${
                  dragOverIndex === idx && draggedRefIndex !== idx
                    ? 'ring-2 ring-black/40 dark:ring-white/40 scale-105'
                    : ''
                }`}
              >
                {/* Thumbnail card */}
                <div
                  onClick={() => { if (!ref.missing) insertImageTag(ref.tagNumber); }}
                  className={`w-[52px] h-[52px] rounded-xl overflow-hidden border border-black/15 dark:border-white/20 bg-black/5 dark:bg-white/5 shadow-sm relative ${ref.missing ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-105 transition-all duration-150'}`}
                  title={ref.missing ? `${ref.name}：画布素材已删除，请移除该参考图` : `点击在提示词插入 @图${ref.tagNumber} (${ref.name}) · 可左右拖动调整顺序`}
                >
                  {ref.missing ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-black/[0.08] px-1 text-center text-caption leading-tight text-slate-500 dark:bg-white/[0.1] dark:text-slate-300">
                      <span className="text-body-sm">×</span>
                      <span>素材已删除</span>
                    </div>
                  ) : (
                    <img
                      src={ref.url}
                      alt={ref.name}
                      className="w-full h-full object-cover pointer-events-none"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {/* Number Badge (Bottom-left circular indicator: ❶ / 1) */}
                  <div className="absolute bottom-1 left-1 min-w-4 rounded-full bg-black/80 px-1 text-white flex items-center justify-center text-caption font-mono font-bold shadow-xs">
                    图{ref.tagNumber}
                  </div>
                </div>

                {/* Floating Micro Delete Cross */}
                {onRemoveReferenceImage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveReferenceImage(ref.id);
                    }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black/85 text-white hover:bg-red-600 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs text-caption"
                    title="移除该参考图"
                  >
                    ×
                  </button>
                )}

                {/* Hover Weight Slider Popover removed: 运行时权重未接线 */}
              </div>
            ))}

            {/* Clear All Dotted Action Box (Matches user screenshot: 垃圾桶 + 清空) */}
            {onClearReferenceImages && (
              <button
                onClick={onClearReferenceImages}
                className="w-[52px] h-[52px] rounded-xl border border-dashed border-black/20 dark:border-white/20 hover:border-black/40 dark:hover:border-white/40 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] flex flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer shrink-0"
                title="清空全部参考图"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[1.4]" />
                <span className="text-caption">清空</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input for uploading references */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Upward Drag Gripper Bar (Minimalist Monochrome) */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          startDragYRef.current = e.clientY;
          startPromptHeightRef.current = promptHeight;
          setIsResizingPromptHeight(true);
        }}
        className="w-full h-[8px] cursor-row-resize hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] flex items-center justify-center transition-colors group mb-1"
        title="按住向上拉伸提示词输入框"
      >
        <div className="w-8 h-[2.5px] rounded-full bg-black/15 dark:bg-white/20 group-hover:bg-black/40 dark:group-hover:bg-white/50 transition-colors"></div>
      </div>

      {/* Main Generative Prompt Card (Frosted Floating Acrylic Glass HUD, 12px rounded-xl) */}
      <div className="rounded-xl bg-white/80 dark:bg-[#141620]/80 border border-black/10 dark:border-white/10 shadow-2xl p-2.5 flex flex-col gap-1.5 backdrop-blur-2xl relative transition-all duration-150 focus-within:bg-white/92 dark:focus-within:bg-[#141620]/95 focus-within:border-black/25 dark:focus-within:border-white/25 focus-within:shadow-[0_12px_36px_rgba(0,0,0,0.12)]">
        {/* Clear prompt button if has text */}
        {prompt && (
          <div className="absolute top-2.5 right-2.5 z-10 text-slate-400">
            <button
              onClick={() => onPromptChange('')}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
              title="清空提示词"
            >
              <X className="w-3.5 h-3.5 stroke-[1.4]" />
            </button>
          </div>
        )}

        {/* Textarea */}
        <div className="relative">
          {atMenuOpen && atOptions.length > 0 && (
            <div ref={atMenuRef} className="absolute bottom-full left-0 z-50 mb-1 w-56 overflow-hidden rounded-xl border border-black/[0.08] bg-white/95 p-1 shadow-xl backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#1c1e29]/95">
              <div className="px-2 pb-1 pt-0.5 text-caption text-slate-400">选择参考图</div>
              <div className="max-h-52 overflow-y-auto">
                {atOptions.map((ref, optionIndex) => (
                  <button
                    key={ref.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertImageTag(ref.tagNumber, true);
                    }}
                    onMouseEnter={() => setAtMenuIndex(optionIndex)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-body-sm transition ${
                      optionIndex === atMenuIndex
                        ? 'bg-black/[0.06] text-slate-900 dark:bg-white/[0.1] dark:text-white'
                        : 'text-slate-600 hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <img src={ref.url} alt="" className="h-6 w-6 rounded object-cover" referrerPolicy="no-referrer" />
                    <span className="min-w-0 flex-1 truncate font-medium">@图{ref.tagNumber}</span>
                    <span className="shrink-0 text-caption text-slate-400">{ref.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <textarea
            ref={textareaRef}
            style={{ height: `${promptHeight}px` }}
            value={prompt}
            maxLength={MAX_PROMPT_LENGTH}
            onChange={(e) => {
              const next = clampPrompt(e.target.value);
              onPromptChange(next);
              refreshAtMenu(next, e.target.selectionStart ?? next.length);
            }}
            onScroll={(e) => setPromptScrollTop(e.currentTarget.scrollTop)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
            placeholder={`描述你想生成的设计方案... (可输入 @图1、@图2 引用上方参考图，${enterSubmit ? 'Enter' : 'Ctrl+Enter'} 发送)`}
            className={`relative w-full bg-transparent resize-none border-none p-1 pr-8 text-body-sm leading-relaxed text-transparent caret-slate-800 dark:caret-slate-100 placeholder-slate-400 focus:ring-0 outline-none font-sans`}
          />
          <PromptMentionOverlay
            prompt={prompt}
            scrollTop={promptScrollTop}
            className="p-1 pr-8 text-body-sm leading-relaxed font-sans text-slate-800 dark:text-slate-100"
          />
          {prompt.length >= MAX_PROMPT_LENGTH && (
            <div className="pointer-events-none absolute bottom-1 right-2 text-caption text-amber-600 dark:text-amber-400">
              已达 {MAX_PROMPT_LENGTH} 字上限
            </div>
          )}
        </div>

        {/* Single-line Pill Options Row (Strictly matching user screenshot) */}
        <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-black/[0.04] dark:border-white/[0.05] relative text-caption select-none">
          {/* Left: Scrollable single row of pills (no wrap, strictly 1 line) */}
          <div className="contents">
            {/* 1. Model Capsule: gpt-image-2.5 ⌵ */}
            <div className="relative shrink-0">
              <button
                ref={modelMenuRef}
                onClick={() => setActiveDropdown(activeDropdown === 'model' ? null : 'model')}
                className="flex items-center gap-1 px-2.5 py-0.5 h-[26px] rounded-full bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 text-caption font-medium transition cursor-pointer"
              >
                <span className="font-mono">{params.model}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 stroke-[1.8]" />
              </button>
              <PopMenu open={activeDropdown === 'model'} anchorRef={modelMenuRef} width={220} onClose={() => setActiveDropdown(null)}>
                {modelOptions.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    data-active={params.model === m.id ? 'true' : undefined}
                    onClick={() => {
                      setParams({ ...params, model: m.id });
                      setActiveDropdown(null);
                    }}
                    className={`text-caption w-full text-left px-2 py-1 rounded-md cursor-pointer transition flex items-center justify-between ${
                      params.model === m.id
                        ? 'bg-black/[0.08] dark:bg-white/[0.12] text-slate-900 dark:text-white font-medium'
                        : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span>{m.label}</span>
                    {params.model === m.id && <Check className="w-3 h-3 stroke-[2.5]" />}
                  </button>
                ))}
                {onManageModels && (
                  <button
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => {
                      setActiveDropdown(null);
                      onManageModels();
                    }}
                    className="mt-0.5 w-full text-left cursor-pointer rounded-md border-t border-black/5 px-2 py-1 text-caption text-slate-500 hover:bg-black/5 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10"
                  >
                    管理模型列表…
                  </button>
                )}
              </PopMenu>
            </div>

            {/* 2. Dimension Capsule: 尺寸 2560×1440 ⌵ */}
            <div className="relative shrink-0">
              <button
                ref={sizeMenuRef}
                onClick={() => setActiveDropdown(activeDropdown === 'dimension' ? null : 'dimension')}
                className="flex items-center gap-1 px-2.5 py-0.5 h-[26px] rounded-full bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 text-caption font-medium transition cursor-pointer"
              >
                <span className="text-slate-400">尺寸</span>
                <span className="font-mono">{aspectRatios.find((item) => item.res === params.dimension)?.label ?? params.dimension}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 stroke-[1.8]" />
              </button>
              <PopMenu open={activeDropdown === 'dimension'} anchorRef={sizeMenuRef} width={220} onClose={() => setActiveDropdown(null)}>
                {aspectRatios.map((d) => (
                  <button
                    key={d.res}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    data-active={params.dimension === d.res ? 'true' : undefined}
                    onClick={() => {
                      setParams({ ...params, dimension: d.res });
                      setActiveDropdown(null);
                    }}
                    className={`text-caption w-full text-left px-2 py-1 rounded-md cursor-pointer transition flex items-center justify-between ${
                      params.dimension === d.res
                        ? 'bg-black/[0.08] dark:bg-white/[0.12] text-slate-900 dark:text-white font-medium'
                        : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="whitespace-nowrap">{d.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    setActiveDropdown(null);
                    setShowSizePicker(true);
                  }}
                  className="mt-0.5 w-full text-left cursor-pointer rounded-md border-t border-black/5 px-2 py-1 text-caption text-slate-500 hover:bg-black/5 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10"
                >
                  更多尺寸 / 比例…
                </button>
              </PopMenu>
            </div>

            {/* 3. Quality Capsule: 质量 auto ⌵ */}
            <div className="relative shrink-0">
              <button
                ref={qualityMenuRef}
                onClick={() => setActiveDropdown(activeDropdown === 'quality' ? null : 'quality')}
                className="flex items-center gap-1 px-2.5 py-0.5 h-[26px] rounded-full bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 text-caption font-medium transition cursor-pointer"
              >
                <span className="text-slate-400">质量</span>
                <span>{params.quality}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 stroke-[1.8]" />
              </button>
              <PopMenu open={activeDropdown === 'quality'} anchorRef={qualityMenuRef} width={112} onClose={() => setActiveDropdown(null)}>
                {['auto', 'low', 'medium', 'high', 'xhigh', 'max'].map((q) => (
                  <button
                    key={q}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    data-active={params.quality === q ? 'true' : undefined}
                    onClick={() => {
                      setParams({ ...params, quality: q });
                      setActiveDropdown(null);
                    }}
                    className={`text-caption w-full text-left px-2 py-1 rounded-md cursor-pointer transition ${
                      params.quality === q
                        ? 'bg-black/[0.08] dark:bg-white/[0.12] text-slate-900 dark:text-white font-medium'
                        : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </PopMenu>
            </div>

            {/* 4. Count Capsule: 数量 1 ⌵ */}
            <div className="relative shrink-0">
              <button
                ref={countMenuRef}
                onClick={() => setActiveDropdown(activeDropdown === 'count' ? null : 'count')}
                className="flex items-center gap-1 px-2.5 py-0.5 h-[26px] rounded-full bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 text-caption font-medium transition cursor-pointer"
              >
                <span className="text-slate-400">数量</span>
                <span>{params.count}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 stroke-[1.8]" />
              </button>
              <PopMenu open={activeDropdown === 'count'} anchorRef={countMenuRef} width={96} onClose={() => setActiveDropdown(null)}>
                {countOptions.map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    data-active={params.count === cnt ? 'true' : undefined}
                    onClick={() => {
                      setParams({ ...params, count: cnt });
                      setActiveDropdown(null);
                    }}
                    className={`text-caption w-full text-left px-2 py-1 rounded-md cursor-pointer transition ${
                      params.count === cnt
                        ? 'bg-black/[0.08] dark:bg-white/[0.12] text-slate-900 dark:text-white font-medium'
                        : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {cnt} 张
                  </button>
                ))}
              </PopMenu>
            </div>

            {/* 5. More Capsule: 更多 · PNG · 透明 false · 审核 auto ⌵ */}
            <div className="relative shrink-0">
              <button
                ref={moreMenuRef}
                onClick={() => setActiveDropdown(activeDropdown === 'more' ? null : 'more')}
                className="flex items-center gap-1 px-2.5 py-0.5 h-[26px] rounded-full bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 text-caption font-medium transition cursor-pointer"
              >
                <span>更多</span>
                <span className="font-mono text-caption opacity-60">{params.format}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 stroke-[1.8]" />
              </button>
              <PopMenu open={activeDropdown === 'more'} anchorRef={moreMenuRef} width={256} onClose={() => setActiveDropdown(null)}>
                  <div className="text-body-sm font-semibold text-slate-800 dark:text-white pb-1 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
                    <span>通道与元数据设置</span>
                    <Sliders className="w-3 h-3 stroke-[1.4]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-caption text-slate-500">导出格式</span>
                    <div className="flex gap-1">
                      {(['PNG', 'WebP', 'JPEG'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          role="menuitem"
                          tabIndex={-1}
                          onClick={() => setParams({ ...params, format: fmt })}
                          className={`px-2 py-0.5 rounded text-caption font-mono transition cursor-pointer ${
                            params.format === fmt
                              ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                              : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-caption text-slate-500">透明背景通道</span>
                    <button
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      onClick={() => setParams({ ...params, transparent: !params.transparent })}
                      className={`px-2 py-0.5 rounded text-caption font-mono transition cursor-pointer ${
                        params.transparent
                          ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                          : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {params.transparent ? '开启' : '关闭'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-caption text-slate-500">内容审核</span>
                    <div className="flex gap-1">
                      {[
                        { value: 'auto', label: 'auto' },
                        { value: 'standard', label: 'low' },
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          role="menuitem"
                          tabIndex={-1}
                          onClick={() => setParams({ ...params, filter: item.value as GenerationParams['filter'] })}
                          className={`px-2 py-0.5 rounded text-caption font-mono transition cursor-pointer ${
                            params.filter === item.value
                              ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                              : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {onToggleBatch && (
                    <div className="flex items-center justify-between">
                      <span className="text-caption text-slate-500">批量提交</span>
                      <button
                        type="button"
                        role="menuitem"
                        tabIndex={-1}
                        onClick={onToggleBatch}
                        className={`px-2 py-0.5 rounded text-caption font-mono transition cursor-pointer ${
                          batchEnabled
                            ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                            : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {batchEnabled ? '开启' : '关闭'}
                      </button>
                    </div>
                  )}
              </PopMenu>
            </div>
          </div>

          {/* Right Action Buttons: [+] Upload Reference, [◨] Switch to Right Workspace, and [↑] Generate */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
            {/* [+] Button: Trigger reference image upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-6 h-6 rounded-full bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-600 dark:text-slate-200 flex items-center justify-center transition cursor-pointer"
              title="添加本地参考图"
            >
              <Plus className="w-3.5 h-3.5 stroke-[1.8]" />
            </button>

            {onOpenMask && (
              <button
                onClick={onOpenMask}
                className="w-6 h-6 rounded-full bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-600 dark:text-slate-200 flex items-center justify-center transition cursor-pointer"
                title="打开遮罩编辑器"
              >
                <Layers className="w-3.5 h-3.5 stroke-[1.6]" />
              </button>
            )}

            <button
              onClick={() => setShowAddImageUrls(true)}
              className="w-6 h-6 rounded-full bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-600 dark:text-slate-200 flex items-center justify-center transition cursor-pointer"
              title="通过图片链接添加参考图"
            >
              <LinkIcon className="w-3.5 h-3.5 stroke-[1.8]" />
            </button>

            {onStartCanvasPick && (
              <button
                onClick={onStartCanvasPick}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition cursor-pointer ${
                  canvasPickActive
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-600 dark:text-slate-200'
                }`}
                title="从画布选择参考图（Esc 取消）"
                aria-label="从画布选择参考图"
                aria-pressed={canvasPickActive}
              >
                <Crosshair className="w-3.5 h-3.5 stroke-[1.8]" />
              </button>
            )}

            {onSaveAsSkill && (
              <button
                onClick={onSaveAsSkill}
                disabled={!prompt.trim()}
                className="w-6 h-6 rounded-full bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-600 dark:text-slate-200 flex items-center justify-center transition cursor-pointer disabled:opacity-35"
                title="保存为技能"
                aria-label="保存为技能"
              >
                <BookmarkPlus className="w-3.5 h-3.5 stroke-[1.8]" />
              </button>
            )}

            {/* Switch to Right Workspace Docking */}
            {onDockRight && (
              <button
                onClick={onDockRight}
                className="w-6 h-6 rounded-full bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-600 dark:text-slate-200 flex items-center justify-center transition cursor-pointer"
                title="切换至右侧停靠工作台 (◨ 历史流与控制台)"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <rect x="1" y="1" width="10" height="10" rx="1.5" />
                  <line x1="7.5" y1="1" x2="7.5" y2="11" />
                </svg>
              </button>
            )}

            {/* Pure Monochrome Send Button with embedded micro shortcut badge */}
            <button
              onClick={handleSend}
              disabled={isGenerating || !prompt.trim() || missingReference}
              className="h-7 px-2.5 rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-85 active:scale-95 flex items-center justify-center gap-1 transition shadow-xs disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="立即生成方案 (Ctrl+Enter)"
            >
              {isGenerating ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black rounded-full animate-spin"></div>
              ) : (
                <>
                  <ArrowUp className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span className="text-caption font-mono opacity-50 font-normal">{submitHint}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showSizePicker && (
        <SizePickerModal
          currentSize={params.dimension}
          onSelect={(size) => setParams({ ...params, dimension: size })}
          onClose={() => setShowSizePicker(false)}
        />
      )}

      {showAddImageUrls && <AddImageUrlsModal onClose={() => setShowAddImageUrls(false)} />}
    </div>
  );
};
