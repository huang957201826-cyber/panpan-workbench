import React, { useState } from 'react';
import { Artboard } from '../types.ts';

interface HomeHubViewProps {
  onGeneratePrompt: (promptText: string, model?: string) => void;
  onOpenArtboard: (artboard: Artboard) => void;
  onNavigateToProjects: () => void;
  isGenerating: boolean;
}

export const HomeHubView: React.FC<HomeHubViewProps> = ({
  onGeneratePrompt,
  isGenerating,
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-image-2.5');
  const [isFocused, setIsFocused] = useState(false);

  const handleLaunch = () => {
    if (!promptInput.trim()) return;
    onGeneratePrompt(promptInput.trim(), selectedModel);
  };

  return (
    <div className="relative w-full h-full bg-[#f3f4f8] dark:bg-[#0c0e14] overflow-hidden flex flex-col justify-center items-center select-none transition-colors px-6">
      {/* Subtle Specular Ambient Halo behind the headline to eliminate any flat dullness */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[340px] bg-gradient-to-tr from-slate-400/[0.08] via-slate-300/[0.04] to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Central Floating Stage: Expanded to 780px for balanced aspect ratio and generous breathing room */}
      <div className="w-full max-w-[780px] flex flex-col items-center gap-8.5 -translate-y-6 z-10">
        {/* =========================================================================
            1. DRAMATIC SPECULAR HEADLINE (Diagonal Metallic Silk Sheen + Micro Eyebrow)
            ========================================================================= */}
        <div className="flex flex-col items-center text-center gap-3">
          {/* Micro Precision Eyebrow Badge (Teenage Engineering / Apple Pro aesthetic) */}
          <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/[0.06] text-[10.5px] font-mono tracking-widest uppercase text-slate-500 dark:text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Spatial Engine · Pro 2.5</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-[44px] font-black tracking-tight leading-[1.14] bg-gradient-to-br from-slate-950 via-slate-800 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-500 bg-clip-text text-transparent drop-shadow-xs transition-all">
            让每一个空间构想，在此精准呈现
          </h1>
          <p className="text-[14px] sm:text-[14.5px] text-slate-500/90 dark:text-slate-400/80 font-normal tracking-wide max-w-lg leading-relaxed">
            输入一段空间描述，秒级输出高保真工程方案
          </p>
        </div>

        {/* =========================================================================
            2. THE CENTERPIECE: TACTILE MINIMALIST INPUT VESSEL (Focus Ring & Glow)
            ========================================================================= */}
        <div
          className={`w-full rounded-3xl bg-white dark:bg-[#141620] border transition-all duration-200 p-6 flex flex-col gap-4 ${
            isFocused
              ? 'border-black/15 dark:border-white/20 soft-float-shadow shadow-xl ring-2 ring-black/[0.03] dark:ring-white/[0.04] scale-[1.005]'
              : 'border-black/[0.05] dark:border-white/[0.06] soft-card-shadow'
          }`}
        >
          <textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleLaunch();
              }
            }}
            placeholder="描述你的空间设计构想，例如：商业综合体退台式绿植中庭，清晨穿透天光，极简建筑摄影，8K 细节..."
            rows={3}
            className="w-full bg-transparent resize-none border-none p-1 text-[15px] leading-relaxed text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none font-sans"
            autoFocus
          />

          {/* Model Chips + High Contrast Send Action Pill */}
          <div className="flex items-center justify-between gap-3 pt-3.5 border-t border-black/[0.04] dark:border-white/[0.05]">
            {/* Quick Model Chips with hardware status light */}
            <div className="flex items-center gap-2">
              {[
                { id: 'gpt-image-2.5', label: 'GPT Image 2.5' },
                { id: 'flux.1-dev', label: 'FLUX.1-Dev' },
                { id: 'sd-xl-base-1.0', label: 'SDXL 建筑' },
              ].map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={`h-7.5 px-3.5 rounded-full text-[11.5px] font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs font-semibold'
                        : 'bg-[#f3f4f8] dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-[#eaecee] dark:hover:bg-white/[0.12]'
                    }`}
                  >
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-600 shrink-0" />
                    )}
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Launch CTA Pill */}
            <button
              onClick={handleLaunch}
              disabled={isGenerating || !promptInput.trim()}
              className="h-9 px-5 rounded-full bg-black text-white dark:bg-white dark:text-black font-medium text-[12px] flex items-center gap-2 transition-all hover:opacity-90 active:scale-97 disabled:opacity-25 disabled:pointer-events-none cursor-pointer shadow-sm"
            >
              {isGenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black rounded-full animate-spin" />
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  <span>立即生成</span>
                  <span className="text-[10px] opacity-60 font-mono">⌘↵</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
