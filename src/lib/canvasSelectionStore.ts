import { create } from 'zustand'

interface CanvasSelectionState {
  /** 画布节点 id；与任务 id 分开，不混用 */
  selectedNodeIds: Set<string>
  /** 九宫格素材 imageId */
  selectedAssetImageIds: Set<string>
  /** 每次统一清空递增，图片菜单据此关闭 */
  selectionClearNonce: number
  setSelectedNodeIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  setSelectedAssetImageIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  clearCanvasSelection: () => void
}

export const useCanvasSelectionStore = create<CanvasSelectionState>((set) => ({
  selectedNodeIds: new Set(),
  selectedAssetImageIds: new Set(),
  selectionClearNonce: 0,
  setSelectedNodeIds: (ids) => set((state) => {
    const next = typeof ids === 'function' ? ids(state.selectedNodeIds) : ids
    return next === state.selectedNodeIds ? state : { selectedNodeIds: next }
  }),
  setSelectedAssetImageIds: (ids) => set((state) => {
    const next = typeof ids === 'function' ? ids(state.selectedAssetImageIds) : ids
    return next === state.selectedAssetImageIds ? state : { selectedAssetImageIds: next }
  }),
  clearCanvasSelection: () => set((state) => ({
    selectedNodeIds: new Set(),
    selectedAssetImageIds: new Set(),
    selectionClearNonce: state.selectionClearNonce + 1,
  })),
}))
