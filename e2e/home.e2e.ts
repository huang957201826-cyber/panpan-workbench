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

const SKILL = {
  id: 'home-skill',
  name: '首页技能',
  description: '首页技能入口测试',
  category: '测试',
  coverColor: '#E8DCC8',
  basePrompt: '首页技能基座',
  slots: [{ key: 'style', label: '风格', type: 'text', required: true, defaultValue: '' }],
  source: 'mine',
  version: 1,
  createdAt: 1,
  updatedAt: 1,
}

async function seedWorkspace(page: Page) {
  await page.addInitScript((workspace) => {
    localStorage.setItem('panpan-workspace-v1', JSON.stringify({ state: workspace, version: 1 }))
    localStorage.setItem('panpan-view-mode', 'canvas')
    localStorage.setItem('color-mode', 'light')
    localStorage.removeItem('panpan-start-activity')
  }, WORKSPACE)
}

async function seedSkill(page: Page) {
  await page.addInitScript((skill) => {
    localStorage.setItem('panpan-capability-skills-v1', JSON.stringify({ state: { mine: [skill] }, version: 1 }))
  }, SKILL)
}

async function readParams(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('gpt-image-playground')
    if (!raw) return null
    return JSON.parse(raw).state?.params as { size?: string; n?: number; output_format?: string; quality?: string } | null
  })
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

test('首页：默认打开，输入后直接生成并切到画布', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.getByText('让每一个画面构想，在此精准呈现')).toBeVisible({ timeout: 30_000 })

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await useMockProfile(page)
    await page.waitForTimeout(300)
    await page.reload()
    await expect(page.getByText('让每一个画面构想，在此精准呈现')).toBeVisible({ timeout: 30_000 })
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

  await page.getByPlaceholder(/描述你想要的画面/).fill('首页直接生成测试')
  await page.getByRole('button', { name: /立即生成/ }).click()
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[data-canvas-node]').first()).toBeVisible({ timeout: 20_000 })
})

test('首页参数：尺寸/数量/格式/质量写回同一 GenerationParams', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  const stage = page.locator('[data-home-stage]')
  await expect(stage).toBeVisible({ timeout: 30_000 })

  await stage.getByRole('button', { name: /自动/ }).first().click()
  await page.getByText(/2K 16:9 · 2560×1440/).last().click()
  await stage.getByRole('button', { name: /数量/ }).click()
  await page.getByText('4 张', { exact: true }).click()
  await stage.getByRole('button', { name: /格式/ }).click()
  await page.getByText('WebP', { exact: true }).click()
  await stage.getByRole('button', { name: /质量/ }).click()
  await page.getByText('high', { exact: true }).last().click()

  await expect.poll(async () => (await readParams(page))?.size).toBe('2560x1440')
  await expect.poll(async () => (await readParams(page))?.n).toBe(4)
  await expect.poll(async () => (await readParams(page))?.output_format).toBe('webp')
  await expect.poll(async () => (await readParams(page))?.quality).toBe('high')
})

test('首页技能：入口、左栏分类、应用后显示 chip', async ({ page }) => {
  await seedWorkspace(page)
  await seedSkill(page)
  await page.goto('/')
  await expect(page.locator('[data-home-stage]')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: '选用技能' }).click()
  const modal = page.locator('[data-skill-picker]')
  await expect(page.getByRole('heading', { name: '选用技能' })).toBeVisible()
  const modalBox = await modal.boundingBox()
  if (!modalBox) throw new Error('技能选择器没有布局')
  expect(modalBox.width).toBeGreaterThanOrEqual(860)
  expect(modalBox.width).toBeLessThanOrEqual(900)
  await expect(modal.locator('aside').getByRole('button', { name: /全部/ })).toBeVisible()
  await expect(modal.locator('aside').getByRole('button', { name: /测试/ })).toBeVisible()

  await page.getByRole('button', { name: /首页技能/ }).first().click()
  await page.getByLabel('风格').fill('极简')
  await page.getByRole('button', { name: '应用技能' }).click()
  await expect(page.getByRole('button', { name: '移除技能' })).toBeVisible()
  await expect(page.getByRole('button', { name: /立即生成/ })).toBeEnabled()
})

test('首页技能：空提示词应用并生成不被 canGenerate 拦截', async ({ page }) => {
  await seedWorkspace(page)
  await seedSkill(page)
  await page.goto('/')
  await expect(page.locator('[data-home-stage]')).toBeVisible({ timeout: 30_000 })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await useMockProfile(page)
    await page.waitForTimeout(300)
    await page.reload()
    await expect(page.locator('[data-home-stage]')).toBeVisible({ timeout: 30_000 })
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

  await page.getByRole('button', { name: '选用技能' }).click()
  await page.getByRole('button', { name: /首页技能/ }).first().click()
  await page.getByLabel('风格').fill('极简')
  await page.getByRole('button', { name: '应用并生成' }).click()
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[data-canvas-node]').first()).toBeVisible({ timeout: 20_000 })
})

test('R6：Rail 68px、首页舞台 780px、光晕 720×340、发送按钮 36px', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-home-stage]')).toBeVisible({ timeout: 30_000 })

  const rail = await page.locator('[data-app-rail]').boundingBox()
  const stage = await page.locator('[data-home-stage]').boundingBox()
  const glow = await page.locator('[data-home-glow]').boundingBox()
  const send = await page.getByRole('button', { name: /立即生成/ }).boundingBox()
  if (!rail || !stage || !glow || !send) throw new Error('首页尺寸元素没有布局')
  expect(Math.round(rail.width)).toBe(68)
  expect(Math.round(stage.width)).toBe(780)
  expect(Math.round(glow.width)).toBe(720)
  expect(Math.round(glow.height)).toBe(340)
  expect(Math.round(send.height)).toBe(36)
  await page.screenshot({ path: 'docs/execution/evidence/r6-home-1440-light.png' })
  await page.evaluate(() => localStorage.setItem('color-mode', 'dark'))
  await page.reload()
  await expect(page.locator('[data-home-stage]')).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: 'docs/execution/evidence/r6-home-1440-dark.png' })
})

test('参考图导入：发送前显示在参考图框，发送后参考图框消失并展示在画布里', async ({ page }) => {
  const png1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64',
  )
  const png2 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-home-stage]')).toBeVisible({ timeout: 30_000 })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await useMockProfile(page)
    await page.waitForTimeout(300)
    await page.reload()
    await expect(page.locator('[data-home-stage]')).toBeVisible({ timeout: 30_000 })
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

  await page.locator('#home-prompt-ref-upload').setInputFiles({
    name: 'ref-home.png',
    mimeType: 'image/png',
    buffer: png1,
  })
  await expect(page.locator('[data-home-reference-shelf]')).toBeVisible()
  await expect(page.locator('[data-home-reference-shelf]')).toContainText('已添加 1 张参考图')

  await page.getByRole('button', { name: '工作区' }).click()
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[data-reference-shelf]')).toBeVisible()
  await expect(page.locator('[data-reference-shelf]')).toContainText('已添加 1 张参考图')
  await expect(page.locator('[data-canvas-image-node]')).toHaveCount(0)

  await page.locator('#bottom-prompt-ref-upload').setInputFiles({
    name: 'ref-canvas.png',
    mimeType: 'image/png',
    buffer: png2,
  })
  await expect(page.locator('[data-reference-shelf]')).toContainText('已添加 2 张参考图')
  await expect(page.locator('[data-canvas-image-node]')).toHaveCount(0)

  await page.locator('[data-input-bar] textarea').fill('参考图发送后入画布验证')
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()

  await expect(page.locator('[data-reference-shelf]')).toHaveCount(0)
  await expect(page.locator('[data-canvas-image-node]')).toHaveCount(2, { timeout: 20_000 })
  await expect(page.locator('[data-canvas-image-node] img').nth(0)).toBeVisible()
  await expect(page.locator('[data-canvas-image-node] img').nth(1)).toBeVisible()
  await expect(page.locator('[data-canvas-node]').first()).toBeVisible({ timeout: 20_000 })

  // 点击「从画布选择参考图」吸取画布上的素材节点，验证重新进入参考图框，再次发送后参考图框再次消失
  await page.locator('[data-input-bar]').getByRole('button', { name: '从画布选择参考图' }).click()
  await page.locator('[data-canvas-image-node]').first().click()
  await expect(page.locator('[data-reference-shelf]')).toBeVisible()
  await expect(page.locator('[data-reference-shelf]')).toContainText('已添加 1 张参考图')

  await page.locator('[data-input-bar] textarea').fill('二次吸取参考图发送验证')
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()
  await expect(page.locator('[data-reference-shelf]')).toHaveCount(0)
  await expect(page.locator('[data-canvas-image-node]')).toHaveCount(2)
})


