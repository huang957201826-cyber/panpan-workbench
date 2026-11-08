import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../types'
import type { TaskRecord } from '../types'
import { autoLayoutCanvasNodes, getCanvasInsertPosition, getCanvasNodeRects, getTaskNodeSize, nodeIdsInRect, resizeNodeFromCorner } from './canvasNodes'
import { fitNodesViewport, nodeInView } from './canvasMath'

function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
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

describe('canvasNodes', () => {
  it('uses the real image ratio', () => {
    expect(getTaskNodeSize(task({ outputImages: ['image'], params: { ...DEFAULT_PARAMS, size: '1536x1024' } }))).toEqual({ width: 360, height: 240 })
    expect(getTaskNodeSize(task({ outputImages: ['image'], params: { ...DEFAULT_PARAMS, size: '1024x1536' } }))).toEqual({ width: 360, height: 540 })
    expect(getTaskNodeSize(task({ outputImages: ['image'], params: { ...DEFAULT_PARAMS, size: 'auto' } }))).toEqual({ width: 360, height: 270 })
  })

  it('拖动只改坐标时不锁定比例，仍按真实图片重算', () => {
    const task1 = task({
      outputImages: ['image'],
      params: { ...DEFAULT_PARAMS, size: 'auto' },
      actualParams: { size: '1312x1199' },
      canvas: { x: 400, y: 200, w: 457.9, h: 228.9 },
    })
    const size = getTaskNodeSize(task1)
    expect(size.width).toBe(360)
    expect(size.height).toBeCloseTo(329, 1)
  })

  it('手动缩放过才保留自定义尺寸', () => {
    const task1 = task({
      outputImages: ['image'],
      actualParams: { size: '1312x1199' },
      canvas: { x: 400, y: 200, w: 457.9, h: 228.9, userSized: true },
    })
    expect(getTaskNodeSize(task1)).toEqual({ width: 457.9, height: 228.9 })
  })

  it('uses a compact card for tasks without any image', () => {
    expect(getTaskNodeSize(task({ status: 'error' }))).toEqual({ width: 280, height: 150 })
    expect(getTaskNodeSize(task({ status: 'running' }))).toEqual({ width: 280, height: 140 })
  })

  it('uses request ratio for running/error placeholders with a size', () => {
    expect(getTaskNodeSize(task({ status: 'running', params: { ...DEFAULT_PARAMS, size: '1280x720' } }))).toEqual({ width: 360, height: 202.5 })
    expect(getTaskNodeSize(task({ status: 'error', params: { ...DEFAULT_PARAMS, size: '720x1280' } }))).toEqual({ width: 360, height: 640 })
    expect(getTaskNodeSize(task({ status: 'running', params: { ...DEFAULT_PARAMS, size: '2560x1440' } }))).toEqual({ width: 360, height: 202.5 })
  })

  it('uses persisted size only when the user resized it', () => {
    expect(getTaskNodeSize(task({ canvas: { x: 0, y: 0, w: 500, h: 700, userSized: true } }))).toEqual({ width: 500, height: 700 })
  })

  it('lays out rows using each row max height', () => {
    const nodes = [
      { width: 360, height: 240 },
      { width: 360, height: 540 },
      { width: 360, height: 240 },
    ]
    const positions = autoLayoutCanvasNodes(nodes, 48)
    expect(positions).toEqual([
      { x: 0, y: 0 },
      { x: 408, y: 0 },
      { x: 0, y: 588 },
    ])
  })

  it('resizes from all four corners while keeping the opposite corner fixed', () => {
    const rect = { x: 100, y: 200, width: 360, height: 240 }
    expect(resizeNodeFromCorner(rect, 'se', 72, 1)).toEqual({ x: 100, y: 200, width: 432, height: 288 })
    expect(resizeNodeFromCorner(rect, 'nw', -72, 1)).toEqual({ x: 28, y: 152, width: 432, height: 288 })
    expect(resizeNodeFromCorner(rect, 'ne', 72, 1)).toEqual({ x: 100, y: 152, width: 432, height: 288 })
    expect(resizeNodeFromCorner(rect, 'sw', -72, 1)).toEqual({ x: 28, y: 200, width: 432, height: 288 })
  })

  it('clamps corner resize width to 160–720', () => {
    const rect = { x: 0, y: 0, width: 360, height: 240 }
    expect(resizeNodeFromCorner(rect, 'se', 10000, 1).width).toBe(720)
    expect(resizeNodeFromCorner(rect, 'se', -10000, 1).width).toBe(160)
    expect(resizeNodeFromCorner(rect, 'se', 72, 2).width).toBeCloseTo(396)
  })

  it('selects nodes intersecting the box rect', () => {
    const rects = [
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      { id: 'b', x: 200, y: 0, width: 100, height: 100 },
      { id: 'c', x: 0, y: 200, width: 100, height: 100 },
    ]
    expect(nodeIdsInRect(rects, { x: -10, y: -10, width: 150, height: 150 })).toEqual(['a'])
    expect(nodeIdsInRect(rects, { x: -10, y: -10, width: 400, height: 400 })).toEqual(['a', 'b', 'c'])
    expect(nodeIdsInRect(rects, { x: 150, y: 150, width: 10, height: 10 })).toEqual([])
  })

  it('keeps 1000 mixed-ratio nodes measurable at fit zoom', () => {
    const start = performance.now()
    const nodes = Array.from({ length: 1000 }, (_, index) => ({
      id: `node-${index}`,
      width: 360,
      height: index % 3 === 0 ? 240 : index % 3 === 1 ? 540 : 270,
    }))
    const positions = autoLayoutCanvasNodes(nodes, 48)
    const rects = nodes.map((node, index) => ({ ...node, x: positions[index].x, y: positions[index].y }))
    const viewport = fitNodesViewport(rects, { width: 1600, height: 900 }, 72)!
    const view = { x: -viewport.x / viewport.k, y: -viewport.y / viewport.k, width: 1600 / viewport.k, height: 900 / viewport.k }
    const visible = rects.filter((node) => nodeInView(node, view))
    const elapsed = performance.now() - start
    console.log(`[canvas p4 baseline] 1000 mixed nodes: layout+fit+cull ${elapsed.toFixed(1)}ms, k=${viewport.k}, visible=${visible.length}`)
    expect(positions).toHaveLength(1000)
    expect(visible).toHaveLength(1000)
    expect(viewport.k).toBeLessThan(0.15)
    expect(elapsed).toBeLessThan(1000)
  })

  it('keeps 3000 mixed-ratio nodes measurable at low zoom', () => {
    const start = performance.now()
    const nodes = Array.from({ length: 3000 }, (_, index) => ({
      id: `node-${index}`,
      width: 360,
      height: index % 3 === 0 ? 240 : index % 3 === 1 ? 540 : 270,
    }))
    const positions = autoLayoutCanvasNodes(nodes, 48)
    const rects = nodes.map((node, index) => ({ ...node, x: positions[index].x, y: positions[index].y }))
    const viewport = fitNodesViewport(rects, { width: 1600, height: 900 }, 72)!
    const view = { x: -viewport.x / viewport.k, y: -viewport.y / viewport.k, width: 1600 / viewport.k, height: 900 / viewport.k }
    const visible = rects.filter((node) => nodeInView(node, view))
    const elapsed = performance.now() - start
    console.log(`[canvas p4 baseline] 3000 mixed nodes: layout+fit+cull ${elapsed.toFixed(1)}ms, k=${viewport.k}, visible=${visible.length}`)
    expect(positions).toHaveLength(3000)
    expect(visible).toHaveLength(3000)
    expect(elapsed).toBeLessThan(1000)
  })

  it('inserts below the selected row with the same x', () => {
    const rects = [
      { id: 'a', x: 0, y: 0, width: 360, height: 280 },
      { id: 'b', x: 408, y: 40, width: 360, height: 240 },
      { id: 'c', x: 0, y: 368, width: 360, height: 280 },
    ]
    expect(getCanvasInsertPosition(rects, 'a')).toEqual({ x: 0, y: 328 })
    expect(getCanvasInsertPosition(rects, 'b')).toEqual({ x: 408, y: 328 })
  })

  it('inserts below the last row when nothing is selected', () => {
    const rects = [
      { id: 'a', x: 12, y: 0, width: 360, height: 280 },
      { id: 'b', x: 0, y: 400, width: 360, height: 280 },
      { id: 'c', x: 408, y: 400, width: 360, height: 240 },
    ]
    expect(getCanvasInsertPosition(rects)).toEqual({ x: 0, y: 728 })
  })

  it('builds node rects from persisted canvas positions first', () => {
    const rects = getCanvasNodeRects([
      task({ id: 'a', canvas: { x: 100, y: 200, w: 500, h: 300, userSized: true } }),
      task({ id: 'b', createdAt: 2 }),
    ])
    expect(rects[0]).toEqual({ id: 'a', x: 100, y: 200, width: 500, height: 300 })
    expect(rects[1].id).toBe('b')
  })
})
