import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../types'
import type { TaskRecord } from '../types'
import { filterStudioTasks } from './studioGrid'

function task(overrides: Partial<TaskRecord>): TaskRecord {
  return {
    id: 'task',
    prompt: '',
    params: { ...DEFAULT_PARAMS },
    inputImageIds: [],
    outputImages: [],
    status: 'done',
    error: null,
    createdAt: 1,
    finishedAt: 2,
    elapsed: 1000,
    ...overrides,
  }
}

describe('studioGrid', () => {
  const tasks = [
    task({ id: 'a', prompt: '红色商铺', apiModel: 'gpt-image-2.5', status: 'done', isFavorite: true }),
    task({ id: 'b', prompt: '蓝色海报', apiModel: 'flux', status: 'error' }),
    task({ id: 'c', prompt: '红色海报', status: 'running' }),
  ]

  it('filters by prompt and model text', () => {
    expect(filterStudioTasks(tasks, { query: '红色' }).map((item) => item.id)).toEqual(['a', 'c'])
    expect(filterStudioTasks(tasks, { query: 'gpt-image' }).map((item) => item.id)).toEqual(['a'])
  })

  it('filters by status and favorite', () => {
    expect(filterStudioTasks(tasks, { status: 'error' }).map((item) => item.id)).toEqual(['b'])
    expect(filterStudioTasks(tasks, { favoriteOnly: true }).map((item) => item.id)).toEqual(['a'])
  })

  it('combines filters', () => {
    expect(filterStudioTasks(tasks, { query: '红色', status: 'running', favoriteOnly: false }).map((item) => item.id)).toEqual(['c'])
  })
})
