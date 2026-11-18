import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Folder,
} from 'lucide-react';
import { AppLogo } from './AppLogo.tsx';

interface TaskbarProps {
  isWindowMinimized: boolean;
  onRestoreWindow: () => void;
  onToggleWindow: () => void;
  onOpenSettings: () => void;
}

export const Taskbar: React.FC<TaskbarProps> = ({
  isWindowMinimized,
  onRestoreWindow,
  onToggleWindow,
  onOpenSettings,
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [showStartMenu, setShowStartMenu] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const startMenuRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
      setDateStr(`${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (startMenuRef.current && !startMenuRef.current.contains(e.target as Node)) {
        setShowStartMenu(false);
      }
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 select-none">
      {/* Floating Centered Dock with 16px Frosted Glass Blur & 12px Border Radius */}
      <nav
        style={{
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        }}
        className="px-2.5 py-1 rounded-xl bg-white/70 dark:bg-[#161822]/75 border border-white/60 dark:border-white/10 shadow-2xl flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200"
      >
        {/* 1. Settings Shortcut (Geometric clean concentric knob icon ◎) */}
        <button
          onClick={onOpenSettings}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/[0.08] dark:hover:bg-white/[0.12] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:scale-105 active:scale-95 cursor-pointer text-slate-600 dark:text-slate-300"
          title="系统与本地工作区设置"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
            <circle cx="8" cy="8" r="6" />
            <circle cx="8" cy="8" r="2" fill="currentColor" />
          </svg>
        </button>

        {/* 2. Weather Micro-Widget (Geometric clean outline) */}
        <div
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/[0.1] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 cursor-pointer text-slate-600 dark:text-slate-300"
          title="广州 · 21°C 大部晴朗"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
            <circle cx="6" cy="9" r="4" />
            <path d="M6 2v2M2 6h2M9 6h2M3.5 3.5l1.5 1.5M10 10a4 4 0 0 1 4 4H8" />
          </svg>
          <span className="text-[10.5px] font-medium font-sans">21°C</span>
        </div>

        {/* Subtle Hairline Divider */}
        <div className="h-4 w-px bg-black/10 dark:bg-white/15 mx-0.5"></div>

        {/* 3. Windows Start / App Launcher */}
        <div className="relative" ref={startMenuRef}>
          <button
            onClick={() => setShowStartMenu(!showStartMenu)}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/[0.08] dark:hover:bg-white/[0.12] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:scale-105 active:scale-95 cursor-pointer text-slate-800 dark:text-slate-100"
            title="开始菜单"
          >
            {/* Minimalist geometric 4-square Windows icon */}
            <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
              <rect x="1" y="1" width="5.5" height="5.5" rx="0.5" />
              <rect x="7.5" y="1" width="5.5" height="5.5" rx="0.5" />
              <rect x="1" y="7.5" width="5.5" height="5.5" rx="0.5" />
              <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="0.5" />
            </svg>
          </button>

          {/* Start Menu Flyout */}
          {showStartMenu && (
            <div className="absolute bottom-11 left-0 -translate-x-1/4 w-76 glass-panel rounded-xl p-3 z-50 shadow-2xl flex flex-col gap-2.5 text-slate-800 dark:text-slate-100 border border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2 bg-black/[0.04] dark:bg-white/[0.06] rounded-lg px-2.5 py-1 text-slate-400">
                <Search className="w-3.5 h-3.5 stroke-[1.4]" />
                <input
                  type="text"
                  placeholder="搜索设计方案与工具..."
                  className="bg-transparent border-none outline-none text-xs w-full placeholder-slate-400 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-400 mb-1.5">快捷入口</div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                  <div
                    onClick={() => {
                      onRestoreWindow();
                      setShowStartMenu(false);
                    }}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-md bg-black dark:bg-white flex items-center justify-center text-white dark:text-black shadow-2xs">
                      <AppLogo size={15} />
                    </div>
                    <span>盼盼工作台</span>
                  </div>
                  <div
                    onClick={() => {
                      onOpenSettings();
                      setShowStartMenu(false);
                    }}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-md bg-slate-700 flex items-center justify-center text-white shadow-2xs">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                        <circle cx="8" cy="8" r="6" />
                        <circle cx="8" cy="8" r="2" fill="currentColor" />
                      </svg>
                    </div>
                    <span>首选项</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer">
                    <div className="w-7 h-7 rounded-md bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 flex items-center justify-center shadow-2xs">
                      <Folder className="w-3.5 h-3.5 stroke-[1.4]" />
                    </div>
                    <span>本地目录</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Active 盼盼工作台 App Icon with Running Dot (Using AppLogo) */}
        <div
          onClick={onToggleWindow}
          className={`relative w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:scale-105 active:scale-95 cursor-pointer ${
            !isWindowMinimized
              ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
              : 'hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-600 dark:text-slate-300'
          }`}
          title="盼盼工作台 (已运行)"
        >
          <AppLogo size={15} />
          <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-black dark:bg-white"></div>
        </div>

        {/* Subtle Hairline Divider */}
        <div className="h-4 w-px bg-black/10 dark:bg-white/15 mx-0.5"></div>

        {/* 5. System Tray & Clock with clean geometric icons */}
        <div className="flex items-center gap-1.5 pl-0.5 text-slate-600 dark:text-slate-300 text-[11px]">
          {/* Chevron Tray */}
          <span className="p-0.5 hover:text-slate-900 dark:hover:text-white cursor-pointer" title="托盘管理">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M2 6.5L5 3.5L8 6.5" />
            </svg>
          </span>

          {/* Wifi */}
          <span className="p-0.5 hover:text-slate-900 dark:hover:text-white cursor-pointer" title="网络正常">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path d="M1 3.5C3.8 1.2 8.2 1.2 11 3.5" />
              <path d="M3 6C4.8 4.4 7.2 4.4 9 6" />
              <circle cx="6" cy="9" r="1" fill="currentColor" />
            </svg>
          </span>

          {/* Volume */}
          <span className="p-0.5 hover:text-slate-900 dark:hover:text-white cursor-pointer" title="扬声器: 100%">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
              <polygon points="1.5,4.5 4,4.5 7,2 7,10 4,7.5 1.5,7.5" fill="currentColor" />
              <path d="M9 4a3 3 0 0 1 0 4" />
            </svg>
          </span>

          {/* Clock */}
          <div
            ref={calendarRef}
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex flex-col items-end px-1.5 py-0.5 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/[0.1] cursor-pointer leading-tight transition"
            title={`${dateStr} ${timeStr}`}
          >
            <span className="font-mono text-[11px] font-medium tracking-tight">{timeStr || '12:00'}</span>
            <span className="font-mono text-[9px] text-slate-400 dark:text-slate-400 scale-95 origin-right">
              {dateStr || '2026/11/3'}
            </span>
          </div>
        </div>
      </nav>
    </div>
  );
};
