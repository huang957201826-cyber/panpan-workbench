import type { TaskRecord } from '../types'

export interface StudioGridFilter {
  query?: string
  status?: 'all' | 'done' | 'error' | 'running'
  favoriteOnly?: boolean
  model?: string
}

export function filterStudioTasks(tasks: TaskRecord[], filter: StudioGridFilter) {
  const query = filter.query?.trim().toLowerCase() ?? ''
  return tasks.filter((task) => {
    if (query && !`${task.prompt} ${task.apiModel ?? ''}`.toLowerCase().includes(query)) return false
    if (filter.status && filter.status !== 'all' && task.status !== filter.status) return false
    if (filter.favoriteOnly && !task.isFavorite) return false
    if (filter.model && task.apiModel !== filter.model) return false
    return true
  })
}
