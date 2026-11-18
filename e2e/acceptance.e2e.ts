import { test, expect, type Page } from '@playwright/test'

/** 视觉验收：C1 缩放后保留生成中虚化、C5 新任务节点不重叠、N14 底部栏不横向裁切。 */

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

async function useMockProfile(page: Page, stream = false, mode = 'b64') {
  await page.evaluate(({ stream, mode }) => {
    const raw = localStorage.getItem('gpt-image-playground')
    if (!raw) throw new Error('设置尚未持久化')
    const data = JSON.parse(raw)
    const state = data.state
    const profile = {
      id: 'e2e-mock',
      name: 'E2E Mock',
      provider: 'openai',
      baseUrl: `http://127.0.0.1:8787/${mode}/v1`,
      apiKey: 'test',
      model: 'gpt-image-2.5',
      selectedModel: 'gpt-image-2.5',
      timeout: 60,
      apiMode: 'images',
      codexCli: false,
      apiProxy: false,
      responseFormatB64Json: true,
      streamImages: stream,
      streamPartialImages: stream ? 2 : 0,
      transparentBackgroundMethod: 'api',
    }
    state.settings.profiles = [profile]
    state.settings.activeProfileId = profile.id
    state.settings.baseUrl = profile.baseUrl
    state.settings.apiKey = profile.apiKey
    state.settings.model = profile.model
    state.settings.apiMode = profile.apiMode
    localStorage.setItem('gpt-image-playground', JSON.stringify(data))
  }, { stream, mode })
}

async function openWithMock(page: Page, stream = false, mode = 'b64') {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await useMockProfile(page, stream, mode)
    await page.waitForTimeout(300)
    await page.reload()
    await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
    const applied = await page.evaluate(() => {
      const raw = localStorage.getItem('gpt-image-playground')
      if (!raw) return false
      const data = JSON.parse(raw)
      const settings = data.state?.settings
      const active = settings?.profiles?.find((profile: { id: string }) => profile.id === settings.activeProfileId)
      return typeof active?.baseUrl === 'string' && active.baseUrl.includes('127.0.0.1:8787')
    })
    if (applied) return
  }
  throw new Error('mock API profile 未生效')
}

test('C5：连续生成两个任务，新节点不重叠', async ({ page }) => {
  await openWithMock(page)

  for (const prompt of ['C5 验收任务 A', 'C5 验收任务 B']) {
    await page.locator('[data-input-bar] textarea').fill(prompt)
    await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()
    await page.waitForTimeout(600)
    await expect(page.locator('[data-canvas-node]').last().locator('img').first()).toBeVisible({ timeout: 20_000 })
  }

  const nodes = page.locator('[data-canvas-node]')
  await expect(nodes).toHaveCount(2)
  const first = await nodes.nth(0).boundingBox()
  const second = await nodes.nth(1).boundingBox()
  if (!first || !second) throw new Error('任务节点没有布局')

  const overlapX = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x)
  const overlapY = Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y)
  expect(overlapX <= 0 || overlapY <= 0).toBe(true)

  await page.getByRole('button', { name: '适应全部 (Ctrl+0)' }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'docs/execution/evidence/c5-two-nodes.png' })
})

test('C1：缩放到低倍后生成中虚化仍在', async ({ page }) => {
  await openWithMock(page, true, 'stream-hold')

  await page.locator('[data-input-bar] input[type=file]').setInputFiles('docs/execution/evidence/b04a-workflow.png')
  await expect(page.locator('[data-input-bar] button[title^="移除该参考图"]').first()).toBeVisible()
  await page.locator('[data-input-bar] textarea').fill('C1 缩放虚化验收')
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()

  const node = page.locator('[data-canvas-node]').first()
  await expect(node).toBeVisible({ timeout: 20_000 })
  const thumb = node.locator('img').first()
  await expect(thumb).toBeVisible({ timeout: 15_000 })
  await expect(thumb).toHaveClass(/blur-md/)
  await page.screenshot({ path: 'docs/execution/evidence/c1-running-100.png' })

  for (let i = 0; i < 5; i += 1) {
    await page.getByRole('button', { name: '缩小画布' }).click()
    await page.waitForTimeout(120)
  }

  const compactNode = page.locator('[data-canvas-node]').first()
  await expect(compactNode).toBeVisible()
  await expect(compactNode.locator('img').first()).toHaveClass(/blur-md/)
  await expect(compactNode.getByText('生成中').first()).toBeVisible()
  await page.screenshot({ path: 'docs/execution/evidence/c1-running-zoomed.png' })

  for (let i = 0; i < 4; i += 1) {
    await page.getByRole('button', { name: '缩小画布' }).click()
    await page.waitForTimeout(120)
  }
  await page.screenshot({ path: 'docs/execution/evidence/c1-running-lowzoom.png' })
})

test('N14：窄窗口下底部参数栏不横向裁切', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 760 })
  await openWithMock(page)

  const overflow = await page.locator('[data-input-bar]').evaluate((root) => {
    const paramsRow = root.querySelector('[data-params-row]') ?? root
    return {
      scrollWidth: paramsRow.scrollWidth,
      clientWidth: paramsRow.clientWidth,
    }
  })
  expect(overflow.scrollWidth - overflow.clientWidth).toBeLessThanOrEqual(1)
  await page.screenshot({ path: 'docs/execution/evidence/n14-bottom-bar-1024.png' })

  await page.getByRole('button', { name: '技能库' }).click()
  await expect(page.getByPlaceholder('搜索技能标题或指令词...')).toBeVisible()
  await page.screenshot({ path: 'docs/execution/evidence/n14-skill-library.png' })
})
