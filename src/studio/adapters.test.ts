import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../types'
import type { TaskRecord } from '../types'
import { assetAspectRatio, assetNodesToArtboards, getAspectRatio, getGenerationParams, taskToArtboard, tasksToArtboards, toTaskParams } from './adapters'
import type { CanvasImageNode } from '../types'

const task: TaskRecord = {
  id: 'task-1',
  prompt: '一只猫',
  params: { ...DEFAULT_PARAMS, size: '1536x1024', quality: 'high', n: 2, output_format: 'webp', transparent_output: true },
  inputImageIds: [],
  outputImages: ['image-1'],
  status: 'done',
  error: null,
  createdAt: 1700000000000,
  finishedAt: 1700000002000,
  elapsed: 2000,
  apiModel: 'gpt-image-2.5',
}

describe('studio adapters', () => {
  it('maps task params to Studio generation params and back', () => {
    const params = getGenerationParams(task.params, 'gpt-image-2.5')
    expect(params).toMatchObject({
      model: 'gpt-image-2.5',
      dimension: '1536x1024',
      quality: 'high',
      count: 2,
      format: 'WebP',
      transparent: true,
      filter: 'auto',
    })
    expect(params.compression).toBeNull()
    expect(toTaskParams(params)).toMatchObject({
      size: '1536x1024',
      quality: 'high',
      n: 2,
      output_format: 'webp',
      output_compression: null,
      transparent_output: true,
      moderation: 'auto',
    })
  })

  it('builds a real artboard from a task output', () => {
    const artboard = taskToArtboard(task, 'image-1', 'data:image/png;base64,x')
    expect(artboard).toMatchObject({
      id: 'task-1:image-1',
      imageUrl: 'data:image/png;base64,x',
      resolution: '1536×1024',
      aspectRatio: '3:2',
      model: 'gpt-image-2.5',
      taskId: 'task-1',
      imageId: 'image-1',
      renderTime: '2.0s',
    })
  })

  it('maps known sizes to ratios and falls back to square', () => {
    expect(getAspectRatio('1024x1024')).toBe('1:1')
    expect(getAspectRatio('1536x1024')).toBe('3:2')
    expect(getAspectRatio('1024x1536')).toBe('2:3')
    expect(getAspectRatio('1280x720')).toBe('16:9')
    expect(getAspectRatio('720x1280')).toBe('9:16')
    expect(getAspectRatio('2560x1440')).toBe('16:9')
    expect(getAspectRatio('auto')).toBe('1:1')
  })
})

describe('tasksToArtboards', () => {
  it('多图任务拆成多张卡，并带上真实序号', () => {
    const multi: TaskRecord = { ...task, outputImages: ['a', 'b'] }
    const cards = tasksToArtboards([multi])
    expect(cards).toHaveLength(2)
    expect(cards.map((card) => card.imageId)).toEqual(['a', 'b'])
    expect(cards.map((card) => card.imageIndex)).toEqual([0, 1])
  })

  it('单图任务不带序号，下载文件名不会多出 -1', () => {
    expect(tasksToArtboards([task])[0].imageIndex).toBeUndefined()
  })

  it('生成中的任务即使还没有图也占一格', () => {
    const running: TaskRecord = { ...task, status: 'running', outputImages: [], elapsed: null, finishedAt: null }
    const cards = tasksToArtboards([running])
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ status: 'running', imageId: '' })
  })

  it('失败任务带上错误信息，成功后不再显示占位', () => {
    const failed: TaskRecord = { ...task, status: 'error', outputImages: [], error: '额度不足' }
    expect(tasksToArtboards([failed])[0]).toMatchObject({ status: 'error', errorMessage: '额度不足' })
    const done: TaskRecord = { ...task, outputImages: [], status: 'done' }
    expect(tasksToArtboards([done])).toHaveLength(0)
  })
})

const assetNode = (id: string, imageId: string, w = 320, h = 180): CanvasImageNode => ({
  id, imageId, x: 0, y: 0, w, h,
})

describe('assetNodesToArtboards（参考图素材在九宫格可见）', () => {
  it('把画布素材节点映射成带「图N」编号的卡片，排成可读顺序', () => {
    const cards = assetNodesToArtboards([assetNode('n1', 'a'), assetNode('n2', 'b')], new Set())
    expect(cards).toHaveLength(2)
    expect(cards.map((card) => card.assetNumber)).toEqual([1, 2])
    expect(cards.map((card) => card.title)).toEqual(['素材 图1', '素材 图2'])
    expect(cards[0]).toMatchObject({ isAsset: true, imageId: 'a', status: 'done', aspectRatio: '16:9' })
    expect(cards[0].taskId).toBeUndefined()
  })

  it('产物被拖回画布当素材时不重复占一格，同一张图的重复节点也只出一张卡', () => {
    const nodes = [assetNode('n1', 'a'), assetNode('n2', 'a'), assetNode('n3', 'output-1')]
    const cards = assetNodesToArtboards(nodes, new Set(['output-1']))
    expect(cards.map((card) => card.imageId)).toEqual(['a'])
  })

  it('没有素材节点时返回空数组', () => {
    expect(assetNodesToArtboards([], new Set())).toEqual([])
  })

  it('比例按真实尺寸化简，非法尺寸回退 1:1', () => {
    expect(assetAspectRatio(400, 300)).toBe('4:3')
    expect(assetAspectRatio(0, 0)).toBe('1:1')
  })
})
