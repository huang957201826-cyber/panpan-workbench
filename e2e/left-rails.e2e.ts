import { test, expect, type Page } from '@playwright/test'

const WORKSPACE = {
  version: 1,
  projects: [
    { id: 'default-project', name: '默认项目', createdAt: 1, updatedAt: 1 },
    { id: 'p2', name: '商业空间改造', createdAt: 2, updatedAt: 2 },
  ],
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

test('D-08：三处左栏宽度 240，收藏行 36，工作流与技能左栏可折叠', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })

  const projectRail = page.locator('[data-project-rail]')
  await expect(projectRail).toBeVisible()
  expect((await projectRail.boundingBox())?.width).toBe(240)
  const projectTitleSize = await projectRail.getByRole('heading', { name: '项目', exact: true }).evaluate((el) => getComputedStyle(el).fontSize)
  const favoriteRow = projectRail.getByText('收藏', { exact: true }).locator('xpath=ancestor::div[contains(@class,"group")]').first()
  expect((await favoriteRow.boundingBox())?.height).toBe(36)

  await page.getByRole('button', { name: '工作流' }).click()
  const workflowRail = page.locator('[data-workflow-rail]')
  await expect(workflowRail).toBeVisible()
  expect((await workflowRail.boundingBox())?.width).toBe(240)
  const workflowTitleSize = await workflowRail.getByRole('heading', { name: '工作流', exact: true }).evaluate((el) => getComputedStyle(el).fontSize)
  const workflowRow = workflowRail.getByRole('button', { name: '无损放大' }).first()
  expect((await workflowRow.boundingBox())?.height).toBe(36)
  await workflowRail.getByRole('button', { name: '收起左栏' }).click()
  await expect.poll(async () => (await workflowRail.boundingBox())?.width).toBe(48)
  await workflowRail.getByRole('button', { name: '展开左栏' }).click()
  await expect.poll(async () => (await workflowRail.boundingBox())?.width).toBe(240)

  await page.getByRole('button', { name: '技能库' }).click()
  const skillRail = page.locator('[data-skill-rail]')
  await expect(skillRail).toBeVisible()
  expect((await skillRail.boundingBox())?.width).toBe(240)
  const skillTitleSize = await skillRail.getByRole('heading', { name: '技能库', exact: true }).evaluate((el) => getComputedStyle(el).fontSize)
  const skillRow = skillRail.getByRole('button', { name: /全部技能/ }).first()
  expect((await skillRow.boundingBox())?.height).toBe(36)
  expect(new Set([projectTitleSize, workflowTitleSize, skillTitleSize]).size).toBe(1)
  await skillRail.getByRole('button', { name: '收起左栏' }).click()
  await expect.poll(async () => (await skillRail.boundingBox())?.width).toBe(48)
  await skillRail.getByRole('button', { name: '展开左栏' }).click()
  await expect.poll(async () => (await skillRail.boundingBox())?.width).toBe(240)
})
