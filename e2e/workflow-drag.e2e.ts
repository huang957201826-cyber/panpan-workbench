import { test, expect, type Page } from '@playwright/test'

const WORKSPACE = {
  version: 1,
  projects: [{ id: 'default-project', name: '默认项目', createdAt: 1, updatedAt: 1 }],
  canvases: [{ id: 'default-canvas', projectId: 'default-project', name: '画布 1', order: 0, createdAt: 1, updatedAt: 1 }],
  activeProjectId: 'default-project',
  activeCanvasId: 'default-canvas',
  viewMode: 'canvas',
  inputDockPosition: 'bottom',
}

async function seedWorkspace(page: Page) {
  await page.addInitScript((workspace) => {
    localStorage.setItem('panpan-workspace-v1', JSON.stringify({ state: workspace, version: 1 }))
    localStorage.setItem('panpan-view-mode', 'canvas')
    localStorage.setItem('panpan-start-activity', 'projects')
    localStorage.setItem('color-mode', 'light')
    localStorage.setItem('panpan-canvas-use-hint', '1')
  }, WORKSPACE)
}

test('S4：工作流节点拖动按帧跟手并在松手后保存落点', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: '工作流' }).click()
  const node = page.locator('[data-node-id]').first()
  await expect(node).toBeVisible({ timeout: 30_000 })
  const beforeLeft = Number.parseFloat(await node.evaluate((el) => (el as HTMLElement).style.left))
  const header = node.locator('div').first()
  const box = await header.boundingBox()
  if (!box) throw new Error('工作流节点没有布局')

  await page.mouse.move(box.x + box.width / 2, box.y + 12)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + 32, { steps: 4 })
  await expect(node).toHaveClass(/transition-none/)
  const previewTransform = await node.evaluate((el) => (el as HTMLElement).style.transform)
  expect(previewTransform).toContain('translate3d')
  await page.mouse.move(box.x + box.width / 2 + 140, box.y + 52, { steps: 4 })
  await page.mouse.up()
  await expect(node).not.toHaveClass(/transition-none/)
  await expect.poll(async () => Number.parseFloat(await node.evaluate((el) => (el as HTMLElement).style.left))).toBeGreaterThan(beforeLeft + 100)
})
