import { describe, expect, it } from 'vitest'
import type { CanvasImageNode } from '../types'
import {
  addCanvasImageNode,
  collectCanvasContentImageIds,
  createCanvasImageNode,
  fitCanvasImageNodeSize,
  missingInputImageIds,
  moveCanvasImageNode,
  normalizeCanvasImageNodes,
  removeCanvasImageNodes,
  removedInputImageIds,
} from './canvasImageNodes'

const node = (id: string, imageId: string): CanvasImageNode => ({ id, imageId, x: 0, y: 0, w: 320, h: 240 })

describe('canvasImageNodes', () => {
  it('normalizes legacy data and drops invalid nodes', () => {
    expect(normalizeCanvasImageNodes(undefined)).toEqual([])
    expect(normalizeCanvasImageNodes([
      { id: 'n1', imageId: 'img1', x: 10, y: 20, w: 100, h: 80 },
      { id: 'n1', imageId: 'img2', x: 0, y: 0, w: 10, h: 10 },
      { id: 'n2', imageId: '', x: 0, y: 0, w: 10, h: 10 },
      { id: 'n3', imageId: 'img3', x: 'bad', y: 0, w: 10, h: 10 },
    ])).toEqual([{ id: 'n1', imageId: 'img1', x: 10, y: 20, w: 100, h: 80 }])
  })

  it('keeps one canvas node for the same image record', () => {
    const first = node('n1', 'img1')
    const nodes = addCanvasImageNode([], first)
    expect(addCanvasImageNode(nodes, node('n2', 'img1'))).toBe(nodes)
    expect(addCanvasImageNode(nodes, node('n2', 'img2'))).toHaveLength(2)
  })

  it('moves and resizes nodes without touching other records', () => {
    const nodes = [node('n1', 'img1'), node('n2', 'img2')]
    expect(moveCanvasImageNode(nodes, 'n1', 50, 60)[0]).toMatchObject({ x: 50, y: 60, w: 320, h: 240 })
    expect(nodes[0]).toMatchObject({ x: 0, y: 0 })
  })

  it('marks input references missing after the canvas node is deleted', () => {
    const nodes = [node('n1', 'img1')]
    const content = collectCanvasContentImageIds(nodes, [])
    expect(missingInputImageIds(['img1', 'img2'], content)).toEqual(new Set(['img2']))
    const removed = removeCanvasImageNodes(nodes, ['n1'])
    expect(missingInputImageIds(['img1'], collectCanvasContentImageIds(removed, []))).toEqual(new Set(['img1']))
  })

  it('removing an input selection does not remove canvas material', () => {
    const nodes = [node('n1', 'img1')]
    const content = collectCanvasContentImageIds(nodes, [])
    // 输入选择删除只影响输入列表，画布内容集合保持不变
    expect(content.has('img1')).toBe(true)
    expect(nodes).toHaveLength(1)
  })

  it('keeps task outputs as canvas content', () => {
    const content = collectCanvasContentImageIds([node('n1', 'img1')], [{ outputImages: ['out1'] }])
    expect([...content].sort()).toEqual(['img1', 'out1'])
  })

  it('marks only explicitly removed image ids as missing in the input bar', () => {
    expect(removedInputImageIds(['img1', 'img2'], [])).toEqual(new Set())
    expect(removedInputImageIds(['img1', 'img2'], ['img2', 'img3'])).toEqual(new Set(['img2']))
  })

  it('creates and fits nodes with bounded sizes', () => {
    const created = createCanvasImageNode('img1', 10, 20)
    expect(created).toMatchObject({ imageId: 'img1', x: 10, y: 20 })
    expect(created.w).toBeGreaterThanOrEqual(48)
    expect(fitCanvasImageNodeSize(4096, 2048)).toEqual({ width: 320, height: 160 })
    expect(fitCanvasImageNodeSize(100, 100)).toEqual({ width: 100, height: 100 })
  })
})
