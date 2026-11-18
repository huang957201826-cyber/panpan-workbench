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

async function seedWorkspace(page: Page, extra: Record<string, string> = {}) {
  await page.addInitScript(
    ({ workspace, values }) => {
      localStorage.setItem('panpan-workspace-v1', JSON.stringify({ state: workspace, version: 1 }))
      localStorage.setItem('panpan-view-mode', 'canvas')
      localStorage.setItem('panpan-start-activity', 'projects')
      localStorage.setItem('color-mode', 'light')
      localStorage.setItem('panpan-canvas-use-hint', '1')
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value)
    },
    { workspace: WORKSPACE, values: extra },
  )
}

async function useBadKeyProfile(page: Page) {
  await page.evaluate(() => {
    const raw = localStorage.getItem('gpt-image-playground')
    if (!raw) throw new Error('设置尚未持久化')
    const data = JSON.parse(raw)
    const state = data.state
    const active = state.settings.profiles.find((profile: { id: string }) => profile.id === state.settings.activeProfileId) ?? state.settings.profiles[0]
    const profile = {
      ...active,
      id: 'e2e-401',
      name: 'E2E 401',
      provider: 'openai',
      baseUrl: 'http://127.0.0.1:8787/http-401/v1',
      apiKey: 'wrong-key',
      model: 'gpt-image-2.5',
      selectedModel: 'gpt-image-2.5',
      timeout: 30,
      apiMode: 'images',
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

test('失败态：密钥错误时返回 401 并提示', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })
  await useBadKeyProfile(page)
  await page.reload()
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })

  await page.locator('[data-input-bar] textarea').fill('401 失败态验证')
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()
  await expect(page.getByText(/401|Invalid API key|密钥|认证/).first()).toBeVisible({ timeout: 20_000 })
})

test('失败态：引擎未运行时工作流给出提示', async ({ page }) => {
  await seedWorkspace(page, { 'panpan-comfy-engine-url': 'http://127.0.0.1:8198' })
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '工作流' }).click()

  await expect(
    page.getByText(/引擎未运行|还没有检测到 ComfyUI|检测到引擎已安装但没有运行|连接超时/).first(),
  ).toBeVisible({ timeout: 20_000 })
})

test('失败态：导入非法 ZIP 有明确错误', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })

  await page.getByLabel('设置').click()
  await page.getByText('数据', { exact: true }).first().click()
  const fileInput = page.locator('input[type=file]').last()
  await fileInput.setInputFiles({
    name: 'broken.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('this is not a zip backup'),
  })
  await expect(page.getByText(/导入失败/).first()).toBeVisible({ timeout: 20_000 })
})
