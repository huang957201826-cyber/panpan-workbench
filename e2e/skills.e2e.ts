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
  id: 'e2e-skill',
  name: 'E2E 技能',
  description: 'E2E 测试用能力技能',
  category: '测试',
  coverColor: '#E8DCC8',
  basePrompt: 'E2E 技能基座',
  slots: [{ key: 'style', label: '风格', type: 'text', required: true, defaultValue: '' }],
  source: 'mine',
  version: 1,
  createdAt: 1,
  updatedAt: 1,
}

const PROMPT_SKILL = {
  id: 'e2e-prompt-skill',
  title: 'E2E 提示词技能',
  prompt: '一张{style}的室内效果图',
  tags: ['desc:自建提示词技能'],
  category: '自定义',
  variables: [{ key: 'style', label: '风格', defaultValue: '极简' }],
  favorite: false,
  kind: 'prompt',
  createdAt: 1,
  updatedAt: 1,
}

async function seedWorkspace(page: Page) {
  await page.addInitScript(({ workspace, skill, promptSkill }) => {
    localStorage.setItem('panpan-workspace-v1', JSON.stringify({ state: workspace, version: 1 }))
    localStorage.setItem('panpan-view-mode', 'canvas')
    localStorage.setItem('panpan-start-activity', 'projects')
    localStorage.setItem('color-mode', 'light')
    localStorage.setItem('panpan-canvas-use-hint', '1')
    localStorage.setItem('panpan-capability-skills-v1', JSON.stringify({ state: { mine: [skill] }, version: 1 }))
    localStorage.setItem('panpan-prompt-skills-v1', JSON.stringify({ state: { skills: [promptSkill] }, version: 1 }))
  }, { workspace: WORKSPACE, skill: SKILL, promptSkill: PROMPT_SKILL })
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

async function openPickerAndApply(page: Page) {
  await page.getByRole('button', { name: '选用技能' }).click()
  await expect(page.getByRole('heading', { name: '选用技能' })).toBeVisible()
  await page.getByRole('button', { name: /E2E 技能/ }).first().click()
  await page.getByLabel('风格').fill('极简')
  await page.getByRole('button', { name: '应用技能' }).click()
  await expect(page.getByRole('button', { name: '移除技能' })).toBeVisible()
}

test('技能：选用 → 槽位 → chip → 清空 → 提交合并', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await ensureMockProfile(page)

  await page.locator('[data-input-bar] textarea').fill('用户补充')
  await openPickerAndApply(page)
  await expect(page.getByRole('button', { name: '移除技能' })).toBeVisible()

  await page.getByRole('button', { name: '移除技能' }).click()
  await expect(page.getByRole('button', { name: '移除技能' })).toHaveCount(0)
  await expect(page.locator('[data-input-bar] textarea')).toHaveValue('用户补充')

  await openPickerAndApply(page)
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()
  await expect(page.locator('[data-canvas-node]').first()).toBeVisible({ timeout: 20_000 })

  await page.getByRole('tab', { name: '卡片' }).click()
  await expect(page.getByText(/E2E 技能基座/).first()).toBeVisible({ timeout: 10_000 })
})

test('N51：技能选择器分类在左栏、带数量，搜索在列表上方', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: '选用技能' }).click()
  const modal = page.locator('[data-skill-picker]')
  await expect(modal).toBeVisible()
  const box = await modal.boundingBox()
  if (!box) throw new Error('技能选择器没有布局')
  expect(box.width).toBeGreaterThanOrEqual(860)
  expect(box.width).toBeLessThanOrEqual(900)
  const aside = modal.locator('aside')
  await expect(aside.getByRole('button', { name: /全部/ })).toBeVisible()
  await expect(aside.getByRole('button', { name: /测试/ })).toBeVisible()
  await expect(modal.getByPlaceholder('搜索技能')).toBeVisible()
  await expect(modal.getByRole('button', { name: /E2E 技能/ }).first()).toBeVisible()
  await expect(modal.getByText('正在加载技能…')).toHaveCount(0)
  await aside.getByRole('button', { name: /测试/ }).click()
  await expect(modal.getByRole('button', { name: /E2E 技能/ }).first()).toBeVisible()
  await expect(modal.getByRole('button', { name: /商业空间摄影/ })).toHaveCount(0)
  await aside.getByRole('button', { name: /全部/ }).click()
  await page.screenshot({ path: 'docs/execution/evidence/r5-skill-picker-1440.png' })
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: 'docs/execution/evidence/r5-skill-picker-1024.png' })

  await page.getByPlaceholder('搜索技能').fill('不存在的技能')
  await expect(modal.getByText('没有匹配的技能')).toBeVisible()
  await page.getByPlaceholder('搜索技能').fill('')
  await expect(modal.getByRole('button', { name: /E2E 技能/ }).first()).toBeVisible()
})

test('D-09：我的技能聚合两套技能，选用技能能套用自建提示词技能', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: '技能库' }).click()
  await expect(page.getByText('技能库', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/\d+ 条自定义/)).toBeVisible()
  await page.getByRole('button', { name: /^我的技能\s*\d+$/ }).click()
  await expect(page.getByText('E2E 提示词技能').first()).toBeVisible()
  await expect(page.getByText('E2E 技能').first()).toBeVisible()

  await page.getByRole('button', { name: '工作区' }).click()
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: '选用技能' }).click()
  const modal = page.locator('[data-skill-picker]')
  await expect(modal).toBeVisible()
  await modal.getByRole('button', { name: /E2E 提示词技能/ }).first().click()
  await expect(modal.getByText('一张极简的室内效果图')).toBeVisible()
  await modal.getByRole('button', { name: '应用技能' }).click()
  await expect(page.getByRole('button', { name: '移除技能' })).toBeVisible()
})
