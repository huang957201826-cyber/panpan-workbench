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
  Link as LinkIcon,
  BookmarkPlus,
} from 'lucide-react';
import type { Artboard, GenerationParams, ReferenceImage } from '../types.ts';
import { ensureImageCached } from '../../lib/imageCache';
import { submitShortcutHint } from '../../lib/platform';
import { getAtImageQuery, imageMentionMatches } from '../../lib/promptImageMentions';
import { MAX_PROMPT_LENGTH, clampPrompt } from '../../lib/promptLimits';
import { useStore } from '../../store';
import { ArtboardThumb } from './ArtboardThumb';
import { Menu as PopMenu } from '../../ui';
import { PromptMentionOverlay } from './PromptMentionOverlay';
import SizePickerModal from '../../components/SizePickerModal';
import AddImageUrlsModal from '../../components/input/addImageUrlsModal';

interface RightGeneratorDrawerProps {
  prompt: string;
  onPromptChange: (newPrompt: string) => void;
  onGenerate: (promptText: string, params: GenerationParams) => void;
  isGenerating: boolean;
  referenceImages: ReferenceImage[];
  onAddReferenceImage?: (image: ReferenceImage) => void;
  /** Studio 真实上传：交给 store 生成 hash ID */
  onAddReferenceFile?: (file: File) => void;
  onRemoveReferenceImage?: (id: string) => void;
  onClearReferenceImages?: () => void;
  onReorderReferenceImages?: (newOrder: ReferenceImage[]) => void;
  params?: GenerationParams;
  onParamsChange?: (params: GenerationParams) => void;
  artboards: Artboard[];
  canvasId?: string;
  selectedArtboardId: string | null;
  onSelectArtboard: (id: string | null) => void;
  onFocusArtboard?: (id: string) => void;
  onSetAsReference?: (artboard: Artboard) => void;
  onRecallPrompt?: (artboard: Artboard) => void;
  onCloseOrDockBottom: () => void;
  onOpenMask?: () => void;
  batchEnabled?: boolean;
  onToggleBatch?: () => void;
  onStartCanvasPick?: () => void;
  canvasPickActive?: boolean;
  onSaveAsSkill?: () => void;
  /** 打开设置里的模型配置（模型列表由 API profile 的逗号分隔字段决定） */
  onManageModels?: () => void;
  /** 真实模型列表；不传时使用内置演示项 */
  modelOptions?: Array<{ id: string; label: string }>;
  /** 真实尺寸列表；不传时使用内置演示项 */
  aspectRatios?: Array<{ label: string; res: string }>;
  countOptions?: number[];
  showDockToggle?: boolean;
  apiProfiles?: Array<{ id: string; name: string }>;
  activeProfileId?: string;
  onSelectProfile?: (id: string) => void;
}

export const RightGeneratorDrawer: React.FC<RightGeneratorDrawerProps> = ({
  prompt,
  onPromptChange,
  onGenerate,
  isGenerating,
  referenceImages,
  onAddReferenceImage,
  onAddReferenceFile,
  onRemoveReferenceImage,
  onClearReferenceImages,
  onReorderReferenceImages,
  params: externalParams,
  onParamsChange,
  artboards,
  canvasId,
  selectedArtboardId,
  onSelectArtboard,
  onFocusArtboard,
  onSetAsReference,
  onRecallPrompt,
  onCloseOrDockBottom,
  onOpenMask,
  batchEnabled = false,
  onToggleBatch,
  onStartCanvasPick,
  canvasPickActive = false,
  onSaveAsSkill,
  onManageModels,
  modelOptions = [
    { id: 'gpt-image-2.5', label: 'gpt-image-2.5 (标准设计)' },
    { id: 'FLUX.1-Dev', label: 'FLUX.1-Dev (商业质感)' },
  ],
  aspectRatios = [
    { label: '1:1', res: '1024×1024' },
    { label: '16:9', res: '1536×1024' },
    { label: '9:16', res: '1024×1536' },
  ],
  countOptions = [1, 2, 4],
  showDockToggle = true,
  apiProfiles = [],
  activeProfileId,
  onSelectProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'params'>('feed');
  const [visibleCount, setVisibleCount] = useState(30);
  useEffect(() => { setVisibleCount(30); }, [canvasId]);
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
  const [activeQuickDropdown, setActiveQuickDropdown] = useState<'model' | 'ratio' | 'count' | 'more' | null>(null);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [showAddImageUrls, setShowAddImageUrls] = useState(false);
  const modelQuickRef = useRef<HTMLButtonElement>(null);
  const ratioQuickRef = useRef<HTMLButtonElement>(null);
  const countQuickRef = useRef<HTMLButtonElement>(null);

  // Vertical Prompt Context Stretching (Can be stretched up from 70px to 380px)
  const [promptTextareaHeight, setPromptTextareaHeight] = useState(110);
  const [promptScrollTop, setPromptScrollTop] = useState(0);
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

  const handleDownload = async (artboard: Artboard) => {
    const url = artboard.imageUrl || (artboard.imageId ? await ensureImageCached(artboard.imageId) : '');
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artboard.title || 'panpan-artwork'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (onAddReferenceFile) {
      onAddReferenceFile(file);
      return;
    }
    if (!onAddReferenceImage) return;

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
  };

  const enterSubmit = useStore((s) => s.settings.enterSubmit);
  const isComposingRef = useRef(false);
  const [atMenuOpen, setAtMenuOpen] = useState(false);
  const [atMenuIndex, setAtMenuIndex] = useState(0);
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

  const insertImageTag = (tagNum: number, replaceQuery = false) => {
    const tag = `@图${tagNum} `;
    const el = textareaRef.current;
    if (!el) {
      onPromptChange(clampPrompt(prompt ? `${prompt} ${tag}` : tag));
      closeAtMenu();
      return;
    }
    const cursor = el.selectionStart ?? prompt.length;
    const query = replaceQuery ? getAtImageQuery(prompt, cursor, referenceImages) : null;
    const start = query ? query.start : cursor;
    const end = query ? cursor : (el.selectionEnd ?? cursor);
    const updated = clampPrompt(`${prompt.slice(0, start)}${tag}${prompt.slice(end)}`);
    onPromptChange(updated);
    closeAtMenu();
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + tag.length, start + tag.length);
      }
    }, 10);
  };

  const missingReference = referenceImages.some((ref) => ref.missing);
  const handleSend = () => {
    if (!prompt.trim() || isGenerating) return;
    if (missingReference) {
      useStore.getState().showToast('参考图中有已被删除的素材，请先移除后再提交。', 'error');
      return;
    }
    onGenerate(clampPrompt(prompt), params);
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

  return (
    <aside className="w-[360px] h-full shrink-0 flex flex-col border-l border-black/[0.08] dark:border-white/[0.08] bg-white/90 dark:bg-[#13151f]/90 backdrop-blur-2xl z-20 transition-all select-none relative shadow-xl">
      {/* 1. Header Bar: Studio Title + Tabs + Dock Back Button */}
      <div className="h-[44px] px-3.5 border-b border-black/[0.06] dark:border-white/[0.07] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-slate-900 dark:bg-white"></div>
          <span className="text-body-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            生成工作台
          </span>
        </div>

        {/* Segmented Tab Switch: 历史记录 vs 详细参数 */}
        <div className="flex items-center p-0.5 rounded-lg bg-black/[0.05] dark:bg-white/[0.07] text-body-sm">
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
            <span className="text-caption font-mono px-1 rounded-full bg-black/[0.06] dark:bg-white/[0.1]">
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
          style={showDockToggle ? undefined : { display: 'none' }}
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
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-3.5 space-y-4">
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
                <div className="text-body-sm font-medium text-slate-600 dark:text-slate-300">
                  暂无生成记录
                </div>
                <div className="text-body-sm max-w-[220px] mx-auto text-slate-400 leading-relaxed">
                  在下方输入提示词或选择参考图，开启你的首个方案渲染
                </div>
              </div>
            ) : (
              artboards.slice(0, visibleCount).map((artboard) => {
                const isSelected = selectedArtboardId === artboard.id;
                return (
                  <div
                    key={artboard.id}
                    draggable={Boolean(artboard.imageId)}
                    onDragStart={(e) => {
                      if (!artboard.imageId) return
                      e.dataTransfer.effectAllowed = 'copy';
                      e.dataTransfer.setData('application/x-studio-image', JSON.stringify({ imageId: artboard.imageId, url: artboard.imageUrl, name: artboard.title }));
                    }}
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
                        <ArtboardThumb
                          imageId={artboard.imageId}
                          imageUrl={artboard.imageUrl}
                          alt={artboard.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        {artboard.renderTime && (
                          <div className="absolute bottom-1 right-1 px-1 py-0.2 rounded-xs bg-black/75 text-white text-micro font-mono">
                            {artboard.renderTime}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-body-sm font-medium text-slate-900 dark:text-white truncate">
                              {artboard.title}
                            </span>
                            <span className="text-caption font-mono px-1 py-0.2 rounded-xs bg-black/[0.05] dark:bg-white/[0.08] text-slate-500 shrink-0">
                              {artboard.resolution || '2560×1440'}
                            </span>
                          </div>
                          <p className="text-caption text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                            {artboard.prompt || '未包含提示词文本'}
                          </p>
                        </div>

                        {/* Model tag */}
                        <div className="text-caption text-slate-400 font-mono truncate">
                          {artboard.model}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Strip on Hover / Focus */}
                    <div className="mt-2.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-caption">
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
                        title="切换到画布查看该方案"
                      >
                        <Crosshair className="w-3 h-3 stroke-[1.6]" />
                        <span>画布</span>
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
                          <span>参考图</span>
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
            {artboards.length > 0 && artboards.length > visibleCount && (
              <button
                onClick={() => setVisibleCount((count) => count + 30)}
                className="w-full py-2 rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-body-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition cursor-pointer"
              >
                加载更多（剩余 {artboards.length - visibleCount}）
              </button>
            )}
          </div>
        ) : (
          /* =========================================================================
              TAB B: 参数与控制 (Parameters & Settings)
              ========================================================================= */
          <div className="space-y-4">
            {apiProfiles.length > 0 && onSelectProfile && (
              <div className="space-y-1.5">
                <label className="text-body-sm font-medium text-slate-700 dark:text-slate-300">
                  API 配置
                </label>
                <div className="grid grid-cols-1 gap-1">
                  {apiProfiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => onSelectProfile(profile.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-body-sm transition cursor-pointer border ${
                        activeProfileId === profile.id
                          ? 'bg-black/[0.05] dark:bg-white/[0.08] border-black/25 dark:border-white/25 text-slate-900 dark:text-white font-medium'
                          : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      {profile.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 1. Model Selector */}
            <div className="space-y-1.5">
              <label className="text-body-sm font-medium text-slate-700 dark:text-slate-300">
                生成基底模型
              </label>
              <div className="grid grid-cols-1 gap-1">
                {modelOptions.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setParams({ ...params, model: m.id })}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-body-sm font-mono transition cursor-pointer border ${
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
              <label className="text-body-sm font-medium text-slate-700 dark:text-slate-300">
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
                    <span className="text-body-sm font-mono font-semibold">{item.label}</span>
                    <span className="text-micro font-mono text-slate-400">{item.res}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Quality / Format / Count / Transparency */}
            <div className="space-y-3 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
              <div className="space-y-1.5">
                <label className="text-body-sm font-medium text-slate-700 dark:text-slate-300">画质</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['auto', 'low', 'medium', 'high', 'xhigh', 'max'] as const).map((quality) => (
                    <button
                      key={quality}
                      onClick={() => setParams({ ...params, quality })}
                      className={`px-1.5 py-1 rounded-md text-caption font-mono border transition cursor-pointer ${
                        params.quality === quality
                          ? 'bg-black/[0.06] dark:bg-white/[0.09] border-black/25 dark:border-white/25 text-slate-900 dark:text-white'
                          : 'border-transparent text-slate-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                      }`}
                    >
                      {quality}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-body-sm font-medium text-slate-700 dark:text-slate-300">输出格式</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['PNG', 'WebP', 'JPEG'] as const).map((format) => (
                    <button
                      key={format}
                      onClick={() => setParams({ ...params, format })}
                      className={`px-1.5 py-1 rounded-md text-caption font-mono border transition cursor-pointer ${
                        params.format === format
                          ? 'bg-black/[0.06] dark:bg-white/[0.09] border-black/25 dark:border-white/25 text-slate-900 dark:text-white'
                          : 'border-transparent text-slate-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-body-sm text-slate-600 dark:text-slate-400">数量</div>
                  <div className="flex items-center gap-1">
                    {countOptions.map((count) => (
                      <button
                        key={count}
                        onClick={() => setParams({ ...params, count })}
                        className={`w-7 h-6 rounded-md text-caption font-mono border transition cursor-pointer ${
                          params.count === count
                            ? 'bg-black/[0.06] dark:bg-white/[0.09] border-black/25 dark:border-white/25 text-slate-900 dark:text-white'
                            : 'border-transparent text-slate-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <div className="text-body-sm text-slate-600 dark:text-slate-400">透明背景</div>
                  <button
                    onClick={() => setParams({ ...params, transparent: !params.transparent })}
                    className={`px-2 py-1 rounded-md text-caption font-mono border transition cursor-pointer ${
                      params.transparent
                        ? 'bg-black/[0.06] dark:bg-white/[0.09] border-black/25 dark:border-white/25 text-slate-900 dark:text-white'
                        : 'border-transparent text-slate-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    {params.transparent ? '开启' : '关闭'}
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
                <div className="space-y-1">
                  <div className="text-body-sm text-slate-600 dark:text-slate-400">内容审核</div>
                  <div className="flex items-center gap-1">
                    {[
                      { value: 'auto', label: 'auto' },
                      { value: 'standard', label: 'low' },
                    ].map((item) => (
                      <button
                        key={item.value}
                        onClick={() => setParams({ ...params, filter: item.value as typeof params.filter })}
                        className={`px-2 py-1 rounded-md text-caption font-mono border transition cursor-pointer ${
                          params.filter === item.value
                            ? 'bg-black/[0.06] dark:bg-white/[0.09] border-black/25 dark:border-white/25 text-slate-900 dark:text-white'
                            : 'border-transparent text-slate-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                {params.format !== 'PNG' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-body-sm text-slate-600 dark:text-slate-400">
                      <span>压缩质量</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">{params.compression ?? 90}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={params.compression ?? 90}
                      onChange={(e) => setParams({ ...params, compression: parseInt(e.target.value) })}
                      className="w-full accent-black dark:accent-white h-1 cursor-pointer"
                    />
                  </div>
                )}
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
                {/* Visual Thumbnail Card */}
                <div
                  onClick={() => { if (!ref.missing) insertImageTag(ref.tagNumber); }}
                  className={`w-[48px] h-[48px] rounded-xl overflow-hidden border border-black/15 dark:border-white/20 bg-black/5 dark:bg-white/5 shadow-2xs relative ${ref.missing ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-105 transition-all duration-150'}`}
                  title={ref.missing ? `${ref.name}：画布素材已删除，请移除该参考图` : `点击在提示词插入 @图${ref.tagNumber} (${ref.name}) · 可左右拖动调整顺序`}
                >
                  {ref.missing ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-black/[0.08] px-1 text-center text-micro leading-tight text-slate-500 dark:bg-white/[0.1] dark:text-slate-300">
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
                  {/* Number Badge */}
                  <div className="absolute bottom-1 left-1 min-w-3.5 rounded-full bg-black/80 px-1 text-white flex items-center justify-center text-micro font-mono font-bold shadow-xs">
                    图{ref.tagNumber}
                  </div>
                </div>

                {/* Micro Delete Cross */}
                {onRemoveReferenceImage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveReferenceImage(ref.id);
                    }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black/85 text-white hover:bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs text-caption"
                    title="移除该参考图"
                  >
                    ×
                  </button>
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
                <span className="text-caption">清空</span>
              </button>
            )}
          </div>
        )}

        {/* Textarea Box with dynamic height */}
        <div className="relative rounded-xl border border-black/[0.1] dark:border-white/[0.12] bg-white dark:bg-[#1a1c28] p-2.5 focus-within:border-black/30 dark:focus-within:border-white/30 transition-all shadow-xs">
          {atMenuOpen && atOptions.length > 0 && (
            <div className="absolute bottom-full left-0 z-50 mb-1 w-56 overflow-hidden rounded-xl border border-black/[0.08] bg-white/95 p-1 shadow-xl backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#1c1e29]/95">
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
            style={{ height: `${promptTextareaHeight}px` }}
            value={prompt}
            maxLength={MAX_PROMPT_LENGTH}
            onChange={(e) => {
              const next = clampPrompt(e.target.value);
              onPromptChange(next);
              refreshAtMenu(next, e.target.selectionStart ?? next.length);
            }}
            onKeyDown={handleKeyDown}
            onScroll={(e) => setPromptScrollTop(e.currentTarget.scrollTop)}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
            placeholder={`输入生成提示词... (${enterSubmit ? 'Enter' : 'Ctrl+Enter'} 渲染，可用 @图1 引用参考图)`}
            className="relative w-full bg-transparent resize-none border-none p-0 text-body-sm leading-relaxed text-transparent caret-slate-800 dark:caret-slate-100 placeholder-slate-400 focus:ring-0 outline-none"
          />
          <PromptMentionOverlay
            prompt={prompt}
            scrollTop={promptScrollTop}
            className="p-0 text-body-sm leading-relaxed text-slate-800 dark:text-slate-100"
          />
          {prompt.length >= MAX_PROMPT_LENGTH && (
            <div className="pointer-events-none absolute bottom-9 right-3 text-caption text-amber-600 dark:text-amber-400">
              已达 {MAX_PROMPT_LENGTH} 字上限
            </div>
          )}

          <div className="flex items-center justify-between pt-1.5 border-t border-black/[0.04] dark:border-white/[0.05] text-caption text-slate-500">
            {/* Upload Reference & Clear */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5 stroke-[1.5]" />
                <span>添加参考图</span>
              </button>
              <button
                onClick={() => setShowAddImageUrls(true)}
                className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                title="通过图片链接添加参考图"
              >
                <LinkIcon className="w-3.5 h-3.5 stroke-[1.5]" />
                <span>链接</span>
              </button>
              {onOpenMask && (
                <button
                  onClick={onOpenMask}
                  className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                  title="对第一张参考图打开遮罩编辑器"
                >
                  <Layers className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>遮罩</span>
                </button>
              )}
              {onToggleBatch && (
                <button
                  onClick={onToggleBatch}
                  className={`flex items-center gap-1 transition cursor-pointer ${batchEnabled ? 'text-slate-900 dark:text-white font-medium' : 'hover:text-slate-800 dark:hover:text-slate-200'}`}
                  title="开启后按空行/分隔符拆分提示词批量提交"
                >
                  <Sliders className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>批量 {batchEnabled ? '开' : '关'}</span>
                </button>
              )}
              {onStartCanvasPick && (
                <button
                  onClick={onStartCanvasPick}
                  className={`flex items-center gap-1 transition cursor-pointer ${canvasPickActive ? 'text-slate-900 dark:text-white font-medium' : 'hover:text-slate-800 dark:hover:text-slate-200'}`}
                  title="从画布选择参考图（Esc 取消）"
                  aria-label="从画布选择参考图"
                  aria-pressed={canvasPickActive}
                >
                  <Crosshair className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>{canvasPickActive ? '选择中…' : '从画布选择'}</span>
                </button>
              )}
              {onSaveAsSkill && (
                <button
                  onClick={onSaveAsSkill}
                  disabled={!prompt.trim()}
                  className="flex items-center gap-1 transition cursor-pointer hover:text-slate-800 disabled:opacity-35 dark:hover:text-slate-200"
                  title="保存为技能"
                  aria-label="保存为技能"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>存为技能</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {prompt && (
                <button
                  onClick={() => onPromptChange('')}
                  className="hover:text-slate-800 dark:hover:text-slate-200 transition text-caption"
                >
                  清空
                </button>
              )}
            </div>
          </div>
        </div>

        {/* INLINE QUICK PARAMETER CAPSULES (Model, Aspect Ratio, Batch, Dock) */}
        <div className="relative flex items-center justify-between gap-1 text-body-sm">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 flex-1">
            {/* 1. Model Capsule */}
            <div className="relative shrink-0">
              <button
                ref={modelQuickRef}
                onClick={() => setActiveQuickDropdown(activeQuickDropdown === 'model' ? null : 'model')}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-caption font-medium transition cursor-pointer"
              >
                <span className="truncate max-w-[90px]">{params.model}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
              <PopMenu open={activeQuickDropdown === 'model'} anchorRef={modelQuickRef} width={192} onClose={() => setActiveQuickDropdown(null)}>
                  {modelOptions.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setParams({ ...params, model: m.id });
                        setActiveQuickDropdown(null);
                      }}
                      className={`w-full text-left px-2 py-1 rounded-md transition cursor-pointer text-caption ${
                        params.model === m.id
                          ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                          : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                  {onManageModels && (
                    <button
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      onClick={() => {
                        setActiveQuickDropdown(null);
                        onManageModels();
                      }}
                      className="mt-0.5 w-full cursor-pointer rounded-md border-t border-black/5 px-2 py-1 text-left text-caption text-slate-500 hover:bg-black/5 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10"
                    >
                      管理模型列表…
                    </button>
                  )}
              </PopMenu>
            </div>

            {/* 2. Aspect Ratio & Dimension Capsule */}
            <div className="relative shrink-0">
              <button
                ref={ratioQuickRef}
                onClick={() => setActiveQuickDropdown(activeQuickDropdown === 'ratio' ? null : 'ratio')}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-caption font-medium transition cursor-pointer"
              >
                <span>{aspectRatios.find((item) => item.res === params.dimension)?.label ?? params.dimension}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
              <PopMenu open={activeQuickDropdown === 'ratio'} anchorRef={ratioQuickRef} width={176} onClose={() => setActiveQuickDropdown(null)}>
                  {aspectRatios.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        setParams({ ...params, dimension: item.res });
                        setActiveQuickDropdown(null);
                      }}
                      className={`w-full text-left px-2 py-1 rounded-md transition cursor-pointer text-caption flex items-center justify-between ${
                        params.dimension === item.res
                          ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                          : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="font-mono text-caption opacity-70">{item.res}</span>
                    </button>
                  ))}
                  <div
                    onClick={() => {
                      setActiveQuickDropdown(null);
                      setShowSizePicker(true);
                    }}
                    className="mt-0.5 cursor-pointer rounded-md border-t border-black/5 px-2 py-1 text-caption text-slate-500 hover:bg-black/5 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10"
                  >
                    更多尺寸 / 比例…
                  </div>
              </PopMenu>
            </div>

            {/* 3. Batch Count Capsule */}
            <div className="relative shrink-0">
              <button
                ref={countQuickRef}
                onClick={() => setActiveQuickDropdown(activeQuickDropdown === 'count' ? null : 'count')}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-caption font-medium transition cursor-pointer"
              >
                <span>数量 {params.count || 1}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
              <PopMenu open={activeQuickDropdown === 'count'} anchorRef={countQuickRef} width={96} onClose={() => setActiveQuickDropdown(null)}>
                  {countOptions.map((cnt) => (
                    <button
                      key={cnt}
                      onClick={() => {
                        setParams({ ...params, count: cnt });
                        setActiveQuickDropdown(null);
                      }}
                      className={`w-full text-center px-2 py-1 rounded-md transition cursor-pointer text-caption ${
                        params.count === cnt
                          ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                          : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      生成 {cnt} 张
                    </button>
                  ))}
              </PopMenu>
            </div>
          </div>

          {/* Dock back to Bottom Floating HUD */}
          <button
            onClick={onCloseOrDockBottom}
          style={showDockToggle ? undefined : { display: 'none' }}
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
          disabled={!prompt.trim() || isGenerating || missingReference}
          className={`w-full h-8 rounded-lg flex items-center justify-center gap-1.5 text-body-sm font-medium transition cursor-pointer shadow-xs ${
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
              <span className="text-caption font-mono opacity-50 ml-0.5">{submitShortcutHint}</span>
            </>
          )}
        </button>
      </div>

      {showSizePicker && (
        <SizePickerModal
          currentSize={params.dimension}
          onSelect={(size) => setParams({ ...params, dimension: size })}
          onClose={() => setShowSizePicker(false)}
        />
      )}
      {showAddImageUrls && <AddImageUrlsModal onClose={() => setShowAddImageUrls(false)} />}
    </aside>
  );
};
