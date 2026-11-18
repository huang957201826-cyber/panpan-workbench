import { test, expect, type Page } from '@playwright/test'

const WORKSPACE = {
  version: 1,
  projects: [{ id: 'default-project', name: '默认项目', createdAt: 1, updatedAt: 1 }],
  canvases: [
    { id: 'default-canvas', projectId: 'default-project', name: '画布 1', order: 0, createdAt: 1, updatedAt: 1 },
  ],
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

test('设置：五个页签可切换，通用页不再有技能设置', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })

  await page.getByLabel('设置').click()
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()

  await expect(page.getByText('已保存的 API 配置')).toBeVisible()

  await page.getByText('通用', { exact: true }).first().click()
  await expect(page.getByText('AI 工具集成')).toBeVisible()
  await expect(page.getByText('技能设置', { exact: true })).toHaveCount(0)

  await page.getByText('外观', { exact: true }).first().click()
  await expect(page.getByText('颜色主题')).toBeVisible()

  await page.getByText('数据', { exact: true }).first().click()
  await expect(page.getByText('从 ZIP 恢复导入')).toBeVisible()

  await page.getByText('关于', { exact: true }).first().click()
  await expect(page.getByText('使用说明与常见问题')).toBeVisible()

  await page.getByRole('button', { name: '完成', exact: true }).click()
  await expect(page.getByRole('heading', { name: '设置' })).toHaveCount(0)
})
