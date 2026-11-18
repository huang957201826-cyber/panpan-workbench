import { test, expect, type Page } from '@playwright/test'

const TWO_PROJECTS = {
  version: 1,
  projects: [
    { id: 'project-a', name: '项目甲', createdAt: 1, updatedAt: 1 },
    { id: 'project-b', name: '项目乙', createdAt: 1, updatedAt: 1 },
  ],
  canvases: [
    { id: 'canvas-a', projectId: 'project-a', name: '画布甲', order: 0, createdAt: 1, updatedAt: 1 },
    { id: 'canvas-b', projectId: 'project-b', name: '画布乙', order: 0, createdAt: 1, updatedAt: 1 },
  ],
  activeProjectId: 'project-a',
  activeCanvasId: 'canvas-a',
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
  }, TWO_PROJECTS)
}

function projectPanel(page: Page) {
  return page.locator('[data-project-rail]')
}

test('侧栏搜索：只匹配项目名，不匹配画布名', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  const panel = projectPanel(page)
  await expect(panel.getByText('项目甲', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(panel.getByText('项目乙', { exact: true })).toBeVisible()

  await page.getByLabel('搜索项目').click()
  const input = page.getByLabel('搜索项目名')
  await input.fill('项目乙')
  await expect(panel.getByText('项目乙', { exact: true })).toBeVisible()
  await expect(panel.getByText('项目甲', { exact: true })).toHaveCount(0)

  await input.fill('画布乙')
  await expect(panel.getByText('项目甲', { exact: true })).toHaveCount(0)
  await expect(panel.getByText('项目乙', { exact: true })).toHaveCount(0)

  await input.fill('')
  await expect(panel.getByText('项目甲', { exact: true })).toBeVisible()
  await expect(panel.getByText('项目乙', { exact: true })).toBeVisible()
})

test('设置：五页签可切换，通用页无技能设置', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })

  await page.getByLabel('设置').click()
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()
  for (const label of ['API 配置', '通用', '外观', '数据', '关于']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
  }

  await page.getByText('通用', { exact: true }).first().click()
  await expect(page.getByText('AI 工具集成')).toBeVisible()
  await expect(page.getByText('技能设置', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '完成', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '完成', exact: true }).click()
  await expect(page.getByRole('heading', { name: '设置' })).toHaveCount(0)
})

test('项目删除：取消保留；确认后只剩一个项目', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  const panel = projectPanel(page)
  await expect(panel.getByText('项目乙', { exact: true })).toBeVisible({ timeout: 30_000 })

  await panel.getByText('项目乙', { exact: true }).click({ button: 'right' })
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await expect(page.getByText(/删除项目「项目乙」/)).toBeVisible()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(panel.getByText('项目甲', { exact: true })).toBeVisible()
  await expect(panel.getByText('项目乙', { exact: true })).toBeVisible()

  await panel.getByText('项目乙', { exact: true }).click({ button: 'right' })
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await page.getByRole('button', { name: '删除项目及其任务', exact: true }).click()
  await expect(panel.getByText('项目乙', { exact: true })).toHaveCount(0)
  await expect(panel.getByText('项目甲', { exact: true })).toBeVisible()
})
