import { useEffect, useState } from 'react'
import { isTouchDevice } from '../lib/platform'

export type LayoutTier = 'phone' | 'tablet' | 'desktop'

export interface ViewportLayout {
  width: number
  height: number
  /** 按实时窗口宽度划分：phone (<680px，含手机与安卓平板窄分屏) / tablet (680-1079px，含 iPad 竖屏、折叠屏与 50% 分屏) / desktop (≥1080px，含桌面端与安卓宽屏平板横屏) */
  tier: LayoutTier
  isPhone: boolean
  isTablet: boolean
  isDesktop: boolean
  /** 软键盘是否弹起（仅触控设备上依据 visualViewport 差值判定） */
  keyboardOpen: boolean
  /** 软键盘在视口底部占据的高度（px） */
  keyboardInset: number
}

export function classifyLayoutTier(width: number): LayoutTier {
  if (width < 680) return 'phone'
  if (width < 1080) return 'tablet'
  return 'desktop'
}

function readViewportLayout(): ViewportLayout {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      height: 820,
      tier: 'desktop',
      isPhone: false,
      isTablet: false,
      isDesktop: true,
      keyboardOpen: false,
      keyboardInset: 0,
    }
  }
  const vv = window.visualViewport
  const width = Math.round(vv?.width ?? window.innerWidth)
  const layoutHeight = window.innerHeight
  const visibleHeight = Math.round(vv?.height ?? layoutHeight)
  const offsetTop = Math.round(vv?.offsetTop ?? 0)
  const rawInset = Math.max(0, Math.round(layoutHeight - visibleHeight - offsetTop))
  const keyboardOpen = isTouchDevice && rawInset > 120
  const keyboardInset = keyboardOpen ? rawInset : 0
  const tier = classifyLayoutTier(width)
  return {
    width,
    height: visibleHeight,
    tier,
    isPhone: tier === 'phone',
    isTablet: tier === 'tablet',
    isDesktop: tier === 'desktop',
    keyboardOpen,
    keyboardInset,
  }
}

export function useViewportLayout(): ViewportLayout {
  const [layout, setLayout] = useState<ViewportLayout>(() => readViewportLayout())

  useEffect(() => {
    const sync = () => {
      const next = readViewportLayout()
      setLayout((prev) => (
        prev.width === next.width
        && prev.height === next.height
        && prev.tier === next.tier
        && prev.keyboardOpen === next.keyboardOpen
        && prev.keyboardInset === next.keyboardInset
          ? prev
          : next
      ))
    }
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    const vv = window.visualViewport
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    sync()
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
    }
  }, [])

  return layout
}
