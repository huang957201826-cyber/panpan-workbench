import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type TaskRecord } from '../types'
import { filterStudioTasks } from './studioGrid'
import { pickSelectedTasks, pruneTaskSelection } from './taskSelection'

function task(id: string, patch: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id,
    prompt: id,
    params: { ...DEFAULT_PARAMS },
    apiModel: 'gpt-image-2.5',
    inputImageIds: [],
    outputImages: [],
    status: 'done',
    error: null,
    createdAt: 1,
    finishedAt: 2,
    elapsed: 1,
    ...patch,
  }
}

describe('task selection', () => {
  const tasks = [
    task('a', { prompt: '梨 建筑', isFavorite: true }),
    task('b', { prompt: '苹果 室内', status: 'running' }),
    task('c', { prompt: '梨 夜景', status: 'error' }),
  ]

  it('drops hidden tasks from selection and batch operations', () => {
    const selected = new Set(['a', 'b', 'c'])

    const byQuery = filterStudioTasks(tasks, { query: '梨' })
    const afterQuery = pruneTaskSelection(selected, byQuery)
    expect([...afterQuery].sort()).toEqual(['a', 'c'])
    expect(pickSelectedTasks(byQuery, selected).map((item) => item.id).sort()).toEqual(['a', 'c'])

    const byStatus = filterStudioTasks(tasks, { status: 'running' })
    expect([...pruneTaskSelection(selected, byStatus)]).toEqual(['b'])

    const byFavorite = filterStudioTasks(tasks, { favoriteOnly: true })
    expect([...pruneTaskSelection(selected, byFavorite)]).toEqual(['a'])

    const byModel = filterStudioTasks(tasks, { model: 'gpt-image-2.5' })
    expect([...pruneTaskSelection(selected, byModel)]).toEqual(['a', 'b', 'c'])
  })

  it('keeps selection when all tasks stay visible', () => {
    const selected = new Set(['a', 'b'])
    expect(pruneTaskSelection(selected, filterStudioTasks(tasks, { status: 'all' }))).toEqual(selected)
  })
})
