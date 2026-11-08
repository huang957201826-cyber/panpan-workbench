import { describe, expect, it } from 'vitest'
import { autoLayoutPositions, clampZoom, fitNodesViewport, nodeInView, screenToWorld, worldToScreen, zoomAtPoint } from './canvasMath'

describe('canvasMath', () => {
  it('屏幕坐标与世界坐标可逆', () => {
    const rect = { left: 100, top: 50 }
    const viewport = { x: 80, y: -40, k: 1.5 }
    const world = screenToWorld(500, 300, rect, viewport)
    const screen = worldToScreen(world.x, world.y, rect, viewport)
    expect(screen.x).toBeCloseTo(500)
    expect(screen.y).toBeCloseTo(300)
  })

  it('以鼠标为锚点缩放时，锚点下的世界坐标不变', () => {
    const viewport = { x: 40, y: 20, k: 1 }
    const anchor = { x: 300, y: 200 }
    const before = screenToWorld(anchor.x, anchor.y, { left: 0, top: 0 }, viewport)
    const next = zoomAtPoint(viewport, anchor.x, anchor.y, 1.8)
    const after = screenToWorld(anchor.x, anchor.y, { left: 0, top: 0 }, next)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
    expect(next.k).toBeCloseTo(1.8)
  })

  it('缩放下限和上限生效', () => {
    expect(clampZoom(0.001)).toBe(0.02)
    expect(clampZoom(10)).toBe(3)
    expect(zoomAtPoint({ x: 0, y: 0, k: 2.5 }, 100, 100, 10).k).toBe(3)
  })

  it('自动布局近似方形，而不是一条长竖列', () => {
    const positions = autoLayoutPositions(100, 320, 300, 48)
    expect(positions).toHaveLength(100)
    const columns = new Set(positions.map((item) => item.x)).size
    const rows = new Set(positions.map((item) => item.y)).size
    expect(columns).toBe(10)
    expect(rows).toBe(10)
  })

  it('fit view 把所有节点放进视口', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0, width: 320, height: 300 },
      { id: 'b', x: 1000, y: 800, width: 320, height: 300 },
    ]
    const viewport = fitNodesViewport(nodes, { width: 1200, height: 800 }, 72)!
    expect(viewport.k).toBeGreaterThan(0)
    expect(viewport.k).toBeLessThanOrEqual(3)
    for (const node of nodes) {
      const screen = worldToScreen(node.x, node.y, { left: 0, top: 0 }, viewport)
      expect(screen.x).toBeGreaterThanOrEqual(0)
      expect(screen.y).toBeGreaterThanOrEqual(0)
    }
  })

  it('视口相交判断', () => {
    const node = { id: 'a', x: 100, y: 100, width: 320, height: 300 }
    expect(nodeInView(node, { x: 0, y: 0, width: 500, height: 500 })).toBe(true)
    expect(nodeInView(node, { x: 500, y: 500, width: 100, height: 100 })).toBe(false)
  })

  it('3000 节点布局/fit/裁剪基线', () => {
    const start = performance.now()
    const positions = autoLayoutPositions(3000, 360, 280, 48)
    const nodes = positions.map((pos, index) => ({ id: `node-${index}`, x: pos.x, y: pos.y, width: 360, height: 280 }))
    const viewport = fitNodesViewport(nodes, { width: 1600, height: 900 }, 72)!
    const view = {
      x: -viewport.x / viewport.k,
      y: -viewport.y / viewport.k,
      width: 1600 / viewport.k,
      height: 900 / viewport.k,
    }
    const visible = nodes.filter((node) => nodeInView(node, view))
    const elapsed = performance.now() - start

    console.log(`[canvas baseline] 3000 nodes: layout+fit+cull ${elapsed.toFixed(1)}ms, k=${viewport.k}, visible=${visible.length}`)
    expect(positions).toHaveLength(3000)
    // fit 下限已放宽到 0.02，3000 节点可在低倍下全览
    expect(viewport.k).toBeCloseTo(0.042, 3)
    expect(visible.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(1000)
  })
})
