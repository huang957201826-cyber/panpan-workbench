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

test('S0：点工作流进画布，点技能库进技能库', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: '技能库' }).click()
  await expect(page.getByPlaceholder('搜索技能标题或指令词...')).toBeVisible()

  await page.getByRole('button', { name: '工作流' }).click()
  await expect(page.getByText('本地引擎').first()).toBeVisible()
  await expect(page.getByText('无损放大').first()).toBeVisible()
  await expect(page.getByPlaceholder('搜索技能标题或指令词...')).toHaveCount(0)

  await page.getByRole('button', { name: '技能库' }).click()
  await expect(page.getByPlaceholder('搜索技能标题或指令词...')).toBeVisible()
})

test('迁移：工作流四条流程与真实节点可见', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: '工作流' }).click()
  await expect(page.getByText('本地引擎').first()).toBeVisible()
  for (const label of ['无损放大', '抠图', '局部重绘', '截图转效果图']) {
    await expect(page.locator('[data-workflow-rail]').getByRole('button', { name: label })).toBeVisible()
  }

  await expect(page.getByRole('button', { name: '运行电池组' })).toBeVisible()
  await expect(page.getByText('K采样器').first()).toBeVisible()
  await expect(page.getByText('放大模型')).toBeVisible()
  await expect(page.getByText('保存图像')).toBeVisible()
})

test('迁移：技能库 27 条纯文配方，详情可应用', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: '技能库' }).click()
  await expect(page.getByPlaceholder('搜索技能标题或指令词...')).toBeVisible()
  await expect(page.getByText(/27 条内置/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /空间与场地/ })).toBeVisible()

  await page.getByText('商业空间摄影').first().click()
  await expect(page.getByRole('button', { name: '替换', exact: true }).last()).toBeVisible()
  await expect(page.getByRole('button', { name: '复制全文' })).toBeVisible()
})

test('迁移：设置五栏可切换，关闭即保存', async ({ page }) => {
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
  await page.getByRole('button', { name: '完成', exact: true }).click()
  await expect(page.getByRole('heading', { name: '设置' })).toHaveCount(0)
})
