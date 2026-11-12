import { useStore } from '../../store'
import { useCanvasViewStore } from '../../lib/canvasViewStore'
import { SettingsIcon } from '../icons'
import CanvasBoard from '../CanvasBoard'
import CanvasSidebar from './CanvasSidebar'

function CanvasTopBar() {
  const viewMode = useCanvasViewStore((s) => s.viewMode)
  const setViewMode = useCanvasViewStore((s) => s.setViewMode)
  const setShowSettings = useStore((s) => s.setShowSettings)

  return (
    <header className="shrink-0 border-b border-[#2c2c2c] bg-[#161616] pt-[var(--safe-area-top)]">
      <div className="flex h-12 items-center justify-between px-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-gray-100 text-body-sm font-black text-gray-900">盼</div>
          <span className="truncate text-body font-semibold text-gray-100">盼盼工作台</span>
          <span className="hidden truncate text-body-sm text-gray-500 sm:inline">未命名项目</span>
        </div>

        <div className="hidden items-center gap-2 rounded-md bg-[#252525] px-3 py-1 text-body-sm text-gray-300 sm:flex">
          页面 1 <span className="text-gray-600">＋</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-md border border-[#343434] bg-[#222] p-0.5 text-caption">
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={`rounded px-2 py-1 transition-colors ${viewMode === 'canvas' ? 'bg-[#3a3a3a] text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              画布
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`rounded px-2 py-1 transition-colors ${viewMode === 'grid' ? 'bg-[#3a3a3a] text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              网格
            </button>
          </div>
          <button
            type="button"
            aria-label="设置"
            onClick={() => setShowSettings(true)}
            className="grid h-7 w-7 place-items-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

function CanvasDock() {
  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-[#3a3a3a] bg-[#242424]/95 p-1 text-body-sm text-gray-400 shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={() => document.getElementById('panpan-prompt')?.focus()}
        className="rounded-md px-3 py-1.5 hover:bg-white/10 hover:text-gray-200"
      >
        图像生成
      </button>
    </div>
  )
}

export default function CanvasWorkbench() {
  return (
    <div className="fixed inset-0 z-0 flex flex-col bg-[#1b1b1b] text-gray-100">
      <CanvasTopBar />
      <div className="flex min-h-0 flex-1">
        <CanvasSidebar />
        <div className="relative min-w-0 flex-1">
          <CanvasBoard />
          <CanvasDock />
        </div>
      </div>
    </div>
  )
}
