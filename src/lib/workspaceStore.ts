import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ProjectCanvas, ViewportTransform, WorkspaceState } from '../types'
import { isTauri } from './platform'
import { tauriStorage } from './tauriStorage'
import { createDefaultWorkspace, getPersistedWorkspace, normalizeWorkspace } from './workspaceState'

interface WorkspaceActions {
  setActiveProject: (projectId: string) => void
  setActiveCanvas: (canvasId: string) => void
  createProject: (name?: string) => { projectId: string; canvasId: string }
  renameProject: (projectId: string, name: string) => void
  removeProject: (projectId: string) => void
  createCanvas: (projectId: string, name?: string) => string
  duplicateCanvas: (canvasId: string) => string | null
  renameCanvas: (canvasId: string, name: string) => void
  removeCanvas: (canvasId: string) => void
  updateCanvas: (canvasId: string, patch: Partial<Omit<ProjectCanvas, 'id' | 'projectId' | 'createdAt'>>) => void
  setCanvasViewport: (canvasId: string, viewport: ViewportTransform) => void
  setViewMode: (viewMode: WorkspaceState['viewMode']) => void
  setInputDockPosition: (position: WorkspaceState['inputDockPosition']) => void
  resetWorkspace: () => void
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions

const initial = createDefaultWorkspace()
let persistComposer = true

/** 由设置同步；关闭“重启保留输入”后，后续写入不再包含任何 composer 快照 */
export function setWorkspaceComposerPersistence(enabled: boolean) {
  if (persistComposer === enabled) return
  persistComposer = enabled
  // 立即重写一次，清掉存储中已有的 composer 快照
  useWorkspaceStore.setState({ version: 1 })
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      ...initial,
      setActiveProject: (activeProjectId) => set((state) => {
        const canvas = state.canvases.find((item) => item.projectId === activeProjectId)
        return canvas ? { activeProjectId, activeCanvasId: canvas.id } : {}
      }),
      setActiveCanvas: (activeCanvasId) => set((state) => {
        const canvas = state.canvases.find((item) => item.id === activeCanvasId)
        return canvas ? { activeCanvasId, activeProjectId: canvas.projectId } : {}
      }),
      createProject: (name) => {
        const state = get()
        const now = Date.now()
        const projectId = crypto.randomUUID()
        const canvasId = crypto.randomUUID()
        const order = state.projects.length
        set({
          projects: [...state.projects, { id: projectId, name: name?.trim() || `项目 ${order + 1}`, createdAt: now, updatedAt: now }],
          canvases: [...state.canvases, { id: canvasId, projectId, name: '画布 1', order: 0, createdAt: now, updatedAt: now }],
          activeProjectId: projectId,
          activeCanvasId: canvasId,
        })
        return { projectId, canvasId }
      },
      renameProject: (projectId, name) => set((state) => ({
        projects: state.projects.map((project) => project.id === projectId
          ? { ...project, name: name.trim() || project.name, updatedAt: Date.now() }
          : project),
      })),
      removeProject: (projectId) => set((state) => {
        if (!state.projects.some((project) => project.id === projectId)) return {}
        const projects = state.projects.filter((project) => project.id !== projectId)
        const canvases = state.canvases.filter((canvas) => canvas.projectId !== projectId)
        const activeProjectId = state.activeProjectId === projectId
          ? canvases[0]?.projectId ?? projects[0]?.id ?? ''
          : state.activeProjectId
        const activeCanvasId = state.activeProjectId === projectId
          ? canvases.find((canvas) => canvas.projectId === activeProjectId)?.id ?? canvases[0]?.id ?? ''
          : state.activeCanvasId
        return { projects, canvases, activeProjectId, activeCanvasId }
      }),
      createCanvas: (projectId, name) => {
        const state = get()
        const now = Date.now()
        const canvasId = crypto.randomUUID()
        const order = Math.max(-1, ...state.canvases.filter((canvas) => canvas.projectId === projectId).map((canvas) => canvas.order)) + 1
        set({
          canvases: [...state.canvases, { id: canvasId, projectId, name: name?.trim() || `画布 ${order + 1}`, order, createdAt: now, updatedAt: now }],
          activeProjectId: projectId,
          activeCanvasId: canvasId,
        })
        return canvasId
      },
      duplicateCanvas: (canvasId) => {
        const state = get()
        const source = state.canvases.find((canvas) => canvas.id === canvasId)
        if (!source) return null
        const now = Date.now()
        const id = crypto.randomUUID()
        const order = Math.max(-1, ...state.canvases.filter((canvas) => canvas.projectId === source.projectId).map((canvas) => canvas.order)) + 1
        const copy = {
          ...source,
          id,
          name: `${source.name} 副本`,
          order,
          createdAt: now,
          updatedAt: now,
          imageNodes: (source.imageNodes ?? []).map((node) => ({ ...node, id: crypto.randomUUID() })),
        }
        set({
          canvases: [...state.canvases, copy],
          activeProjectId: source.projectId,
          activeCanvasId: id,
        })
        return id
      },
      renameCanvas: (canvasId, name) => set((state) => ({
        canvases: state.canvases.map((canvas) => canvas.id === canvasId
          ? { ...canvas, name: name.trim() || canvas.name, updatedAt: Date.now() }
          : canvas),
      })),
      removeCanvas: (canvasId) => set((state) => {
        const target = state.canvases.find((canvas) => canvas.id === canvasId)
        if (!target) return {}
        const canvases = state.canvases.filter((canvas) => canvas.id !== canvasId)
        if (state.activeCanvasId !== canvasId) return { canvases }
        // 删除当前画布后切相邻画布：优先右邻，其次左邻，最后才考虑其他项目
        const siblings = state.canvases
          .filter((canvas) => canvas.projectId === target.projectId)
          .sort((a, b) => a.order - b.order)
        const index = siblings.findIndex((canvas) => canvas.id === canvasId)
        const next = siblings[index + 1] ?? siblings[index - 1] ?? canvases.find((canvas) => canvas.projectId !== target.projectId)
        const projectStillExists = state.projects.some((project) => project.id === target.projectId)
        return {
          canvases,
          activeCanvasId: next?.id ?? '',
          activeProjectId: next?.projectId ?? (projectStillExists ? target.projectId : state.activeProjectId),
        }
      }),
      updateCanvas: (canvasId, patch) => set((state) => ({
        canvases: state.canvases.map((canvas) => canvas.id === canvasId
          ? { ...canvas, ...patch, updatedAt: Date.now() }
          : canvas),
      })),
      setCanvasViewport: (canvasId, viewport) => set((state) => ({
        canvases: state.canvases.map((canvas) => canvas.id === canvasId
          ? { ...canvas, viewport, updatedAt: Date.now() }
          : canvas),
      })),
      setViewMode: (viewMode) => set({ viewMode }),
      setInputDockPosition: (inputDockPosition) => set({ inputDockPosition }),
      resetWorkspace: () => set(createDefaultWorkspace()),
    }),
    {
      name: 'panpan-workspace-v1',
      storage: createJSONStorage(() => isTauri ? tauriStorage : window.localStorage),
      version: 1,
      partialize: (state) => getPersistedWorkspace(state, persistComposer),
      merge: (persisted, current) => ({ ...current, ...normalizeWorkspace(persisted) }),
    },
  ),
)
