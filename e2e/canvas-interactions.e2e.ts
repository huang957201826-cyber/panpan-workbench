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

async function useMockProfile(page: Page) {
  await page.evaluate(() => {
    const raw = localStorage.getItem('gpt-image-playground')
    if (!raw) throw new Error('设置尚未持久化')
    const data = JSON.parse(raw)
    const state = data.state
    const profile = {
      id: 'e2e-mock',
      name: 'E2E Mock',
      provider: 'openai',
      baseUrl: 'http://127.0.0.1:8787/b64/v1',
      apiKey: 'test',
      model: 'gpt-image-2.5',
      selectedModel: 'gpt-image-2.5',
      timeout: 60,
      apiMode: 'images',
      codexCli: false,
      apiProxy: false,
      responseFormatB64Json: true,
      transparentBackgroundMethod: 'api',
    }
    state.settings.profiles = [profile]
    state.settings.activeProfileId = profile.id
    state.settings.baseUrl = profile.baseUrl
    state.settings.apiKey = profile.apiKey
    state.settings.model = profile.model
    state.settings.apiMode = profile.apiMode
    localStorage.setItem('gpt-image-playground', JSON.stringify(data))
  })
}

async function ensureMockProfile(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await useMockProfile(page)
    await page.waitForTimeout(250)
    await page.reload()
    await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
    const pill = page.locator('[data-input-bar] button').filter({ hasText: /^gpt-image-2\.5$/ }).first()
    if (await pill.isVisible().catch(() => false)) return
  }
  throw new Error('mock API profile 未生效')
}

test('画布：生成任务后缩放、平移、拖动不跳动', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await ensureMockProfile(page)

  const prompt = page.locator('[data-input-bar] textarea')
  await prompt.fill('画布交互回归')
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()

  const node = page.locator('[data-canvas-node]').first()
  await expect(node).toBeVisible({ timeout: 20_000 })
  await expect(node.locator('img').first()).toBeVisible({ timeout: 20_000 })

  const beforeZoom = await node.boundingBox()
  if (!beforeZoom) throw new Error('节点没有布局')
  await page.locator('[data-canvas-root]').hover({ position: { x: 600, y: 260 } })
  await page.mouse.wheel(0, 500)
  await page.waitForTimeout(250)
  const zoomedOut = await node.boundingBox()
  if (!zoomedOut) throw new Error('缩小后节点消失')
  expect(zoomedOut.width).toBeLessThan(beforeZoom.width)

  await page.mouse.wheel(0, -500)
  await page.waitForTimeout(250)
  const afterZoom = await node.boundingBox()
  if (!afterZoom) throw new Error('放大后节点消失')
  expect(afterZoom.width).toBeGreaterThan(zoomedOut.width)

  const beforePan = await node.boundingBox()
  if (!beforePan) throw new Error('平移前节点消失')
  await page.keyboard.down('Space')
  await page.mouse.move(700, 260)
  await page.mouse.down()
  await page.mouse.move(760, 300, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Space')
  await page.waitForTimeout(200)
  const afterPan = await node.boundingBox()
  if (!afterPan) throw new Error('平移后节点消失')
  expect(Math.abs(afterPan.x - beforePan.x)).toBeGreaterThan(10)

  const beforeDrag = await node.boundingBox()
  if (!beforeDrag) throw new Error('拖动前节点消失')
  await page.mouse.move(beforeDrag.x + 40, beforeDrag.y + 20)
  await page.mouse.down()
  await page.mouse.move(beforeDrag.x + 140, beforeDrag.y + 100, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(350)
  const afterDrag = await node.boundingBox()
  if (!afterDrag) throw new Error('拖动后节点消失')
  expect(afterDrag.x).toBeGreaterThan(beforeDrag.x + 40)

  await page.waitForTimeout(600)
  const settled = await node.boundingBox()
  if (!settled) throw new Error('松手后节点消失')
  expect(Math.abs(settled.x - afterDrag.x)).toBeLessThan(2)
})
