import { readFileSync } from 'node:fs'
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

test('导出：详情页可下载真正的 GIF 和 SVG 文件', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await useMockProfile(page)
    await page.waitForTimeout(250)
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
    if (applied) break
  }

  await page.locator('[data-input-bar] textarea').fill('GIF SVG 导出测试')
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()
  const node = page.locator('[data-canvas-node]').first()
  await expect(node.locator('img').first()).toBeVisible({ timeout: 20_000 })
  await node.dblclick()
  await expect(page.getByTitle(/导出 GIF/)).toBeVisible()

  const gifDownload = page.waitForEvent('download')
  await page.getByTitle(/导出 GIF/).click()
  const gif = await gifDownload
  expect(gif.suggestedFilename()).toMatch(/\.gif$/)
  const gifPath = await gif.path()
  expect(gifPath).toBeTruthy()
  expect(readFileSync(gifPath as string).subarray(0, 6).toString()).toBe('GIF89a')

  const svgDownload = page.waitForEvent('download')
  await page.getByTitle('导出 SVG').click()
  const svg = await svgDownload
  expect(svg.suggestedFilename()).toMatch(/\.svg$/)
  const svgPath = await svg.path()
  expect(svgPath).toBeTruthy()
  const svgText = readFileSync(svgPath as string, 'utf8')
  expect(svgText).toContain('<svg')
  expect(svgText).toContain('<image')
})
