import { useStore } from '../store'
import { useCanvasSelectionStore } from './canvasSelectionStore'

/** 统一清空任务选中、素材选中与图片菜单；切换画布/收藏/视图和空白点击共用 */
export function clearAllSelection() {
  useStore.getState().clearSelection()
  useCanvasSelectionStore.getState().clearCanvasSelection()
}
