import React, { useState } from 'react';
import { Cpu, Play, RefreshCw } from 'lucide-react';

interface ComfySidebarProps {
  onQueuePrompt: (steps: number, cfg: number, sampler: string) => void;
  isQueueRunning: boolean;
  width: number;
}

export const ComfySidebar: React.FC<ComfySidebarProps> = ({
  onQueuePrompt,
  isQueueRunning,
  width,
}) => {
  const [steps, setSteps] = useState(28);
  const [cfg, setCfg] = useState(3.5);
  const [denoise, setDenoise] = useState(0.75);
  const [sampler, setSampler] = useState('dpmpp_2m_karras');

  return (
    <aside
      style={{ width: `${width}px` }}
      className="relative shrink-0 h-full bg-[#fcfdfe]/95 dark:bg-[#12141c]/95 backdrop-blur-2xl border-r border-black/[0.06] dark:border-white/[0.07] flex flex-col z-20 select-none text-slate-800 dark:text-slate-100 transition-colors text-xs"
    >
      {/* Header */}
      <div className="h-[36px] px-3.5 border-b border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-1.5 font-medium text-[11.5px]">
          <Cpu className="w-3.5 h-3.5 stroke-[1.8]" />
          <span>本地推理执行管线</span>
        </div>
        <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded-full bg-black/[0.04] dark:bg-white/[0.07] text-slate-500 font-medium">
          127.0.0.1:8188 就绪
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3">
        {/* Hardware Status (Monochrome) */}
        <div className="p-3 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] text-slate-800 dark:text-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-800 dark:bg-slate-200"></span>
            <span className="font-semibold text-[11px]">RTX 4090 24GB 直连</span>
          </div>
          <span className="font-mono text-[10px] text-slate-500">显存: 7.6GB / 24GB (32%)</span>
        </div>

        {/* Workflow Card */}
        <div className="p-2.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.06] flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-800 dark:text-white text-[11px]">
              FLUX.1-Dev 写实渲染流水线
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/[0.06] dark:bg-white/[0.1] text-slate-700 dark:text-slate-300 font-medium">
              活动中
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            权重: flux1-dev-fp8.safetensors
          </span>
        </div>

        {/* Sampler Controls */}
        <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.06] flex flex-col gap-2.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">KSampler 采样器</span>
            <select
              value={sampler}
              onChange={(e) => setSampler(e.target.value)}
              className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded px-2 py-0.5 text-xs outline-none"
            >
              <option value="dpmpp_2m_karras">dpmpp_2m_karras</option>
              <option value="euler">euler</option>
              <option value="euler_ancestral">euler_ancestral</option>
              <option value="unipc">unipc</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-slate-500">步数 (Steps)</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {steps}
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
              className="w-full accent-slate-800 dark:accent-slate-200 h-1 bg-black/10 dark:bg-white/10 rounded cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-slate-500">提示词引导相关度 (CFG)</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {cfg.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="8.0"
              step="0.5"
              value={cfg}
              onChange={(e) => setCfg(Number(e.target.value))}
              className="w-full accent-slate-800 dark:accent-slate-200 h-1 bg-black/10 dark:bg-white/10 rounded cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-slate-500">降噪重绘幅度 (Denoise)</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {denoise.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={denoise}
              onChange={(e) => setDenoise(Number(e.target.value))}
              className="w-full accent-slate-800 dark:accent-slate-200 h-1 bg-black/10 dark:bg-white/10 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Execution Button (Pure Monochrome) */}
        <button
          onClick={() => onQueuePrompt(steps, cfg, sampler)}
          disabled={isQueueRunning}
          className={`w-full py-2 rounded-lg flex items-center justify-center gap-1.5 font-medium text-xs shadow-xs transition cursor-pointer ${
            isQueueRunning
              ? 'bg-black/50 dark:bg-white/50 text-white dark:text-black cursor-wait'
              : 'bg-black text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-200 active:scale-98'
          }`}
        >
          {isQueueRunning ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>{isQueueRunning ? '本地 GPU 正在采样生成...' : '提交队列本地渲染 (Queue)'}</span>
        </button>
      </div>
    </aside>
  );
};
