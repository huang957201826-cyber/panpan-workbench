import { useState } from 'react'
import { useStore } from '../../store'
import { useIsDarkMode } from '../../hooks/useColorMode'
import { installSettingsStorageBridge } from '../adapters/settings'
import { SettingsModal } from '../modules/settings/SettingsModal'

interface SettingsPrototypeHostProps {
  open: boolean
  onClose: () => void
}

const WHEEL_ZOOM_KEY = 'panpan-wheel-zoom-direct'

/** 设置页宿主：负责把正式设置接到原型组件，并在挂载前装好存储桥接 */
export function SettingsPrototypeHost({ open, onClose }: SettingsPrototypeHostProps) {
  // 预览组件首次渲染就会读 localStorage，桥接要先于子组件挂载装好
  installSettingsStorageBridge()
  const showToast = useStore((state) => state.showToast)
  const setSettings = useStore((state) => state.setSettings)
  const tabRequest = useStore((state) => state.settingsTabRequest)
  const initialTab = tabRequest === 'skill' ? 'general' : tabRequest ?? undefined
  const isDark = useIsDarkMode()
  const [wheelZoomDirect, setWheelZoomDirect] = useState(() => {
    try {
      return localStorage.getItem(WHEEL_ZOOM_KEY) !== '0'
    } catch {
      return true
    }
  })

  return (
    <SettingsModal
      isOpen={open}
      onClose={onClose}
      initialTab={initialTab}
      wheelZoomDirect={wheelZoomDirect}
      onToggleWheelZoomDirect={(value) => {
        setWheelZoomDirect(value)
        try {
          localStorage.setItem(WHEEL_ZOOM_KEY, value ? '1' : '0')
        } catch {
          // 预览偏好写失败不阻塞
        }
      }}
      isDark={isDark}
      onToggleTheme={() => setSettings({ colorMode: isDark ? 'light' : 'dark' })}
      onShowToast={(message) => showToast(message, 'info')}
    />
  )
}
