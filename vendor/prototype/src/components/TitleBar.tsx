import React from 'react';

interface TitleBarProps {
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onTitleBarMouseDown?: (e: React.MouseEvent) => void;
  [key: string]: any;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  isMaximized,
  onToggleMaximize,
  onMinimize,
  onClose,
  onTitleBarMouseDown,
}) => {
  return (
    <header
      onMouseDown={onTitleBarMouseDown}
      className="h-[36px] w-full shrink-0 flex items-center justify-between px-3 bg-white/70 dark:bg-[#10121a]/70 backdrop-blur-md border-b border-black/[0.04] dark:border-white/[0.05] text-slate-700 dark:text-slate-300 text-[12px] select-none relative z-40 transition-colors cursor-default"
    >
      {/* Left Whitespace: Pure unbroken serene window margin (No duplicated logo) */}
      <div className="w-12 h-full z-10" />


      {/* Center: Pure Drag Whitespace (Completely serene, matching DSH Desktop's clean window chrome) */}
      <div className="flex-1 h-full mx-4 cursor-default pointer-events-none" />

      {/* Right: Native Windows 11 Caption Controls Only */}
      <div className="flex items-center h-full z-10">
        <div className="flex items-center -mr-2 h-full border-l border-black/[0.06] dark:border-white/[0.08]">
          {/* Minimize: 10px single horizontal stroke */}
          <button
            onClick={onMinimize}
            className="w-[44px] h-[38px] flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="最小化"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </button>

          {/* Maximize / Restore: 10px square */}
          <button
            onClick={onToggleMaximize}
            className="w-[44px] h-[38px] flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title={isMaximized ? '向下还原' : '最大化'}
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="0.5" width="7.5" height="7.5" stroke="currentColor" strokeWidth="1" />
                <polyline points="0.5,2.5 0.5,9.5 7.5,9.5" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
              </svg>
            )}
          </button>

          {/* Close: 10px cross with Windows 11 red hover */}
          <button
            onClick={onClose}
            className="w-[44px] h-[38px] flex items-center justify-center hover:bg-[#e81123] hover:text-white text-slate-600 dark:text-slate-300 transition cursor-pointer group"
            title="关闭"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0.5 0.5L9.5 9.5M9.5 0.5L0.5 9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};
