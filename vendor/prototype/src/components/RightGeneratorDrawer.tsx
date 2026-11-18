import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ArrowUp,
  X,
  Trash2,
  Clock,
  Sparkles,
  Sliders,
  Maximize2,
  Download,
  Copy,
  Check,
  PanelRightClose,
  LayoutGrid,
  Image as ImageIcon,
  Layers,
  Crosshair,
} from 'lucide-react';
import { Artboard, GenerationParams, ReferenceImage } from '../types.ts';

interface RightGeneratorDrawerProps {
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
  artboards: Artboard[];
  selectedArtboardId: string | null;
  onSelectArtboard: (id: string | null) => void;
  onFocusArtboard?: (id: string) => void;
  onSetAsReference?: (artboard: Artboard) => void;
  onRecallPrompt?: (artboard: Artboard) => void;
  onCloseOrDockBottom: () => void;
}

export const RightGeneratorDrawer: React.FC<RightGeneratorDrawerProps> = ({
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
  artboards,
  selectedArtboardId,
  onSelectArtboard,
  onFocusArtboard,
  onSetAsReference,
  onRecallPrompt,
  onCloseOrDockBottom,
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'params'>('feed');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [internalParams, setInternalParams] = useState<GenerationParams>({
    model: 'gpt-image-2.5',
    dimension: '2560×1440',
    quality: 'auto',
    count: 1,
    format: 'PNG',
    transparent: false,
    filter: 'auto',
    steps: 28,
    cfgScale: 7.0,
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
  const [hoveredRefId, setHoveredRefId] = useState<string | null>(null);
  const [activeQuickDropdown, setActiveQuickDropdown] = useState<'model' | 'ratio' | 'count' | 'more' | null>(null);

  // Vertical Prompt Context Stretching (Can be stretched up from 70px to 380px)
  const [promptTextareaHeight, setPromptTextareaHeight] = useState(110);
  const [isResizingPrompt, setIsResizingPrompt] = useState(false);
  const startDragYRef = useRef(0);
  const startHeightRef = useRef(110);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingPrompt) return;
      const deltaY = startDragYRef.current - e.clientY;
      const nextH = Math.max(70, Math.min(380, startHeightRef.current + deltaY));
      setPromptTextareaHeight(nextH);
    };
    const handleMouseUp = () => {
      setIsResizingPrompt(false);
    };
    if (isResizingPrompt) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingPrompt]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDownload = (artboard: Artboard) => {
    const a = document.createElement('a');
    a.href = artboard.imageUrl;
    a.download = `${artboard.title || 'panpan-artwork'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAddReferenceImage) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const nextTag = referenceImages.length + 1;
      onAddReferenceImage({
        id: `ref-${Date.now()}`,
        url,
        name: file.name.replace(/\.[^/.]+$/, ''),
        tagNumber: nextTag,
        weight: 0.75,
        role: 'ref',
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const insertImageTag = (tagNum: number) => {
    const tag = `@图${tagNum} `;
    if (!prompt.includes(tag.trim())) {
      onPromptChange(prompt ? `${prompt} ${tag}` : tag);
    }
    textareaRef.current?.focus();
  };

  const handleSend = () => {
    if (!prompt.trim() || isGenerating) return;
    onGenerate(prompt, params);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  // Predefined Aspect Ratios
  const aspectRatios = [
    { label: '16:9', res: '2560×1440', desc: '横向高清' },
    { label: '9:16', res: '1440×2560', desc: '竖屏故事' },
    { label: '1:1', res: '2048×2048', desc: '方图头像' },
    { label: '4:3', res: '2048×1536', desc: '经典画报' },
    { label: '3:4', res: '1536×2048', desc: '人像海报' },
    { label: '21:9', res: '2560×1080', desc: '电影宽幅' },
  ];

  return (
    <aside className="w-[360px] h-full shrink-0 flex flex-col border-l border-black/[0.08] dark:border-white/[0.08] bg-white/90 dark:bg-[#13151f]/90 backdrop-blur-2xl z-20 transition-all select-none relative shadow-xl">
      {/* 1. Header Bar: Studio Title + Tabs + Dock Back Button */}
      <div className="h-[44px] px-3.5 border-b border-black/[0.06] dark:border-white/[0.07] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-slate-900 dark:bg-white"></div>
          <span className="text-[12px] font-semibold tracking-tight text-slate-900 dark:text-white">
            生成工作台
          </span>
        </div>

        {/* Segmented Tab Switch: 历史记录 vs 详细参数 */}
        <div className="flex items-center p-0.5 rounded-lg bg-black/[0.05] dark:bg-white/[0.07] text-[11px]">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1 font-medium ${
              activeTab === 'feed'
                ? 'bg-white dark:bg-[#1e212d] text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-3 h-3 stroke-[1.6]" />
            <span>历史流</span>
            <span className="text-[9px] font-mono px-1 rounded-full bg-black/[0.06] dark:bg-white/[0.1]">
              {artboards.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('params')}
            className={`px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1 font-medium ${
              activeTab === 'params'
                ? 'bg-white dark:bg-[#1e212d] text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3 h-3 stroke-[1.6]" />
            <span>参数配置</span>
          </button>
        </div>

        {/* Dock back to Bottom HUD Button */}
        <button
          onClick={onCloseOrDockBottom}
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition cursor-pointer"
          title="停靠回底部悬浮栏 (⬒ 浮岛模式)"
        >
          {/* Geometric dock icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
            <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
            <line x1="1.5" y1="9.5" x2="12.5" y2="9.5" />
          </svg>
        </button>
      </div>

      {/* 2. Middle Scrollable Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 space-y-4">
        {/* =========================================================================
            TAB A: 历史生成记录 (Lovart-style History Feed)
            ========================================================================= */}
        {activeTab === 'feed' ? (
          <div className="space-y-3">
            {artboards.length === 0 ? (
              <div className="py-16 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-slate-400 stroke-[1.4]" />
                </div>
                <div className="text-[12px] font-medium text-slate-600 dark:text-slate-300">
                  暂无生成记录
                </div>
                <div className="text-[11px] max-w-[220px] mx-auto text-slate-400 leading-relaxed">
                  在下方输入提示词或选择参考图，开启你的首个方案渲染
                </div>
              </div>
            ) : (
              artboards.map((artboard) => {
                const isSelected = selectedArtboardId === artboard.id;
                return (
                  <div
                    key={artboard.id}
                    onClick={() => onSelectArtboard(artboard.id)}
                    className={`group rounded-xl border p-2.5 transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-black/[0.03] dark:bg-white/[0.06] border-black/30 dark:border-white/30 shadow-xs'
                        : 'bg-white/60 dark:bg-[#171924]/60 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] border-black/[0.07] dark:border-white/[0.07]'
                    }`}
                  >
                    {/* Top Row: Thumbnail + Details */}
                    <div className="flex gap-2.5">
                      <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 relative">
                        <img
                          src={artboard.imageUrl}
                          alt={artboard.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        {artboard.renderTime && (
                          <div className="absolute bottom-1 right-1 px-1 py-0.2 rounded-xs bg-black/75 text-white text-[8.5px] font-mono">
                            {artboard.renderTime}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[11.5px] font-medium text-slate-900 dark:text-white truncate">
                              {artboard.title}
                            </span>
                            <span className="text-[9.5px] font-mono px-1 py-0.2 rounded-xs bg-black/[0.05] dark:bg-white/[0.08] text-slate-500 shrink-0">
                              {artboard.resolution || '2560×1440'}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                            {artboard.prompt || '未包含提示词文本'}
                          </p>
                        </div>

                        {/* Model tag */}
                        <div className="text-[9.5px] text-slate-400 font-mono truncate">
                          {artboard.model}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Strip on Hover / Focus */}
                    <div className="mt-2.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[10.5px]">
                      {/* Fly To & Center on Infinite Canvas */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onFocusArtboard) {
                            onFocusArtboard(artboard.id);
                          } else {
                            onSelectArtboard(artboard.id);
                          }
                        }}
                        className="flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                        title="在无限画布中居中定位该方案"
                      >
                        <Crosshair className="w-3 h-3 stroke-[1.6]" />
                        <span>定位</span>
                      </button>

                      {/* Set as Reference */}
                      {onSetAsReference && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetAsReference(artboard);
                          }}
                          className="flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                          title="加入参考图托盘 (@图N)"
                        >
                          <ImageIcon className="w-3 h-3 stroke-[1.6]" />
                          <span>垫图</span>
                        </button>
                      )}

                      {/* Recall Prompt */}
                      {onRecallPrompt && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRecallPrompt(artboard);
                          }}
                          className="flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                          title="复用此方案提示词"
                        >
                          <Copy className="w-3 h-3 stroke-[1.6]" />
                          <span>复用</span>
                        </button>
                      )}

                      {/* Download */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(artboard);
                        }}
                        className="flex items-center gap-1 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                        title="下载高清原图"
                      >
                        <Download className="w-3 h-3 stroke-[1.6]" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* =========================================================================
              TAB B: 参数与控制 (Parameters & Settings)
              ========================================================================= */
          <div className="space-y-4">
            {/* 1. Model Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                生成基底模型
              </label>
              <div className="grid grid-cols-1 gap-1">
                {[
                  { id: 'gpt-image-2.5', label: 'gpt-image-2.5 (官方云端)' },
                  { id: 'flux.1-dev (本地)', label: 'FLUX.1-Dev (本地 ComfyUI)' },
                  { id: 'sd-xl-base-1.0', label: 'SDXL Base 1.0 (本地 WebUI)' },
                  { id: 'imagen-3-hd', label: 'Imagen 3 HD (高质建筑)' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setParams({ ...params, model: m.id })}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition cursor-pointer border ${
                      params.model === m.id
                        ? 'bg-black/[0.05] dark:bg-white/[0.08] border-black/25 dark:border-white/25 text-slate-900 dark:text-white font-medium'
                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Aspect Ratio Matrix */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                画幅比例 & 分辨率
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {aspectRatios.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setParams({ ...params, dimension: item.res })}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border transition cursor-pointer ${
                      params.dimension === item.res
                        ? 'bg-black/[0.06] dark:bg-white/[0.09] border-black/25 dark:border-white/25 text-slate-900 dark:text-white font-medium'
                        : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.06] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className="text-[11.5px] font-mono font-semibold">{item.label}</span>
                    <span className="text-[8.5px] font-mono text-slate-400">{item.res}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Sampling Steps & CFG Scale */}
            <div className="space-y-3 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <span>去噪采样步数 (Steps)</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {params.steps || 28}
                  </span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="50"
                  value={params.steps || 28}
                  onChange={(e) => setParams({ ...params, steps: parseInt(e.target.value) })}
                  className="w-full accent-black dark:accent-white h-1 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <span>提示词相关性 (CFG Scale)</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {(params.cfgScale || 7.0).toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="15.0"
                  step="0.5"
                  value={params.cfgScale || 7.0}
                  onChange={(e) => setParams({ ...params, cfgScale: parseFloat(e.target.value) })}
                  className="w-full accent-black dark:accent-white h-1 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Bottom Generation Prompt Console (Can be stretched up via top drag handle) */}
      <div className="p-3 border-t border-black/[0.08] dark:border-white/[0.08] bg-white/85 dark:bg-[#161823]/85 backdrop-blur-xl space-y-2 shrink-0 relative">
        {/* Upward Drag Gripper Bar (Minimalist Monochrome - allow vertical expansion) */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            startDragYRef.current = e.clientY;
            startHeightRef.current = promptTextareaHeight;
            setIsResizingPrompt(true);
          }}
          className="w-full h-[8px] -mt-1 cursor-row-resize hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] flex items-center justify-center transition-colors group"
          title="按住向上拉伸提示词上下文输入框"
        >
          <div className="w-8 h-[2.5px] rounded-full bg-black/15 dark:bg-white/20 group-hover:bg-black/40 dark:group-hover:bg-white/50 transition-colors"></div>
        </div>

        {/* Visual Reference Image Shelf (Exact visual parity with Bottom HUD) */}
        {referenceImages && referenceImages.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
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
                {/* Visual Thumbnail Card */}
                <div
                  onClick={() => insertImageTag(ref.tagNumber)}
                  className="w-[48px] h-[48px] rounded-xl overflow-hidden border border-black/15 dark:border-white/20 bg-black/5 dark:bg-white/5 cursor-pointer shadow-2xs hover:scale-105 transition-all duration-150 relative"
                  title={`点击在提示词插入 @图${ref.tagNumber} (${ref.name}) · 可左右拖动调整顺序`}
                >
                  <img
                    src={ref.url}
                    alt={ref.name}
                    className="w-full h-full object-cover pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                  {/* Number Badge */}
                  <div className="absolute bottom-1 left-1 w-3.5 h-3.5 rounded-full bg-black/80 text-white flex items-center justify-center text-[8.5px] font-mono font-bold shadow-xs">
                    {ref.tagNumber}
                  </div>
                </div>

                {/* Micro Delete Cross */}
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
                  <div className="absolute bottom-13 left-1/2 -translate-x-1/2 w-32 p-2 rounded-lg bg-white/95 dark:bg-[#1c1e29]/95 border border-black/10 dark:border-white/10 shadow-xl backdrop-blur-md z-50 text-[10px] space-y-1">
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

            {/* Clear All Button */}
            {onClearReferenceImages && (
              <button
                onClick={onClearReferenceImages}
                className="w-[48px] h-[48px] rounded-xl border border-dashed border-black/20 dark:border-white/20 hover:border-black/40 dark:hover:border-white/40 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] flex flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer shrink-0"
                title="清空全部参考图"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[1.4]" />
                <span className="text-[9px]">清空</span>
              </button>
            )}
          </div>
        )}

        {/* Textarea Box with dynamic height */}
        <div className="relative rounded-xl border border-black/[0.1] dark:border-white/[0.12] bg-white dark:bg-[#1a1c28] p-2.5 focus-within:border-black/30 dark:focus-within:border-white/30 transition-all shadow-xs">
          <textarea
            ref={textareaRef}
            style={{ height: `${promptTextareaHeight}px` }}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入生成提示词... (Ctrl+Enter 渲染，支持 @图1 垫图)"
            className="w-full bg-transparent resize-none border-none p-0 text-[12px] leading-relaxed text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-0 outline-none"
          />

          <div className="flex items-center justify-between pt-1.5 border-t border-black/[0.04] dark:border-white/[0.05] text-[10.5px] text-slate-500">
            {/* Upload Reference & Clear */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5 stroke-[1.5]" />
                <span>添加参考图</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {prompt && (
                <button
                  onClick={() => onPromptChange('')}
                  className="hover:text-slate-800 dark:hover:text-slate-200 transition text-[10px]"
                >
                  清空
                </button>
              )}
            </div>
          </div>
        </div>

        {/* INLINE QUICK PARAMETER CAPSULES (Model, Aspect Ratio, Batch, Dock) */}
        <div className="relative flex items-center justify-between gap-1 text-[11px]">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 flex-1">
            {/* 1. Model Capsule */}
            <div className="relative shrink-0">
              <button
                onClick={() => setActiveQuickDropdown(activeQuickDropdown === 'model' ? null : 'model')}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-[10.5px] font-medium transition cursor-pointer"
              >
                <span className="truncate max-w-[90px]">{params.model}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
              {activeQuickDropdown === 'model' && (
                <div className="absolute bottom-8 left-0 w-48 rounded-xl p-1.5 z-50 text-[11px] shadow-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1d28] backdrop-blur-xl space-y-0.5">
                  {[
                    { id: 'gpt-image-2.5', label: 'gpt-image-2.5 (标准设计)' },
                    { id: 'FLUX.1-Dev', label: 'FLUX.1-Dev (商业质感)' },
                    { id: 'SD 3.5 Large', label: 'SD 3.5 Large (结构可控)' },
                    { id: 'Midjourney v6', label: 'Midjourney v6 (概念渲染)' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setParams({ ...params, model: m.id });
                        setActiveQuickDropdown(null);
                      }}
                      className={`w-full text-left px-2 py-1 rounded-md transition cursor-pointer text-[10.5px] ${
                        params.model.includes(m.id)
                          ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                          : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Aspect Ratio & Dimension Capsule */}
            <div className="relative shrink-0">
              <button
                onClick={() => setActiveQuickDropdown(activeQuickDropdown === 'ratio' ? null : 'ratio')}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-[10.5px] font-medium transition cursor-pointer"
              >
                <span>{params.dimension}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
              {activeQuickDropdown === 'ratio' && (
                <div className="absolute bottom-8 left-0 w-44 rounded-xl p-1.5 z-50 text-[11px] shadow-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1d28] backdrop-blur-xl space-y-0.5">
                  {aspectRatios.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        setParams({ ...params, dimension: item.res });
                        setActiveQuickDropdown(null);
                      }}
                      className={`w-full text-left px-2 py-1 rounded-md transition cursor-pointer text-[10.5px] flex items-center justify-between ${
                        params.dimension === item.res
                          ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                          : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="font-mono text-[9px] opacity-70">{item.res}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Batch Count Capsule */}
            <div className="relative shrink-0">
              <button
                onClick={() => setActiveQuickDropdown(activeQuickDropdown === 'count' ? null : 'count')}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-[10.5px] font-medium transition cursor-pointer"
              >
                <span>数量 {params.count || 1}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
              {activeQuickDropdown === 'count' && (
                <div className="absolute bottom-8 left-0 w-24 rounded-xl p-1 z-50 text-[11px] shadow-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1d28] backdrop-blur-xl space-y-0.5">
                  {[1, 2, 4].map((cnt) => (
                    <button
                      key={cnt}
                      onClick={() => {
                        setParams({ ...params, count: cnt });
                        setActiveQuickDropdown(null);
                      }}
                      className={`w-full text-center px-2 py-1 rounded-md transition cursor-pointer text-[10.5px] ${
                        params.count === cnt
                          ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                          : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      生成 {cnt} 张
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dock back to Bottom Floating HUD */}
          <button
            onClick={onCloseOrDockBottom}
            className="shrink-0 w-6 h-6 rounded-md bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-600 dark:text-slate-300 flex items-center justify-center transition cursor-pointer"
            title="切换回底部浮岛输入框 (⬒)"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
              <rect x="1" y="1" width="10" height="10" rx="1.5" />
              <line x1="1" y1="8" x2="11" y2="8" />
            </svg>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Primary Generate Button (Full Width Monochrome with ⌘↵ indicator) */}
        <button
          onClick={handleSend}
          disabled={!prompt.trim() || isGenerating}
          className={`w-full h-8 rounded-lg flex items-center justify-center gap-1.5 text-[11.5px] font-medium transition cursor-pointer shadow-xs ${
            !prompt.trim() || isGenerating
              ? 'bg-black/10 dark:bg-white/10 text-slate-400 cursor-not-allowed'
              : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90 active:scale-[0.99]'
          }`}
        >
          {isGenerating ? (
            <>
              <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"></div>
              <span>正在演算扩散生成...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 stroke-[1.8]" />
              <span>立即生成方案</span>
              <span className="text-[9.5px] font-mono opacity-50 ml-0.5">⌘↵</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
