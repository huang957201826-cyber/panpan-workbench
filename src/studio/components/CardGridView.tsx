import React, { useEffect, useRef, useState } from 'react';
import { useVirtualGrid } from '../../hooks/useVirtualGrid';
import { downloadImage } from '../../lib/downloadImage';
import { downloadTaskImages } from '../../lib/taskExport';
import { getDownloadErrorMessage } from '../../lib/downloadImages';
import { useStore } from '../../store'
import { EmptyState, SkeletonGrid } from '../../ui';
import { ArtboardThumb } from './ArtboardThumb';
import type { Artboard, ProjectScheme } from '../types.ts';
import {
  Copy,
  Download,
  Check,
  Maximize2,
  X,
  Layers,
  ImagePlus,
  RotateCcw,
  Star,
  Sparkles,
  Edit3,
} from 'lucide-react';
import { ImageDetailModal } from './ImageDetailModal.tsx';

interface CardGridViewProps {
  artboards: Artboard[];
  currentScheme?: ProjectScheme;
  onSendToCanvas: (artboard: Artboard) => void;
  onSetAsReference?: (artboard: Artboard) => void;
  onRecallPrompt?: (artboard: Artboard) => void;
  onDeleteArtboard?: (id: string) => void;
  onToggleStar?: (id: string) => void;
  onInspectArtboard?: (artboard: Artboard) => void;
  onRetryTask?: (taskId: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  isGenerating?: boolean;
  runningCount?: number;
  viewMode?: 'canvas' | 'grid';
  onSelectViewMode?: (mode: 'canvas' | 'grid') => void;
  headerControls?: React.ReactNode;
  selectionMode?: boolean;
  selectedTaskIds?: Set<string>;
  onToggleTaskSelection?: (taskId: string) => void;
}

export const CardGridView: React.FC<CardGridViewProps> = ({
  artboards,
  currentScheme,
  onSendToCanvas,
  onSetAsReference,
  onRecallPrompt,
  onDeleteArtboard,
  onToggleStar,
  onInspectArtboard,
  onRetryTask,
  emptyTitle,
  emptyDescription,
  isGenerating,
  runningCount = 0,
  viewMode = 'grid',
  onSelectViewMode,
  headerControls,
  selectionMode = false,
  selectedTaskIds,
  onToggleTaskSelection,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inspectArtboard, setInspectArtboard] = useState<Artboard | null>(null);
  const [assetPreview, setAssetPreview] = useState<Artboard | null>(null);
  const [columnCount, setColumnCount] = useState(3);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const { startIndex, endIndex, paddingTop, paddingBottom } = useVirtualGrid(gridRef, artboards.length, { scrollerRef: scrollRef });

  // Tauri 下持久化在 store 创建前已同步进内存，通常是 hydrated；浏览器/异常路径下兜一层骨架
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated?.() ?? true)
  useEffect(() => {
    if (hydrated) return
    const unsubscribe = useStore.persist.onFinishHydration(() => setHydrated(true))
    if (useStore.persist.hasHydrated()) setHydrated(true)
    return unsubscribe
  }, [hydrated])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const update = () => {
      const width = grid.clientWidth
      setColumnCount(width >= 1250 ? 5 : width >= 950 ? 4 : 3)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [artboards.length, hydrated]);

  const handleCopyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDownload = async (artboard: Artboard) => {
    const ref = artboard.imageId || artboard.imageUrl
    if (!ref) return
    const task = useStore.getState().tasks.find((item) => item.id === artboard.taskId)
      ?? useStore.getState().tasks.find((item) => artboard.imageId && item.outputImages.includes(artboard.imageId))
    const result = task && artboard.imageId
      ? await downloadTaskImages(task, [artboard.imageId], { fileNameBase: artboard.prompt || artboard.title })
      : await downloadImage(ref, artboard.prompt || artboard.title, artboard.imageIndex)
    if (result.canceled || result.successCount) return
    useStore.getState().showToast(getDownloadErrorMessage(result.error), 'error')
  };

  return (
    <div ref={scrollRef} className="ui-scale-chrome relative flex-1 h-full overflow-y-auto no-scrollbar px-6 pb-56 pt-24 text-slate-800 dark:text-slate-100 select-none">
      {/* Seamless Dot Matrix Background */}
      <div className="absolute inset-0 bg-[#f3f4f8] dark:bg-[#0c0e14]" />

      <div className="max-w-[1400px] mx-auto space-y-4 relative z-10">
        {!hydrated ? (
          <SkeletonGrid count={6} label="正在加载生成记录" />
        ) : artboards.length === 0 ? (
          <EmptyState
            className="py-24"
            icon={<Sparkles size={20} />}
            title={emptyTitle ?? (isGenerating ? '正在生成' : '还没有生成记录')}
            description={emptyDescription ?? '在下方输入提示词或选择参考图，生成结果会按卡片汇总到这里。'}
          />
        ) : null}
        {/* 响应式卡片网格：3/4/5 列封顶 */}
        <div
          ref={gridRef}
          data-card-grid
          data-card-columns={columnCount}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`, paddingTop, paddingBottom }}
        >
          {artboards.slice(startIndex, endIndex).map((artboard) => (
            <div
              key={artboard.id}
              data-card
              draggable={Boolean(artboard.imageId)}
              onDragStart={(e) => {
                if (!artboard.imageId) return
                e.dataTransfer.effectAllowed = 'copy'
                e.dataTransfer.setData('application/x-studio-image', JSON.stringify({ imageId: artboard.imageId, url: artboard.imageUrl, name: artboard.title }))
              }}
              className="soft-card-shadow group flex flex-col overflow-hidden rounded-2xl border border-black/[0.05] bg-white transition-all hover:-translate-y-0.5 hover:border-black/[0.12] dark:border-white/[0.07] dark:bg-[#161822] dark:hover:border-white/[0.16]"
            >
              {/* Image Preview Container */}
              <div
                onClick={() => {
                  // 素材没有 taskId，不能走任务详情弹窗（会显示假的 task ID），用轻量大图预览
                  if (artboard.isAsset) {
                    if (!selectionMode) setAssetPreview(artboard)
                    return
                  }
                  if (selectionMode && onToggleTaskSelection && artboard.taskId) {
                    onToggleTaskSelection(artboard.taskId)
                  } else if (onInspectArtboard) {
                    onInspectArtboard(artboard)
                  } else {
                    setInspectArtboard(artboard)
                  }
                }}
                className={`relative aspect-[16/9] w-full bg-surface-2 overflow-hidden ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06] cursor-pointer ${selectionMode && selectedTaskIds?.has(artboard.taskId ?? '') ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
              >
                {artboard.isAsset && !selectionMode && (
                  <span className="absolute left-2 top-2 z-20 flex h-5 items-center gap-1 rounded-chip bg-black/70 px-2 text-caption font-medium text-white backdrop-blur-md">
                    <ImagePlus className="h-3 w-3 stroke-[1.6]" />
                    素材 图{artboard.assetNumber}
                  </span>
                )}
                {selectionMode && (
                  <span className={`absolute left-2 top-2 z-20 w-4 h-4 rounded border flex items-center justify-center ${selectedTaskIds?.has(artboard.taskId ?? '') ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white/85 border-black/25 text-transparent'}`}>
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </span>
                )}
                {artboard.imageId ? (
                  <ArtboardThumb
                    imageId={artboard.imageId}
                    imageUrl={artboard.imageUrl}
                    alt={artboard.title}
                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.01]"
                  />
                ) : artboard.status === 'error' ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-red-500/[0.07] px-6 text-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/15 text-red-500">
                      <X className="h-4 w-4 stroke-[2]" />
                    </span>
                    <p className="text-body-sm font-medium text-red-600 dark:text-red-400">生成失败</p>
                    <p className="line-clamp-2 max-w-[85%] text-caption text-ink-3">{artboard.errorMessage || '未返回错误信息'}</p>
                    {onRetryTask && artboard.taskId && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRetryTask(artboard.taskId!) }}
                        className="mt-1 h-6 rounded-chip bg-red-500 px-2.5 text-caption font-medium text-white transition-colors duration-fast hover:bg-red-600"
                      >
                        重试
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                    <span className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand/70"
                          style={{ animationDelay: `${i * 160}ms` }}
                        />
                      ))}
                    </span>
                    <p className="text-body-sm text-ink-2">正在生成</p>
                    <p className="text-caption text-ink-3">{artboard.model}</p>
                  </div>
                )}

                {/* Hover Action Overlay: Pure Monochrome buttons */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute top-2 right-2 flex items-center gap-1 transition-opacity z-10 ${selectionMode
                    ? (artboard.taskId && selectedTaskIds?.has(artboard.taskId) ? 'opacity-100' : 'hidden')
                    : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto'}`}
                >
                  {/* Pin as Reference Image to Bottom Bar! */}
                  {onSetAsReference && artboard.imageId && (
                    <button
                      onClick={() => onSetAsReference(artboard)}
                      className="flex h-7 cursor-pointer items-center gap-1 rounded-full bg-black/80 px-2.5 text-caption font-medium text-white shadow-sm backdrop-blur-md transition hover:bg-black"
                      title="加入输入台参考图"
                    >
                      <ImagePlus className="w-3 h-3 stroke-[1.5]" />
                      <span>设为参考图</span>
                    </button>
                  )}

                  {/* Recall Parameters */}
                  {!artboard.isAsset && onRecallPrompt && artboard.imageId && (
                    <button
                      onClick={() => onRecallPrompt(artboard)}
                      className="w-6 h-6 rounded-lg bg-black/80 hover:bg-black text-white flex items-center justify-center backdrop-blur-md transition cursor-pointer shadow-sm"
                      title="一键载入该图参数到输入框"
                    >
                      <RotateCcw className="w-3 h-3 stroke-[1.5]" />
                    </button>
                  )}

                  {/* Send to Main Canvas */}
                  {!artboard.isAsset && artboard.imageId && <button
                    onClick={() => onSendToCanvas(artboard)}
                    className="w-6 h-6 rounded-lg bg-black/80 hover:bg-black text-white flex items-center justify-center backdrop-blur-md transition cursor-pointer shadow-sm"
                    title="送入主画布"
                  >
                    <Layers className="w-3 h-3 stroke-[1.5]" />
                  </button>}

                  {/* Copy Prompt：素材没有提示词，不显示 */}
                  {!artboard.isAsset && (
                    <button
                      onClick={() =>
                        handleCopyPrompt(artboard.id, artboard.prompt || currentScheme?.prompt || '')
                      }
                      className="w-6 h-6 rounded-lg bg-black/80 hover:bg-black text-white flex items-center justify-center backdrop-blur-md transition cursor-pointer shadow-sm"
                      title="复制提示词"
                    >
                      {copiedId === artboard.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 stroke-[1.5]" />
                      )}
                    </button>
                  )}

                  {/* Download */}
                  {artboard.imageId && <button
                    onClick={() => handleDownload(artboard)}
                    className="w-6 h-6 rounded-lg bg-black/80 hover:bg-black text-white flex items-center justify-center backdrop-blur-md transition cursor-pointer shadow-sm"
                    title="下载高清原图"
                  >
                    <Download className="w-3 h-3 stroke-[1.5]" />
                  </button>}
                </div>

                {/* 左下角分辨率：默认隐藏，悬停卡片时出现 */}
                <div data-card-resolution className="absolute bottom-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-caption font-mono text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
                  {artboard.resolution}
                </div>
              </div>

              {/* Bottom Card Meta (4px spacing) */}
              <div className="p-2.5 flex items-center justify-between text-body-sm border-t border-black/[0.04] dark:border-white/[0.05]">
                <div className="min-w-0 pr-2">
                  <div className="font-medium text-body-sm text-slate-800 dark:text-slate-100 truncate">
                    {artboard.title}
                  </div>
                  <div className="text-caption text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                    {artboard.isAsset
                      ? '参考图素材'
                      : <>{artboard.model}{artboard.status === 'running' ? ' · 生成中' : artboard.status === 'error' ? ' · 失败' : artboard.renderTime ? ` · 耗时 ${artboard.renderTime}` : ''}</>}
                  </div>
                </div>

                <button
                  onClick={() => artboard.isAsset ? setAssetPreview(artboard) : onInspectArtboard ? onInspectArtboard(artboard) : setInspectArtboard(artboard)}
                  className="w-6 h-6 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                  title="全屏检视"
                >
                  <Maximize2 className="w-3.5 h-3.5 stroke-[1.4]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fullscreen High-Res Modal (Aligned with image_7e5123d4.png) */}
      {inspectArtboard && !onInspectArtboard && (
        <ImageDetailModal
          artboard={inspectArtboard}
          onClose={() => setInspectArtboard(null)}
          onRecallPrompt={onRecallPrompt}
          onEditOutput={onRecallPrompt}
          onDeleteArtboard={onDeleteArtboard}
          onToggleStar={onToggleStar}
          onSetAsReference={onSetAsReference}
        />
      )}
      {assetPreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm"
          onClick={() => setAssetPreview(null)}
        >
          <button
            type="button"
            onClick={() => setAssetPreview(null)}
            className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="关闭预览"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
            <ArtboardThumb
              imageId={assetPreview.imageId}
              imageUrl={assetPreview.imageUrl}
              alt={assetPreview.title}
              className="max-h-[86vh] max-w-[86vw] rounded-xl object-contain shadow-2xl"
            />
            <p className="mt-3 text-center text-caption text-white/70">{assetPreview.title}</p>
          </div>
        </div>
      )}
    </div>
  );
};
