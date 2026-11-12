import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  RotateCcw,
  Edit3,
  Trash2,
  Star,
  Layers,
} from 'lucide-react';
import type { Artboard, ReferenceImage } from '../types.ts';
import { INITIAL_REFERENCE_IMAGES } from '../constants.ts';
import { downloadImage } from '../../lib/downloadImage';
import { downloadTaskImages } from '../../lib/taskExport';
import { getDownloadErrorMessage } from '../../lib/downloadImages';
import { useStore } from '../../store';

interface ImageDetailModalProps {
  artboard: Artboard;
  onClose: () => void;
  onRecallPrompt?: (artboard: Artboard) => void;
  onEditOutput?: (artboard: Artboard) => void;
  onDeleteArtboard?: (id: string) => void;
  onToggleStar?: (id: string) => void;
  onSetAsReference?: (artboard: Artboard) => void;
}

export const ImageDetailModal: React.FC<ImageDetailModalProps> = ({
  artboard,
  onClose,
  onRecallPrompt,
  onEditOutput,
  onDeleteArtboard,
  onToggleStar,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isStarred, setIsStarred] = useState(artboard.isStarred ?? false);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleDownload = async () => {
    const ref = artboard.imageId || artboard.imageUrl;
    if (!ref) return;
    const tasks = useStore.getState().tasks;
    const task = tasks.find((item) => item.id === artboard.taskId)
      ?? tasks.find((item) => artboard.imageId && item.outputImages.includes(artboard.imageId));
    const result = task && artboard.imageId
      ? await downloadTaskImages(task, [artboard.imageId], { fileNameBase: artboard.title || 'panpan-artwork' })
      : await downloadImage(ref, artboard.title || 'panpan-artwork', artboard.imageIndex);
    if (result.canceled || result.successCount) return;
    useStore.getState().showToast(getDownloadErrorMessage(result.error), 'error');
  };

  const refImages: ReferenceImage[] = artboard.referenceImages?.length
    ? artboard.referenceImages
    : INITIAL_REFERENCE_IMAGES;

  const taskId = artboard.taskId || 'mvwijwydce0d1';
  const imageId = artboard.imageId || '4f44ff11cbd5cf7a3ea9ffd5d88dbce712f8de527d98b1';
  const createdAt = artboard.createdAt || '2026/10/31 22:45:42';
  const duration = artboard.duration || '00:47';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[960px] max-w-[96vw] max-h-[92vh] rounded-2xl overflow-hidden shadow-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#161822] text-slate-800 dark:text-slate-100 flex flex-col md:flex-row"
      >
        {/* =========================================================================
            LEFT COLUMN: High-Res Image Canvas Preview (Matches image_7e5123d4.png)
            ========================================================================= */}
        <div className="relative md:w-1/2 bg-[#f0f2f5] dark:bg-[#0c0e14] flex flex-col items-center justify-center p-4 min-h-[320px] md:min-h-0 border-b md:border-b-0 md:border-r border-black/[0.06] dark:border-white/[0.08]">
          {/* Top Floating Badge Bar */}
          <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-10 pointer-events-none">
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <span className="px-2 py-0.5 rounded bg-black/60 text-white text-body-sm font-mono font-medium backdrop-blur-md">
                ≈{artboard.aspectRatio || '16:9'}
              </span>
              <span className="px-2 py-0.5 rounded bg-black/60 text-white text-body-sm font-mono font-medium backdrop-blur-md">
                1672×941
              </span>
            </div>

            <button
              onClick={handleDownload}
              className="w-7 h-7 rounded bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-md transition cursor-pointer pointer-events-auto shadow-sm"
              title="下载原图"
              aria-label="下载原图"
            >
              <Download className="w-3.5 h-3.5 stroke-[1.7]" />
            </button>
          </div>

          {/* Centered Image */}
          <div className="w-full h-full flex items-center justify-center max-h-[70vh]">
            <img
              src={artboard.imageUrl}
              alt={artboard.title}
              className="max-h-[66vh] max-w-full object-contain rounded-lg shadow-md"
            />
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: Generation Prompt & Workflow Parameters
            ========================================================================= */}
        <div className="md:w-1/2 flex flex-col h-full max-h-[92vh] bg-white dark:bg-[#161822]">
          {/* Top Close Button */}
          <div className="h-10 px-4 flex items-center justify-end shrink-0 border-b border-black/[0.03] dark:border-white/[0.04]">
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
              title="关闭 (Esc)"
            >
              <X className="w-4 h-4 stroke-[1.6]" />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
            {/* 1. Prompt Card: Distinct Warm Yellow Note (Matching User's Screenshot) */}
            <div className="relative p-3.5 rounded-xl bg-[#fefce8] dark:bg-[#232115] border border-[#fef08a] dark:border-[#544d1e] text-[#713f12] dark:text-[#fef08a] text-body-sm leading-relaxed shadow-2xs select-text">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#fef08a]/60 dark:border-[#544d1e]/80">
                <span className="font-semibold text-body-sm opacity-80">提示词内容 (Prompt)</span>
                <button
                  onClick={() => copyToClipboard(artboard.prompt || artboard.title, 'prompt')}
                  className="flex items-center gap-1 text-caption opacity-80 hover:opacity-100 transition cursor-pointer"
                >
                  {copiedField === 'prompt' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[2.2]" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 stroke-[1.6]" />
                      <span>复制</span>
                    </>
                  )}
                </button>
              </div>
              <div className="whitespace-pre-wrap max-h-40 overflow-y-auto no-scrollbar font-sans">
                {artboard.prompt || artboard.title}
              </div>
            </div>

            {/* 2. Reference Images Section (参考图 + 4 Preview Thumbnails) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-body-sm font-medium text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-1.5">
                  <span>参考图</span>
                  <span className="text-caption text-slate-400">({refImages.length})</span>
                </div>
                <button
                  onClick={() => copyToClipboard(refImages.map((r) => r.url).join('\n'), 'refs')}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                  title="复制参考图链接"
                >
                  <Copy className="w-3.5 h-3.5 stroke-[1.4]" />
                </button>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                {refImages.map((ref, idx) => (
                  <div
                    key={ref.id || idx}
                    className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-black/10 dark:border-white/10 group cursor-pointer"
                    title={`${ref.name || '参考图'} (权重: ${Math.round((ref.weight || 0.8) * 100)}%)`}
                  >
                    <img
                      src={ref.url}
                      alt={ref.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-caption text-center font-mono py-0.2">
                      #{idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Parameter Grid (参数配置 - Matching User's Screenshot Structure) */}
            <div className="space-y-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.06]">
              <div className="text-body-sm font-medium text-slate-700 dark:text-slate-300">
                参数配置
              </div>

              {/* Source Tagline */}
              <div className="text-body-sm text-slate-500 font-mono flex items-center gap-1">
                <span className="text-slate-400">来源</span>
                <span className="text-slate-800 dark:text-slate-200 font-sans font-medium">
                  OpenAI · 20261031-生图1 · {artboard.model || 'gpt-image-2.5'}
                </span>
              </div>

              {/* 2-Column Metric Grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-body-sm">
                {/* 尺寸 */}
                <div className="space-y-0.5">
                  <span className="text-slate-400 text-caption">尺寸</span>
                  <div className="flex items-center gap-1.5 font-mono text-slate-700 dark:text-slate-300">
                    <span>2560x1440</span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-caption font-medium border border-amber-300/60 dark:border-amber-700/60">
                      1672×941
                    </span>
                  </div>
                </div>

                {/* 质量 */}
                <div className="space-y-0.5">
                  <span className="text-slate-400 text-caption">质量</span>
                  <div className="font-mono text-slate-700 dark:text-slate-300">
                    {artboard.quality || 'auto'}
                  </div>
                </div>

                {/* 格式 */}
                <div className="space-y-0.5">
                  <span className="text-slate-400 text-caption">格式</span>
                  <div className="font-mono text-slate-700 dark:text-slate-300">
                    {artboard.format || 'png'}
                  </div>
                </div>

                {/* 透明背景 */}
                <div className="space-y-0.5">
                  <span className="text-slate-400 text-caption">透明背景</span>
                  <div className="font-mono text-slate-700 dark:text-slate-300">
                    {artboard.transparent ? 'true' : 'false'}
                  </div>
                </div>

                {/* 审核 */}
                <div className="space-y-0.5">
                  <span className="text-slate-400 text-caption">审核</span>
                  <div className="font-mono text-slate-700 dark:text-slate-300">
                    {artboard.filter || 'auto'}
                  </div>
                </div>

                {/* 数量 */}
                <div className="space-y-0.5">
                  <span className="text-slate-400 text-caption">数量</span>
                  <div className="font-mono text-slate-700 dark:text-slate-300">
                    {artboard.count || 1}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Timestamp & Task / Image IDs */}
            <div className="space-y-1 pt-2 border-t border-black/[0.04] dark:border-white/[0.06] text-caption text-slate-400 font-mono">
              <div>
                创建于 {createdAt} · 耗时 {duration}
              </div>

              {/* Task ID with Copy */}
              <div className="flex items-center gap-1.5">
                <span>任务 ID</span>
                <span className="text-slate-600 dark:text-slate-300">{taskId}</span>
                <button
                  onClick={() => copyToClipboard(taskId, 'taskId')}
                  className="text-blue-500 hover:text-blue-600 text-caption ml-1 transition cursor-pointer"
                >
                  {copiedField === 'taskId' ? '已复制' : '复制'}
                </button>
              </div>

              {/* Image ID with Copy */}
              <div className="flex items-center gap-1.5">
                <span>图片 ID</span>
                <span className="text-slate-600 dark:text-slate-300 truncate max-w-[180px]">
                  {imageId}
                </span>
                <button
                  onClick={() => copyToClipboard(imageId, 'imageId')}
                  className="text-blue-500 hover:text-blue-600 text-caption ml-1 transition cursor-pointer"
                >
                  {copiedField === 'imageId' ? '已复制' : '复制'}
                </button>
              </div>
            </div>
          </div>

          {/* =========================================================================
              MODAL BOTTOM ACTIONS (Matching image_7e5123d4.png footer)
              [ ↰ 复用配置 | ✍ 编辑输出 | 🗑 删除任务 | ☆ 收藏 ]
              ========================================================================= */}
          <div className="h-[52px] px-4 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between bg-black/[0.015] dark:bg-white/[0.02] shrink-0">
            {/* Primary Action Group */}
            <div className="flex items-center gap-2">
              {/* ↰ 复用配置 */}
              {onRecallPrompt && (
                <button
                  onClick={() => {
                    onRecallPrompt(artboard);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 text-body-sm font-medium flex items-center gap-1.5 transition cursor-pointer"
                  title="将该图的提示词与全部参数一键载入生成面板"
                >
                  <RotateCcw className="w-3.5 h-3.5 stroke-[1.6]" />
                  <span>复用配置</span>
                </button>
              )}

              {/* ✍ 编辑输出 */}
              <button
                onClick={() => {
                  if (onEditOutput) onEditOutput(artboard);
                  else if (onRecallPrompt) onRecallPrompt(artboard);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 text-body-sm font-medium flex items-center gap-1.5 transition cursor-pointer"
                title="将该图载入工作流进行局部调整"
              >
                <Edit3 className="w-3.5 h-3.5 stroke-[1.6]" />
                <span>编辑输出</span>
              </button>

              {/* 🗑 删除任务 */}
              {onDeleteArtboard && (
                <button
                  onClick={() => {
                    onDeleteArtboard(artboard.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-body-sm font-medium flex items-center gap-1.5 transition cursor-pointer"
                  title="删除此任务图片"
                >
                  <Trash2 className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>删除任务</span>
                </button>
              )}
            </div>

            {/* Right: Star / Favorite Button */}
            <button
              onClick={() => {
                const nextState = !isStarred;
                setIsStarred(nextState);
                if (onToggleStar) onToggleStar(artboard.id);
              }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                isStarred
                  ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title={isStarred ? '已收藏' : '收藏'}
            >
              <Star
                className={`w-4 h-4 stroke-[1.5] ${isStarred ? 'fill-amber-400 text-amber-500' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
