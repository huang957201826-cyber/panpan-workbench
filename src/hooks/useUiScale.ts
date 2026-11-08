import { useEffect } from 'react'
import { useStore } from '../store'

/** 界面缩放只作用于 UI 外壳；画布世界坐标与节点尺寸不读取这个值。 */
export function useUiScale() {
  const scale = useStore((s) => s.settings.uiScale ?? 100)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.uiScale = String(scale)
    root.style.setProperty('--ui-scale', String(scale / 100))
    return () => {
      delete root.dataset.uiScale
      root.style.removeProperty('--ui-scale')
    }
  }, [scale])
}
