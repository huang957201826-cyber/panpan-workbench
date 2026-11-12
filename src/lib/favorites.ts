import type { Project, ProjectCanvas } from '../types'

/** 内置“收藏”项目的固定 ID：跨项目汇总所有打了星标的任务，不可删除、不可改名 */
export const FAVORITES_PROJECT_ID = '__favorites__'
export const FAVORITES_CANVAS_ID = '__favorites__:all'
export const FAVORITES_PROJECT_NAME = '收藏'
export const FAVORITES_CANVAS_NAME = '全部收藏'

export function isFavoritesProject(id?: string | null) {
  return id === FAVORITES_PROJECT_ID
}

export function isFavoritesCanvas(id?: string | null) {
  return id === FAVORITES_CANVAS_ID
}

/**
 * 收藏项目与其唯一画布是**运行期派生**的内置视图：不写进持久化的 projects/canvases，
 * 这样用户数据里不会多出一条“删不掉的项目”，也不会影响导入导出与既有归一化规则。
 */
export function createFavoritesEntries(now = 0): { project: Project; canvas: ProjectCanvas } {
  return {
    project: { id: FAVORITES_PROJECT_ID, name: FAVORITES_PROJECT_NAME, createdAt: now, updatedAt: now },
    canvas: {
      id: FAVORITES_CANVAS_ID,
      projectId: FAVORITES_PROJECT_ID,
      name: FAVORITES_CANVAS_NAME,
      order: -1,
      createdAt: now,
      updatedAt: now,
    },
  }
}
