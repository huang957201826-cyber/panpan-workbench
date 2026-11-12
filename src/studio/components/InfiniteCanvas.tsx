import React, { useState, useRef, useEffect } from 'react';
import {
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  Star,
  Edit3,
} from 'lucide-react';
import type { Artboard } from '../types.ts';
import { ImageDetailModal } from './ImageDetailModal.tsx';

interface InfiniteCanvasProps {
  artboards: Artboard[];
  onUpdateArtboard: (updated: Artboard) => void;
  onRegenerateArtboard: (artboard: Artboard) => void;
  isGenerating: boolean;
  selectedArtboardId: string | null;
  onSelectArtboard: (id: string | null) => void;
  focusArtboardId?: string | null;
  onClearFocus?: () => void;
  wheelZoomDirect?: boolean;
  onSetAsReference?: (artboard: Artboard) => void;
  onRecallPrompt?: (artboard: Artboard) => void;
  onDeleteArtboard?: (id: string) => void;
  onToggleStar?: (id: string) => void;
  viewMode?: 'canvas' | 'grid';
  onSelectViewMode?: (mode: 'canvas' | 'grid') => void;
  isRightDockOpen?: boolean;
}

export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
  artboards,
  onUpdateArtboard,
  onRegenerateArtboard,
  isGenerating,
  selectedArtboardId,
  onSelectArtboard,
  focusArtboardId,
  onClearFocus,
  wheelZoomDirect = true,
  onSetAsReference,
  onRecallPrompt,
  onDeleteArtboard,
  onToggleStar,
  viewMode = 'canvas',
  onSelectViewMode,
  isRightDockOpen = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  // Viewport transforms: pan and scale
  const [scale, setScale] = useState(0.95);
  const [pan, setPan] = useState({ x: 50, y: 35 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPanPos, setStartPanPos] = useState({ x: 0, y: 0 });

  // Tick state to cleanly trigger repaints during smooth 60fps drag
  const [, setDragTick] = useState(0);

  // Dragging artboard tracking (with 3px distance threshold to prevent click-drag jitter)
  const [draggingArtboardId, setDraggingArtboardId] = useState<string | null>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    artboardX: number;
    artboardY: number;
    artboardId: string;
    hasDragged: boolean;
  } | null>(null);

  // Double-clicked artboard for detailed generation inspection
  const [inspectArtboard, setInspectArtboard] = useState<Artboard | null>(null);

  // Track spacebar for pan
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Keyboard shortcuts: Space (Pan), Escape (Deselect), Delete/Backspace (Remove), F (Focus)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
      if (isInput) return;

      if (e.code === 'Space') {
        setIsSpacePressed(true);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedArtboardId && onDeleteArtboard) {
          onDeleteArtboard(selectedArtboardId);
        }
      } else if (e.key === 'Escape') {
        onSelectArtboard(null);
      } else if ((e.key === 'f' || e.key === 'F') && selectedArtboardId) {
        // Explicit focus shortcut on selected artboard
        const target = artboards.find((a) => a.id === selectedArtboardId);
        if (target && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setPan({
            x: Math.round(rect.width / 2 - (target.x + target.width / 2) * scale),
            y: Math.round(rect.height / 2 - (target.y + target.height / 2) * scale),
          });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedArtboardId, onDeleteArtboard, onSelectArtboard, artboards, scale]);

  // EXPLICIT FOCUS ONLY: Center viewport strictly when focusArtboardId is triggered (e.g. from "定位" button)
  // Selecting/clicking an artboard directly NEVER displaces the canvas!
  useEffect(() => {
    if (!focusArtboardId || !containerRef.current) return;
    const target = artboards.find((a) => a.id === focusArtboardId);
    if (!target) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const targetCenterX = target.x + target.width / 2;
    const targetCenterY = target.y + target.height / 2;

    setPan({
      x: Math.round(centerX - targetCenterX * scale),
      y: Math.round(centerY - targetCenterY * scale),
    });

    if (onClearFocus) {
      onClearFocus();
    }
  }, [focusArtboardId, artboards, scale, onClearFocus]);

  // Mouse move handler
  const handleMouseMove = (e: React.MouseEvent) => {
    if (glowRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      glowRef.current.style.setProperty('--mx', `${mx}px`);
      glowRef.current.style.setProperty('--my', `${my}px`);
    }

    if (isPanning) {
      setPan({
        x: pan.x + (e.clientX - startPanPos.x),
        y: pan.y + (e.clientY - startPanPos.y),
      });
      setStartPanPos({ x: e.clientX, y: e.clientY });
    } else if (draggingArtboardId && dragStartRef.current) {
      const start = dragStartRef.current;
      const deltaScreenX = e.clientX - start.clientX;
      const deltaScreenY = e.clientY - start.clientY;

      // 3px drag distance threshold: prevent clicks with tiny mouse jitter from false drags
      if (!start.hasDragged && Math.hypot(deltaScreenX, deltaScreenY) > 3) {
        start.hasDragged = true;
      }

      if (start.hasDragged) {
        const currentArtboard = artboards.find((a) => a.id === draggingArtboardId);
        if (currentArtboard && !currentArtboard.isLocked) {
          currentArtboard.x = Math.round(start.artboardX + deltaScreenX / scale);
          currentArtboard.y = Math.round(start.artboardY + deltaScreenY / scale);
          // Trigger canvas re-render
          setDragTick((prev) => prev + 1);
        }
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click or Space + Left click drag to pan freely
    if (e.button === 1 || isSpacePressed) {
      setIsPanning(true);
      setStartPanPos({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);

    // If an artboard was actually dragged, sync final coordinates to parent state cleanly
    if (draggingArtboardId && dragStartRef.current?.hasDragged) {
      const currentArtboard = artboards.find((a) => a.id === draggingArtboardId);
      if (currentArtboard) {
        onUpdateArtboard({
          ...currentArtboard,
          x: currentArtboard.x,
          y: currentArtboard.y,
        });
      }
    }

    setDraggingArtboardId(null);
    dragStartRef.current = null;
  };

  // Cursor-anchored zoom algorithm (anchored strictly to mouse pointer)
  const zoomAtPoint = (clientX: number, clientY: number, factor: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const nextScale = Math.min(3.0, Math.max(0.2, scale * factor));
    if (Math.abs(nextScale - scale) < 0.001) return;

    // Anchor formula: keep the canvas coordinate under mouse pointer stationary
    const ratio = nextScale / scale;
    const newPanX = mouseX - (mouseX - pan.x) * ratio;
    const newPanY = mouseY - (mouseY - pan.y) * ratio;

    setScale(nextScale);
    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
  };

  const handleCenterZoom = (factor: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  };

  // Wheel interaction: Zoom strictly anchored to mouse cursor
  const handleWheel = (e: React.WheelEvent) => {
    if (wheelZoomDirect) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * 0.006);
        zoomAtPoint(e.clientX, e.clientY, factor);
      } else if (e.shiftKey) {
        setPan((prev) => ({ x: prev.x - e.deltaY, y: prev.y }));
      } else {
        // Direct wheel zoom anchored to mouse cursor
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        zoomAtPoint(e.clientX, e.clientY, factor);
      }
    } else {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        zoomAtPoint(e.clientX, e.clientY, factor);
      } else if (e.shiftKey) {
        setPan((prev) => ({ x: prev.x - e.deltaY, y: prev.y }));
      } else {
        setPan((prev) => ({ x: prev.x, y: prev.y - e.deltaY }));
      }
    }
  };

  return (
    <main
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onClick={() => onSelectArtboard(null)}
      className={`relative flex-1 h-full w-full overflow-hidden bg-[#fafbfe] dark:bg-[#0e1017] transition-colors select-none ${
        isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
    >
      {/* 1. Subtle Stitch Dot Canvas Grid */}
      <div className="absolute inset-0 stitch-dot-canvas opacity-60 dark:opacity-40" />

      {/* 2. Pointer Spotlight Highlight */}
      <div
        ref={glowRef}
        className="stitch-dot-highlight absolute inset-0 pointer-events-none opacity-40 dark:opacity-25"
      />

      {/* 3. Scalable & Pannable Spatial World Layer */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
        className="absolute inset-0 transition-transform duration-75 will-change-transform"
      >
        {/* Real-time Generating Placeholder Shimmer Node */}
        {isGenerating && (
          <div
            style={{
              left: `${80 + (artboards.length % 3) * 40}px`,
              top: `${40 + (artboards.length % 3) * 40}px`,
              width: '680px',
              height: '400px',
            }}
            className="absolute rounded-2xl overflow-hidden bg-white/70 dark:bg-[#161822]/70 border border-black/30 dark:border-white/30 shadow-2xl flex flex-col justify-between p-6 animate-pulse z-20 backdrop-blur-md"
          >
            <div className="flex items-center justify-between text-body-sm text-slate-500 font-mono">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-black dark:bg-white animate-ping"></span>
                <span>正在执行扩散去噪采样...</span>
              </span>
              <span>85%</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-black/20 border-t-black dark:border-white/20 dark:border-t-white animate-spin"></div>
              <div className="text-body font-medium text-slate-800 dark:text-slate-100">
                正在生成高分辨率方案...
              </div>
              <div className="text-body-sm text-slate-400 font-mono">
                显存占用 8.6 GB · 预计剩余 1.2s
              </div>
            </div>
            <div className="w-full bg-black/[0.08] dark:bg-white/[0.1] h-1.5 rounded-full overflow-hidden">
              <div className="bg-black dark:bg-white h-full w-2/3 rounded-full"></div>
            </div>
          </div>
        )}

        {/* Artboards: Pure Image Rendering + Selection Ring + Corner Handles + Floating Quick Toolbar */}
        {artboards.map((artboard) => {
          const isSelected = selectedArtboardId === artboard.id;
          const isDragging = draggingArtboardId === artboard.id;
          // Boundary safe toolbar position: if too close to top (y < 48), flip below image
          const isNearTopEdge = artboard.y < 48;

          return (
            <div
              key={artboard.id}
              onClick={(e) => {
                e.stopPropagation();
                // Select only if we didn't just perform a drag operation
                if (!dragStartRef.current?.hasDragged) {
                  onSelectArtboard(artboard.id);
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setInspectArtboard(artboard);
              }}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                // Select immediately without moving the viewport
                onSelectArtboard(artboard.id);

                if (!artboard.isLocked) {
                  dragStartRef.current = {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    artboardX: artboard.x,
                    artboardY: artboard.y,
                    artboardId: artboard.id,
                    hasDragged: false,
                  };
                  setDraggingArtboardId(artboard.id);
                }
              }}
              style={{
                left: `${artboard.x}px`,
                top: `${artboard.y}px`,
                width: `${artboard.width}px`,
              }}
              className={`absolute select-none group ${
                isDragging ? 'cursor-grabbing z-30' : 'cursor-pointer z-10'
              } ${isSelected ? 'z-20' : ''}`}
              title="单击选中 · 按住拖拽 · 双击展开生图资料"
            >
              {/* Quick Action Floating Bar (Matching image_d7000416.png, stable with zero vertical jitter) */}
              {isSelected && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    top: isNearTopEdge ? `${artboard.height + 10}px` : '-42px',
                  }}
                  className="absolute left-0 right-0 flex items-center justify-between pointer-events-auto z-40 select-none"
                >
                  {/* Left Badges: </> Task Name, ✦ Model */}
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/95 dark:bg-[#161822]/95 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-md text-body-sm font-mono text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1 font-sans">
                      <span className="text-caption text-slate-400 font-mono">&lt;/&gt;</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                        {artboard.title.includes('·')
                          ? artboard.title.split('·')[0].trim()
                          : artboard.taskId || artboard.title}
                      </span>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="flex items-center gap-1 text-caption text-slate-500">
                      <span className="text-amber-500 text-caption">✦</span>
                      <span>{artboard.model || 'gpt-image-2.5'}</span>
                    </span>
                  </div>

                  {/* Right Quick Actions: ☆ Star, ↰ Reuse, ✍ Edit, 🗑 Delete */}
                  <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg bg-white/95 dark:bg-[#161822]/95 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-md text-slate-600 dark:text-slate-300">
                    {/* ☆ Star */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleStar) onToggleStar(artboard.id);
                      }}
                      className={`w-6 h-6 rounded-md flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer ${
                        artboard.isStarred
                          ? 'text-amber-500'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                      }`}
                      title={artboard.isStarred ? '取消收藏' : '收藏'}
                    >
                      <Star
                        className={`w-3.5 h-3.5 stroke-[1.6] ${
                          artboard.isStarred ? 'fill-amber-400 text-amber-500' : ''
                        }`}
                      />
                    </button>

                    {/* ↰ Reuse Config */}
                    {onRecallPrompt && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRecallPrompt(artboard);
                        }}
                        className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
                        title="复用此图全部配置"
                      >
                        <RotateCcw className="w-3.5 h-3.5 stroke-[1.6]" />
                      </button>
                    )}

                    {/* ✍ Edit Output (Opens Detail Modal) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectArtboard(artboard);
                      }}
                      className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer"
                      title="编辑输出 (查看/调整详情)"
                    >
                      <Edit3 className="w-3.5 h-3.5 stroke-[1.6]" />
                    </button>

                    {/* 🗑 Delete */}
                    {onDeleteArtboard && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteArtboard(artboard.id);
                        }}
                        className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500 transition cursor-pointer"
                        title="删除此任务图片 (Delete / Backspace)"
                      >
                        <Trash2 className="w-3.5 h-3.5 stroke-[1.5]" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Main Artwork Frame: Clean ring styling without transition-all to eliminate subpixel flicker */}
              <div
                className={`relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-slate-100 dark:bg-black/50 shadow-md ${
                  isSelected
                    ? 'ring-2 ring-blue-500 dark:ring-blue-400 shadow-[0_0_0_1px_rgba(59,130,246,0.5),0_14px_40px_rgba(0,0,0,0.2)]'
                    : 'hover:ring-1 hover:ring-black/20 dark:hover:ring-white/25'
                }`}
              >
                <img
                  alt={artboard.title}
                  className="w-full h-full object-cover pointer-events-none"
                  src={artboard.imageUrl}
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* 4 Corner Selection Anchors / Handles */}
              {isSelected && (
                <>
                  <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-[2px] z-30 pointer-events-none shadow-xs" />
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-[2px] z-30 pointer-events-none shadow-xs" />
                  <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-[2px] z-30 pointer-events-none shadow-xs" />
                  <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-[2px] z-30 pointer-events-none shadow-xs" />
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Unified Bottom-Right Contextual Floating Capsule: View Switcher + Zoom Controls */}
      <div
        className={`absolute bottom-3 ${
          isRightDockOpen ? 'right-4 md:right-5' : 'right-3'
        } z-30 pointer-events-auto flex items-center gap-2 transition-all duration-200`}
      >
        {/* View Switcher: [ ⊞ 无限画布 | ▦ 卡片视图 ] */}
        {onSelectViewMode && (
          <div className="h-[28px] p-0.5 rounded-full bg-white/95 dark:bg-[#161822]/95 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.08] shadow-sm flex items-center gap-0.5 text-body-sm">
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
              title="切换至卡片视图"
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
              <span>卡片</span>
            </button>
          </div>
        )}

        {/* Zoom Capsule: [ - 100% + | ⤢ 居中 ] */}
        <div className="h-[28px] px-1.5 rounded-full bg-white/95 dark:bg-[#161822]/95 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.08] shadow-sm flex items-center gap-1 text-body-sm font-mono text-slate-600 dark:text-slate-300">
          <button
            onClick={() => handleCenterZoom(0.88)}
            className="w-5 h-5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition cursor-pointer"
            title="缩小"
          >
            <Minus className="w-3 h-3" />
          </button>

          <span
            onClick={() => {
              setScale(1);
              setPan({ x: 50, y: 35 });
            }}
            className="px-1.5 cursor-pointer hover:text-slate-900 dark:hover:text-white min-w-[36px] text-center font-medium"
            title="还原 100%"
          >
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={() => handleCenterZoom(1.14)}
            className="w-5 h-5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition cursor-pointer"
            title="放大"
          >
            <Plus className="w-3 h-3" />
          </button>

          <div className="w-px h-3 bg-black/10 dark:bg-white/10 mx-0.5"></div>

          {/* Reset position & fit to view */}
          <button
            onClick={() => {
              setScale(0.95);
              setPan({ x: 50, y: 35 });
            }}
            className="w-5 h-5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition cursor-pointer text-slate-500 hover:text-slate-900 dark:hover:text-white"
            title="自适应居中"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path d="M1.5 5V1.5H5M9 1.5H12.5V5M12.5 9V12.5H9M5 12.5H1.5V9" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* 5. Generation Details Inspector Modal ("双击展开生图资料", Matching image_7e5123d4.png) */}
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
    </main>
  );
};
