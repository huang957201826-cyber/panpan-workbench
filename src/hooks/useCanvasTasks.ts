import { useMemo } from 'react'
import { useVisibleTasks } from './usePrivacyMode'
import { isFavoritesCanvas } from '../lib/favorites'

/**
 * 当前画布的任务：隐私模式过滤 + 画布过滤；旧 Agent 任务也按画布显示。
 * 收藏画布是跨项目汇总视图，取所有打了星标的任务，而不是按 canvasId 过滤
 */
export function useCanvasTasks(canvasId: string) {
  const tasks = useVisibleTasks()
  return useMemo(
    () => (isFavoritesCanvas(canvasId) ? tasks.filter((task) => task.isFavorite) : tasks.filter((task) => task.canvasId === canvasId)),
    [tasks, canvasId],
  )
}
