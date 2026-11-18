import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Plus,
  ArrowUp,
  Check,
  Trash2,
  Maximize2,
  X,
  Sliders,
} from 'lucide-react';
import { GenerationParams, ReferenceImage } from '../types.ts';

interface BottomPromptBarProps {
  prompt: string;
  onPromptChange: (newPrompt: string) => void;
  onGenerate: (promptText: string, params: GenerationParams) => void;
  isGenerating: boolean;
  referenceImages: ReferenceImage[];
  onAddReferenceImage?: (image: ReferenceImage) => void;
  onRemoveReferenceImage?: (id: string) => void;
  onClearReferenceImages?: () => void;
  onUpdateReferenceWeight?: (id: string, weight: number) => void;
  onReorderReferenceImages?: (newOrder: ReferenceImage[]) => void;
  params?: GenerationParams;
  onParamsChange?: (params: GenerationParams) => void;
  onDockRight?: () => void;
}

export const BottomPromptBar: React.FC<BottomPromptBarProps> = ({
  prompt,
  onPromptChange,
  onGenerate,
  isGenerating,
  referenceImages,
  onAddReferenceImage,
  onRemoveReferenceImage,
  onClearReferenceImages,
  onUpdateReferenceWeight,
  onReorderReferenceImages,
  params: externalParams,
  onParamsChange,
  onDockRight,
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

  const [promptHeight, setPromptHeight] = useState(64);
  const [isResizingPromptHeight, setIsResizingPromptHeight] = useState(false);
  const startDragYRef = useRef(0);
  const startPromptHeightRef = useRef(64);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isZenMode, setIsZenMode] = useState(false);
  const [hoveredRefId, setHoveredRefId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
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

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = () => {
    if (!prompt.trim() || isGenerating) return;
    onGenerate(prompt, params);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  // Insert tag @图1, @图2 into textarea
  const insertImageTag = (tagNum: number) => {
    const tag = `@图${tagNum} `;
    if (!textareaRef.current) {
      onPromptChange(`${prompt} ${tag}`);
      return;
    }
    const start = textareaRef.current.selectionStart || prompt.length;
    const end = textareaRef.current.selectionEnd || prompt.length;
    const updated = prompt.slice(0, start) + tag + prompt.slice(end);
    onPromptChange(updated);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + tag.length, start + tag.length);
      }
    }, 10);
  };

  // Handle local file upload as reference
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
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
    e.target.value = '';
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-1 z-30 shrink-0 pointer-events-auto">
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
                  e.dataTransfer.effectAllowed = 'move';
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
                onMouseEnter={() => setHoveredRefId(ref.id)}
                onMouseLeave={() => setHoveredRefId(null)}
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
                  onClick={() => insertImageTag(ref.tagNumber)}
                  className="w-[52px] h-[52px] rounded-xl overflow-hidden border border-black/15 dark:border-white/20 bg-black/5 dark:bg-white/5 cursor-pointer shadow-sm hover:scale-105 transition-all duration-150 relative"
                  title={`点击在提示词插入 @图${ref.tagNumber} (${ref.name}) · 可左右拖动调整顺序`}
                >
                  <img
                    src={ref.url}
                    alt={ref.name}
                    className="w-full h-full object-cover pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                  {/* Number Badge (Bottom-left circular indicator: ❶ / 1) */}
                  <div className="absolute bottom-1 left-1 w-4 h-4 rounded-full bg-black/80 text-white flex items-center justify-center text-[9px] font-mono font-bold shadow-xs">
                    {ref.tagNumber}
                  </div>
                </div>

                {/* Floating Micro Delete Cross */}
                {onRemoveReferenceImage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveReferenceImage(ref.id);
                    }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black/85 text-white hover:bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs text-[10px]"
                    title="移除该参考图"
                  >
                    ×
                  </button>
                )}

                {/* Hover Weight Slider Popover */}
                {hoveredRefId === ref.id && onUpdateReferenceWeight && (
                  <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-32 p-2 rounded-lg bg-white/95 dark:bg-[#1c1e29]/95 border border-black/10 dark:border-white/10 shadow-xl backdrop-blur-md z-50 text-[10px] space-y-1">
                    <div className="flex items-center justify-between text-slate-500 font-mono">
                      <span>图{ref.tagNumber} 权重</span>
                      <span>{(ref.weight || 0.75).toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={ref.weight || 0.75}
                      onChange={(e) => onUpdateReferenceWeight(ref.id, parseFloat(e.target.value))}
                      className="w-full accent-black dark:accent-white h-1 cursor-pointer"
                    />
                  </div>
                )}
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
                <span className="text-[9.5px]">清空</span>
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

      {/* Main Generative Prompt Card (Plush Floating Island with Soft Ambient Shadow, Reference UI) */}
      <div className="rounded-2xl bg-white dark:bg-[#151824] border border-black/[0.05] dark:border-white/[0.08] shadow-[0_16px_40px_-6px_rgba(15,23,42,0.09),0_0_0_1px_rgba(15,23,42,0.03)] p-3 flex flex-col gap-2 relative transition-all duration-150 focus-within:shadow-[0_20px_48px_rgba(15,23,42,0.13)]">
        {/* Clear prompt button if has text */}
        {prompt && (
          <div className="absolute top-3 right-3 z-10 text-slate-400">
            <button
              onClick={() => onPromptChange('')}
              className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
              title="清空提示词"
            >
              <X className="w-3.5 h-3.5 stroke-[1.4]" />
            </button>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          style={{ height: `${promptHeight}px` }}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="描述你想生成的设计方案... (可输入 @图1、@图2 引用上方参考图，Ctrl+Enter 发送)"
          className={`w-full bg-transparent resize-none border-none p-1 text-[12px] leading-relaxed text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-0 outline-none font-sans ${prompt ? 'pr-8' : 'pr-2'}`}
        />

        {/* Single-line Pill Options Row (Strictly matching reference UI capsules) */}
        <div
          ref={dropdownRef}
          className="flex items-center justify-between pt-2 border-t border-black/[0.04] dark:border-white/[0.05] relative text-[11px] select-none"
        >
          {/* Left: Scrollable single row of pills (no wrap, strictly 1 line) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-nowrap shrink whitespace-nowrap pr-2">
            {/* 1. Model Capsule: gpt-image-2.5 ⌵ */}
            <div className="relative shrink-0">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'model' ? null : 'model')}
                className="flex items-center gap-1.5 px-3 py-1 h-[28px] rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-[#eaecee] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-100 text-[11px] font-medium transition cursor-pointer"
              >
                <span className="font-mono">{params.model}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 stroke-[1.8]" />
              </button>
              {activeDropdown === 'model' && (
                <div className="absolute bottom-8 left-0 w-44 glass-panel rounded-lg p-1 z-50 text-[11px] shadow-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1d28]">
                  {[
                    'gpt-image-2.5',
                    'flux.1-dev (本地)',
                    'sd-xl-base-1.0',
                    'imagen-3-hd',
                    'flux.1-schnell',
                  ].map((m) => (
                    <div
                      key={m}
                      onClick={() => {
                        setParams({ ...params, model: m });
                        setActiveDropdown(null);
                      }}
                      className={`px-2 py-1 rounded-md cursor-pointer transition flex items-center justify-between ${
                        params.model === m
                          ? 'bg-black/[0.08] dark:bg-white/[0.12] text-slate-900 dark:text-white font-medium'
                          : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <span>{m}</span>
                      {params.model === m && <Check className="w-3 h-3 stroke-[2.5]" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Dimension Capsule: 尺寸 2560×1440 ⌵ */}
            <div className="relative shrink-0">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'dimension' ? null : 'dimension')}
                className="flex items-center gap-1.5 px-3 py-1 h-[28px] rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-[#eaecee] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-100 text-[11px] font-medium transition cursor-pointer"
              >
                <span className="text-slate-400 font-normal">尺寸</span>
                <span className="font-mono text-[10.5px]">{params.dimension}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 stroke-[2]" />
              </button>
              {activeDropdown === 'dimension' && (
                <div className="absolute bottom-9 left-0 w-44 rounded-xl p-1.5 z-50 text-[11px] soft-float-shadow border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1d28]">
                  {[
                    { label: '2560×1440', desc: '16:9 横屏 2.5K' },
                    { label: '1920×1080', desc: '16:9 全高清' },
                    { label: '2048×2048', desc: '1:1 正方' },
                    { label: '1440×2560', desc: '9:16 竖版' },
                    { label: '2048×1536', desc: '4:3 经典' },
                  ].map((d) => (
                    <div
                      key={d.label}
                      onClick={() => {
                        setParams({ ...params, dimension: d.label });
                        setActiveDropdown(null);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition flex items-center justify-between ${
                        params.dimension === d.label
                          ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                          : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <span>{d.label}</span>
                      <span className="text-[10px] opacity-60">{d.desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Quality Capsule: 质量 auto ⌵ */}
            <div className="relative shrink-0">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'quality' ? null : 'quality')}
                className="flex items-center gap-1.5 px-3 py-1 h-[28px] rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-[#eaecee] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-100 text-[11px] font-medium transition cursor-pointer"
              >
                <span className="text-slate-400 font-normal">质量</span>
                <span>{params.quality}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 stroke-[2]" />
              </button>
              {activeDropdown === 'quality' && (
                <div className="absolute bottom-9 left-0 w-28 rounded-xl p-1.5 z-50 text-[11px] soft-float-shadow border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1d28]">
                  {['auto', 'standard', 'hd', 'ultra'].map((q) => (
                    <div
                      key={q}
                      onClick={() => {
                        setParams({ ...params, quality: q });
                        setActiveDropdown(null);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition capitalize ${
                        params.quality === q
                          ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                          : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {q}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Count Capsule: 数量 1 ⌵ */}
            <div className="relative shrink-0">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'count' ? null : 'count')}
                className="flex items-center gap-1.5 px-3 py-1 h-[28px] rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-[#eaecee] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-100 text-[11px] font-medium transition cursor-pointer"
              >
                <span className="text-slate-400 font-normal">数量</span>
                <span className="font-semibold">{params.count}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 stroke-[2]" />
              </button>
              {activeDropdown === 'count' && (
                <div className="absolute bottom-9 left-0 w-24 rounded-xl p-1.5 z-50 text-[11px] soft-float-shadow border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1d28]">
                  {[1, 2, 4].map((cnt) => (
                    <div
                      key={cnt}
                      onClick={() => {
                        setParams({ ...params, count: cnt });
                        setActiveDropdown(null);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition ${
                        params.count === cnt
                          ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                          : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {cnt} 张
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. More Capsule: 更多 · PNG · 透明 false ⌵ */}
            <div className="relative shrink-0">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'more' ? null : 'more')}
                className="flex items-center gap-1.5 px-3 py-1 h-[28px] rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-[#eaecee] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-100 text-[11px] font-medium transition cursor-pointer"
              >
                <span>
                  更多 · {params.format} · 透明 {String(params.transparent)}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 stroke-[2]" />
              </button>
              {activeDropdown === 'more' && (
                <div className="absolute bottom-9 left-0 w-64 rounded-xl p-3 z-50 text-[11px] soft-float-shadow border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1d28] flex flex-col gap-2.5">
                  <div className="font-semibold text-slate-800 dark:text-white pb-1.5 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
                    <span>通道与元数据设置</span>
                    <Sliders className="w-3.5 h-3.5 stroke-[1.5]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">导出格式</span>
                    <div className="flex gap-1">
                      {(['PNG', 'WebP', 'JPEG'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => setParams({ ...params, format: fmt })}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-mono transition cursor-pointer ${
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
                    <span className="text-slate-500">透明背景通道</span>
                    <button
                      onClick={() => setParams({ ...params, transparent: !params.transparent })}
                      className={`px-3 py-1 rounded-full text-[10px] font-mono transition cursor-pointer ${
                        params.transparent
                          ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                          : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {params.transparent ? '开启' : '关闭'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Action Buttons: [+] Upload Reference, [◨] Switch to Right Workspace, and [↑] Generate */}
          <div className="flex items-center gap-2 shrink-0 pl-1">
            {/* [+] Button: Trigger reference image upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-7 h-7 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-[#eaecee] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 flex items-center justify-center transition cursor-pointer shadow-xs"
              title="添加本地参考图 / 垫图"
            >
              <Plus className="w-4 h-4 stroke-[2]" />
            </button>

            {/* Switch to Right Workspace Docking */}
            {onDockRight && (
              <button
                onClick={onDockRight}
                className="w-7 h-7 rounded-full bg-[#f3f4f8] dark:bg-white/[0.08] hover:bg-[#eaecee] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 flex items-center justify-center transition cursor-pointer shadow-xs"
                title="切换至右侧停靠工作台 (◨ 历史流与控制台)"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="1" width="10" height="10" rx="2" />
                  <line x1="7.5" y1="1" x2="7.5" y2="11" />
                </svg>
              </button>
            )}

            {/* Pure Monochrome Send Pill Button with embedded micro shortcut badge */}
            <button
              onClick={handleSend}
              disabled={isGenerating || !prompt.trim()}
              className="h-8 px-3.5 rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-90 active:scale-95 flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="立即生成方案 (Ctrl+Enter)"
            >
              {isGenerating ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black rounded-full animate-spin"></div>
              ) : (
                <>
                  <ArrowUp className="w-4 h-4 stroke-[2.2]" />
                  <span className="text-[10px] font-mono opacity-60 font-semibold tracking-wide">⌘↵</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Zen Fullscreen Modal */}
      {isZenMode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-[780px] max-w-[95vw] rounded-2xl bg-white dark:bg-[#161822] border border-black/10 dark:border-white/10 shadow-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
              <span className="font-semibold text-sm">沉浸专注提示词创作面板</span>
              <button
                onClick={() => setIsZenMode(false)}
                className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4 stroke-[1.4]" />
              </button>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="在此自由编写长篇空间设计提示词与多图参考指令..."
              className="w-full h-80 bg-transparent resize-none border-none p-2 text-sm leading-relaxed text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-0 outline-none font-sans"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
              <button
                onClick={() => setIsZenMode(false)}
                className="px-4 py-1.5 rounded-lg bg-black text-white dark:bg-white dark:text-black text-xs font-medium cursor-pointer"
              >
                完成编辑
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
