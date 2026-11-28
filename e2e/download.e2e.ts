import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

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

async function selectFormat(page: Page, format: string) {
  await page.locator('[data-input-bar] button').filter({ hasText: '更多' }).first().click()
  await page.getByRole('menuitem', { name: format, exact: true }).click()
}

test('GIF/SVG：API 仍生成 PNG，下载时本地转换且文件头正确', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await ensureMockProfile(page)

  await selectFormat(page, 'GIF')
  await expect(page.locator('[data-input-bar] button').filter({ hasText: '更多' }).first()).toContainText('GIF')
  await page.locator('[data-input-bar] textarea').fill('GIF 本地转换')
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()
  await expect(page.locator('[data-canvas-node]')).toHaveCount(1, { timeout: 20_000 })
  await expect(page.locator('[data-canvas-node] img').first()).toBeVisible({ timeout: 20_000 })

  const firstNode = page.locator('[data-canvas-node]').first()
  await firstNode.hover()
  const [gifFile] = await Promise.all([
    page.waitForEvent('download'),
    firstNode.locator('button[aria-label="下载原图"]').click(),
  ])
  expect(gifFile.suggestedFilename()).toMatch(/\.gif$/i)
  const gifPath = await gifFile.path()
  if (!gifPath) throw new Error('GIF 下载没有文件路径')
  expect((await readFile(gifPath)).subarray(0, 6).toString()).toBe('GIF89a')

  await selectFormat(page, 'SVG')
  await page.locator('[data-input-bar] textarea').fill('SVG 本地转换')
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()
  await expect(page.locator('[data-canvas-node]')).toHaveCount(2, { timeout: 20_000 })
  const secondNode = page.locator('[data-canvas-node]').nth(1)
  await expect(secondNode.locator('img').first()).toBeVisible({ timeout: 20_000 })
  await secondNode.hover()
  const [svgFile] = await Promise.all([
    page.waitForEvent('download'),
    secondNode.locator('button[aria-label="下载原图"]').click(),
  ])
  expect(svgFile.suggestedFilename()).toMatch(/\.svg$/i)
  const svgPath = await svgFile.path()
  if (!svgPath) throw new Error('SVG 下载没有文件路径')
  expect((await readFile(svgPath)).subarray(0, 5).toString()).toBe('<?xml')
})

test('R4：卡片 1024=3 列、1440=4/收起=5 列封顶，卡片约旧 3 列的 80%', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('tab', { name: '卡片' }).click()

  const metrics = () => page.locator('[data-card-grid]').evaluate((el) => {
    const tracks = getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).map((value) => parseFloat(value))
    return { columns: tracks.length, cardWidth: tracks[0] ?? 0, gridWidth: el.clientWidth }
  })

  await page.setViewportSize({ width: 1024, height: 768 })
  await page.waitForTimeout(300)
  expect((await metrics()).columns).toBe(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: 'docs/execution/evidence/r4-card-1024.png' })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(300)
  const expanded = await metrics()
  expect(expanded.columns).toBe(4)
  const legacyThreeColumnWidth = (expanded.gridWidth - 24) / 3
  expect(expanded.cardWidth / legacyThreeColumnWidth).toBeGreaterThan(0.7)
  expect(expanded.cardWidth / legacyThreeColumnWidth).toBeLessThan(0.85)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: 'docs/execution/evidence/r4-card-1440.png' })

  await page.getByRole('button', { name: '收起方案侧栏' }).click()
  await page.waitForTimeout(400)
  const collapsed = await metrics()
  expect(collapsed.columns).toBe(5)
  expect(collapsed.columns).toBeLessThanOrEqual(5)
  expect(collapsed.cardWidth).toBeLessThan(expanded.cardWidth)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: 'docs/execution/evidence/r4-card-1440-collapsed.png' })
})

test('卡片右上角下载：画布节点与卡片都能下载', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await ensureMockProfile(page)

  await page.locator('[data-input-bar] textarea').fill('下载回归')
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()
  const node = page.locator('[data-canvas-node]').first()
  await expect(node).toBeVisible({ timeout: 20_000 })
  await expect(node.locator('img').first()).toBeVisible({ timeout: 20_000 })

  await node.hover()
  const nodeDownload = page.locator('[data-canvas-node] button[aria-label="下载原图"]').first()
  await expect(nodeDownload).toBeVisible()
  const [nodeFile] = await Promise.all([page.waitForEvent('download'), nodeDownload.click()])
  expect(await nodeFile.failure()).toBeNull()
  expect(nodeFile.suggestedFilename()).toMatch(/\.(png|jpg|webp)$/i)

  await page.getByRole('tab', { name: '卡片' }).click()
  const cardDownload = page.locator('button[title="下载高清原图"]').first()
  await expect(cardDownload).toBeVisible({ timeout: 10_000 })
  const cardOverlay = cardDownload.locator('..')
  await expect(cardOverlay).toHaveCSS('opacity', '0')
  const resolution = page.locator('[data-card-resolution]').first()
  await expect(resolution).toHaveCSS('opacity', '0')
  await page.getByText('下载回归', { exact: true }).first().hover()
  await expect(cardOverlay).toHaveCSS('opacity', '1')
  await expect(resolution).toHaveCSS('opacity', '1')
  const [cardFile] = await Promise.all([page.waitForEvent('download'), cardDownload.click()])
  expect(await cardFile.failure()).toBeNull()
  expect(cardFile.suggestedFilename()).toMatch(/\.(png|jpg|webp)$/i)
  await expect(page.getByText(/下载成功/)).toBeVisible()

  // 手机竖屏（390x844）下检验卡片视图排版：顶部栏不遮挡、2 列网格、徽章与操作栏不重叠、底部文字单行省略
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(350)
  const mobileGridMetrics = await page.locator('[data-card-grid]').evaluate((el) => {
    const tracks = getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).map((v) => parseFloat(v))
    return { columns: tracks.length, cardWidth: tracks[0] ?? 0 }
  })
  expect(mobileGridMetrics.columns).toBe(2)
  expect(mobileGridMetrics.cardWidth).toBeGreaterThan(150)

  const headerBtnBox = await page.getByRole('button', { name: '打开项目抽屉' }).boundingBox()
  const studioToolbarBox = await page.locator('[data-studio-header]').boundingBox()
  expect(headerBtnBox).not.toBeNull()
  expect(studioToolbarBox).not.toBeNull()
  expect(studioToolbarBox!.y).toBeGreaterThanOrEqual(headerBtnBox!.y + headerBtnBox!.height)

  const sortBtnBox = await page.getByRole('button', { name: /最新优先|排序/ }).boundingBox()
  const favBtnBox = await page.getByRole('button', { name: '只看收藏' }).boundingBox()
  expect(sortBtnBox).not.toBeNull()
  expect(favBtnBox).not.toBeNull()
  expect(sortBtnBox!.x + sortBtnBox!.width).toBeLessThanOrEqual(favBtnBox!.x + 1)

  const metaLineHeight = await page.locator('[data-card-grid] .font-mono.truncate').first().evaluate((el) => el.clientHeight)
  expect(metaLineHeight).toBeLessThanOrEqual(24)

  await page.screenshot({ path: 'docs/execution/evidence/verify-mobile-card-grid.png' })

  await page.getByRole('button', { name: '画布', exact: true }).first().click()
  await expect(page.locator('[data-canvas-root]')).toBeVisible()
})
