import React, { useState } from 'react';
import { Artboard, ProjectScheme } from '../types.ts';
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
  Trash2,
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
  isGenerating?: boolean;
  viewMode?: 'canvas' | 'grid';
  onSelectViewMode?: (mode: 'canvas' | 'grid') => void;
}

export const CardGridView: React.FC<CardGridViewProps> = ({
  artboards,
  currentScheme,
  onSendToCanvas,
  onSetAsReference,
  onRecallPrompt,
  onDeleteArtboard,
  onToggleStar,
  isGenerating,
  viewMode = 'grid',
  onSelectViewMode,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inspectArtboard, setInspectArtboard] = useState<Artboard | null>(null);

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

  return (
    <div className="relative flex-1 h-full overflow-y-auto no-scrollbar p-6 pb-44 text-slate-800 dark:text-slate-100 select-none">
      {/* Seamless Dot Matrix Background */}
      <div className="absolute inset-0 stitch-dot-canvas opacity-50 dark:opacity-35 pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-4 relative z-10">
        {/* Subtle Header */}
        <div className="flex items-center justify-between pb-2 border-b border-black/[0.04] dark:border-white/[0.05]">
          <div className="flex items-center gap-2">
            <h2 className="text-[12.5px] font-semibold text-slate-900 dark:text-white">
              九宫格历史卡片
            </h2>
            <span className="text-[10.5px] font-mono px-1.5 py-0.2 rounded-full bg-black/[0.04] dark:bg-white/[0.07] text-slate-500">
              {artboards.length}
            </span>
          </div>
          <span className="text-[10.5px] text-slate-400">
            悬停卡片可设为垫图/参考图 · 点击卡片全屏检视
          </span>
        </div>

        {/* 3x3 Responsive Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Active Generation Breathing Shimmer Card */}
          {isGenerating && (
            <div className="rounded-xl overflow-hidden bg-white/60 dark:bg-[#161822]/60 border border-black/20 dark:border-white/20 shadow-md p-4 flex flex-col justify-between aspect-[16/9] animate-pulse relative">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>生成演算中...</span>
                <span className="w-2 h-2 rounded-full bg-black dark:bg-white animate-ping"></span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1.5 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-black/20 border-t-black dark:border-white/20 dark:border-t-white animate-spin"></div>
                <div className="text-[12px] font-medium text-slate-800 dark:text-slate-200">
                  Sampling 18/30 Steps · 60%
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  预计剩余 1.4s · 显存占用 8.4 GB
                </div>
              </div>
              <div className="w-full bg-black/[0.06] dark:bg-white/[0.08] h-1 rounded-full overflow-hidden">
                <div className="bg-black dark:bg-white h-full w-3/5 rounded-full"></div>
              </div>
            </div>
          )}

          {artboards.map((artboard) => (
            <div
              key={artboard.id}
              className="group rounded-xl overflow-hidden bg-white dark:bg-[#161822] border border-black/[0.07] dark:border-white/[0.08] hover:border-black/[0.2] dark:hover:border-white/[0.25] shadow-xs hover:shadow-md transition-all flex flex-col"
            >
              {/* Image Preview Container */}
              <div
                onClick={() => setInspectArtboard(artboard)}
                className="relative aspect-[16/9] w-full bg-slate-100 dark:bg-black/40 overflow-hidden cursor-pointer"
              >
                <img
                  src={artboard.imageUrl}
                  alt={artboard.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                />

                {/* Hover Action Overlay: Pure Monochrome buttons */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  {/* Pin as Reference Image to Bottom Bar! */}
                  {onSetAsReference && (
                    <button
                      onClick={() => onSetAsReference(artboard)}
                      className="h-6 px-2 rounded-lg bg-black/80 hover:bg-black text-white text-[10px] font-medium backdrop-blur-md flex items-center gap-1 transition cursor-pointer shadow-sm"
                      title="引用为底栏垫图/参考图"
                    >
                      <ImagePlus className="w-3 h-3 stroke-[1.5]" />
                      <span>设为垫图</span>
                    </button>
                  )}

                  {/* Recall Parameters */}
                  {onRecallPrompt && (
                    <button
                      onClick={() => onRecallPrompt(artboard)}
                      className="w-6 h-6 rounded-lg bg-black/80 hover:bg-black text-white flex items-center justify-center backdrop-blur-md transition cursor-pointer shadow-sm"
                      title="一键载入该图参数到输入框"
                    >
                      <RotateCcw className="w-3 h-3 stroke-[1.5]" />
                    </button>
                  )}

                  {/* Send to Main Canvas */}
                  <button
                    onClick={() => onSendToCanvas(artboard)}
                    className="w-6 h-6 rounded-lg bg-black/80 hover:bg-black text-white flex items-center justify-center backdrop-blur-md transition cursor-pointer shadow-sm"
                    title="送入主画布"
                  >
                    <Layers className="w-3 h-3 stroke-[1.5]" />
                  </button>

                  {/* Copy Prompt */}
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

                  {/* Download */}
                  <button
                    onClick={() => handleDownload(artboard)}
                    className="w-6 h-6 rounded-lg bg-black/80 hover:bg-black text-white flex items-center justify-center backdrop-blur-md transition cursor-pointer shadow-sm"
                    title="下载高清原图"
                  >
                    <Download className="w-3 h-3 stroke-[1.5]" />
                  </button>
                </div>

                {/* Bottom resolution pill */}
                <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white text-[9.5px] font-mono">
                  {artboard.resolution}
                </div>
              </div>

              {/* Bottom Card Meta (4px spacing) */}
              <div className="p-2.5 flex items-center justify-between text-xs border-t border-black/[0.04] dark:border-white/[0.05]">
                <div className="min-w-0 pr-2">
                  <div className="font-medium text-[11.5px] text-slate-800 dark:text-slate-100 truncate">
                    {artboard.title}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                    {artboard.model} · 耗时 {artboard.renderTime || '2.4s'}
                  </div>
                </div>

                <button
                  onClick={() => setInspectArtboard(artboard)}
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

      {/* Floating Bottom-Right View Switcher Pill */}
      {onSelectViewMode && (
        <div className="absolute bottom-3 right-3 z-30 pointer-events-auto">
          <div className="h-[28px] p-0.5 rounded-full bg-white/95 dark:bg-[#161822]/95 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.08] shadow-sm flex items-center gap-0.5 text-[11px]">
            <button
              onClick={() => onSelectViewMode('canvas')}
              className={`h-[22px] px-2 rounded-full flex items-center gap-1 transition-all cursor-pointer font-medium ${
                viewMode === 'canvas'
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="切换至无限画布模式"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
                <rect x="1" y="1" width="10" height="10" rx="1" />
                <line x1="6" y1="1" x2="6" y2="11" />
                <line x1="1" y1="6" x2="11" y2="6" />
              </svg>
              <span>画布</span>
            </button>

            <button
              onClick={() => onSelectViewMode('grid')}
              className={`h-[22px] px-2 rounded-full flex items-center gap-1 transition-all cursor-pointer font-medium ${
                viewMode === 'grid'
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="切换至九宫格矩阵模式"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <rect x="1" y="1" width="2.5" height="2.5" rx="0.5" />
                <rect x="4.75" y="1" width="2.5" height="2.5" rx="0.5" />
                <rect x="8.5" y="1" width="2.5" height="2.5" rx="0.5" />
                <rect x="1" y="4.75" width="2.5" height="2.5" rx="0.5" />
                <rect x="4.75" y="4.75" width="2.5" height="2.5" rx="0.5" />
                <rect x="8.5" y="4.75" width="2.5" height="2.5" rx="0.5" />
                <rect x="1" y="8.5" width="2.5" height="2.5" rx="0.5" />
                <rect x="4.75" y="8.5" width="2.5" height="2.5" rx="0.5" />
                <rect x="8.5" y="8.5" width="2.5" height="2.5" rx="0.5" />
              </svg>
              <span>九宫格</span>
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen High-Res Modal (Aligned with image_7e5123d4.png) */}
      {inspectArtboard && (
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
    </div>
  );
};
