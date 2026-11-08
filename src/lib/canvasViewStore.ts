import { create } from 'zustand'
import type { ViewportTransform } from '../types'

export type GalleryViewMode = 'canvas' | 'grid'

const VIEW_MODE_KEY = 'panpan-view-mode'
const VIEWPORT_KEY = 'panpan-canvas-viewport'
const DEFAULT_VIEWPORT: ViewportTransform = { x: 80, y: 80, k: 1 }

function readViewMode(): GalleryViewMode {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === 'grid' ? 'grid' : 'canvas'
  } catch {
    return 'canvas'
  }
}

function readViewport(): ViewportTransform {
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY)
    if (!raw) return DEFAULT_VIEWPORT
    const parsed = JSON.parse(raw) as Partial<ViewportTransform>
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number' || typeof parsed.k !== 'number') return DEFAULT_VIEWPORT
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y) || !Number.isFinite(parsed.k) || parsed.k <= 0) return DEFAULT_VIEWPORT
    return { x: parsed.x, y: parsed.y, k: parsed.k }
  } catch {
    return DEFAULT_VIEWPORT
  }
}

interface CanvasViewState {
  viewMode: GalleryViewMode
  setViewMode: (mode: GalleryViewMode) => void
  viewport: ViewportTransform
  setViewport: (viewport: ViewportTransform) => void
  size: { width: number; height: number }
  setSize: (size: { width: number; height: number }) => void
  bottomInset: number
  setBottomInset: (value: number) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export const useCanvasViewStore = create<CanvasViewState>((set) => ({  viewMode: readViewMode(),
  setViewMode: (viewMode) => {
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode)
    } catch {
      // localStorage 不可用时只影响本机记忆，不影响当前会话
    }
    set({ viewMode })
  },
  viewport: readViewport(),
  setViewport: (viewport) => {
    set({ viewport })
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(VIEWPORT_KEY, JSON.stringify(viewport))
      } catch {
        // 忽略
      }
    }, 300)
  },
  size: { width: 0, height: 0 },
  setSize: (size) => set({ size }),
  bottomInset: 0,
  setBottomInset: (bottomInset) => set({ bottomInset }),
}))

export function hasSavedViewport() {
  try {
    return Boolean(localStorage.getItem(VIEWPORT_KEY))
  } catch {
    return false
  }
}
