import { test, expect, type Page } from '@playwright/test'

/**
 * v1.0.0 的 P0：浮岛输入栏 5 个下拉能弹出，但真实鼠标点选项 100% 失效。
 * 根因是 host 的 document pointerdown 外部点击监听把 portal 菜单误判成“点在外面”，
 * 菜单在 click 之前被卸载。组件级 jsdom 测试已经覆盖事件顺序，这里补真实浏览器回归。
 *
 * 只覆盖一条主链路：打开下拉 → 点击选项 → 值写回 → 持久化。
 * 不测像素、布局、动画，避免后续 UI 调整被测试绑死。
 */

const STORE_KEY = 'gpt-image-playground'
const WORKSPACE_KEY = 'panpan-workspace-v1'

const WORKSPACE = {
  version: 1,
  projects: [{ id: 'default-project', name: '默认项目', createdAt: 1, updatedAt: 1 }],
  canvases: [{ id: 'default-canvas', projectId: 'default-project', name: '画布 1', order: 0, createdAt: 1, updatedAt: 1 }],
  activeProjectId: 'default-project',
  activeCanvasId: 'default-canvas',
  viewMode: 'canvas',
  inputDockPosition: 'bottom',
}

type PersistedState = {
  params?: {
    quality?: string
    size?: string
    n?: number
    output_format?: string
  }
  settings?: {
    activeProfileId?: string
    profiles?: Array<{ id?: string; model?: string; selectedModel?: string }>
  }
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

async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible()
  await expect(page.locator('[data-input-bar] textarea')).toBeVisible()
}

function pill(page: Page, text: string) {
  return page.locator('[data-input-bar] button').filter({ hasText: text }).first()
}

async function readStore(page: Page): Promise<PersistedState | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return (JSON.parse(raw) as { state?: PersistedState }).state ?? null
  }, STORE_KEY)
}

/** 用真实鼠标顺序点选项；mousedown 后菜单必须还活着，否则旧缺陷会在这里失败。 */
async function clickMenuItem(page: Page, name: string | RegExp) {
  const item = page.getByRole('menuitem', { name }).first()
  await expect(item).toBeVisible()
  const box = await item.boundingBox()
  if (!box) throw new Error(`菜单项没有布局：${name}`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(item).toBeVisible()
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await seedWorkspace(page)
})

test('质量下拉：选 high 后写回，并在刷新后保留', async ({ page }) => {
  await openApp(page)
  await pill(page, '质量').click()
  await expect(page.locator('[role="menu"]')).toBeVisible()
  await clickMenuItem(page, /^high$/)

  await expect.poll(async () => (await readStore(page))?.params?.quality).toBe('high')
  await expect(pill(page, '质量')).toContainText('high')

  await page.reload()
  await expect(page.locator('[data-input-bar]')).toBeVisible()
  await expect(pill(page, '质量')).toContainText('high')
})

test('R3 失败注入：参数持久化写入抛错时，当前会话仍能写回', async ({ page }) => {
  await openApp(page)
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name: string, value: string) {
      if (name === key) throw new Error('模拟持久化写入失败')
      return original.call(this, name, value)
    }
  }, STORE_KEY)
  await pill(page, '质量').click()
  await clickMenuItem(page, /^high$/)
  await expect(pill(page, '质量')).toContainText('high')
  await expect(page.locator('[data-input-bar] textarea')).toBeVisible()
})

test('尺寸下拉：选 1K 16:9 后写回', async ({ page }) => {
  await openApp(page)
  await pill(page, '尺寸').click()
  await clickMenuItem(page, /1K 16:9/)

  await expect.poll(async () => (await readStore(page))?.params?.size).toBe('1280x720')
  await expect(pill(page, '尺寸')).toContainText('1K 16:9')
})

test('N55：底部输入台自定义尺寸弹窗可交互并关闭', async ({ page }) => {
  await openApp(page)
  await pill(page, '尺寸').click()
  await page.getByRole('menuitem', { name: '更多尺寸 / 比例…' }).click()
  const modal = page.locator('[data-no-drag-select]')
  await expect(modal.getByRole('heading', { name: '设置图像尺寸' })).toBeVisible()
  await modal.getByRole('button', { name: '关闭' }).click()
  await expect(modal).toHaveCount(0)
})

test('2K/4K：2.6 默认模型尺寸下拉包含 4K', async ({ page }) => {
  await openApp(page)
  await pill(page, '尺寸').click()
  await expect(page.getByRole('menuitem', { name: /4K 16:9/ })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /2K 16:9/ })).toBeVisible()
  await page.keyboard.press('Escape')
})

test('数量下拉：选 4 张后写回', async ({ page }) => {
  await openApp(page)
  await pill(page, '数量').click()
  await clickMenuItem(page, /^4 张$/)

  await expect.poll(async () => (await readStore(page))?.params?.n).toBe(4)
  await expect(pill(page, '数量')).toContainText('4')
})

test('更多下拉：选 WebP 后写回', async ({ page }) => {
  await openApp(page)
  await pill(page, '更多').click()
  await clickMenuItem(page, /^WebP$/)

  await expect.poll(async () => (await readStore(page))?.params?.output_format).toBe('webp')
  await expect(pill(page, '更多')).toContainText('WebP')
  await page.keyboard.press('Escape')
})

test('N35：质量独立，更多只留格式/透明/审核/批量，遮罩是独立图标', async ({ page }) => {
  await openApp(page)
  await expect(pill(page, '质量')).toBeVisible()
  await expect(pill(page, '质量')).toHaveClass(/h-\[28px\]/)
  await expect(page.getByRole('button', { name: '遮罩编辑器' })).toBeVisible()
  await expect(page.locator('[data-input-bar] textarea')).toHaveClass(/no-scrollbar/)
  const barBox = await page.locator('[data-input-bar] > div').first().boundingBox()
  if (!barBox) throw new Error('输入框没有布局')
  expect(barBox.width).toBeLessThanOrEqual(1320)
  expect(barBox.width).toBeGreaterThan(900)

  await pill(page, '更多').click()
  await expect(page.getByRole('menuitem', { name: 'GIF', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'SVG', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '遮罩编辑器' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: '复制当前方案配置' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: '通过图片链接添加' })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'GIF', exact: true }).click()
  await expect(page.getByText(/GIF 最长边上限 2048px/)).toBeVisible()
  await expect(pill(page, '更多')).toContainText('GIF')
  await page.reload()
  await expect(page.locator('[data-input-bar]')).toBeVisible()
  await expect(pill(page, '更多')).toContainText('GIF')
})

test('模型下拉：切到第二个模型后写回当前 profile', async ({ page }) => {
  await openApp(page)

  await page.evaluate(async () => {
    const storeModule = await import('/src/store.ts')
    const state = storeModule.useStore.getState()
    const active = state.settings.profiles.find((profile: { id: string }) => profile.id === state.settings.activeProfileId) ?? state.settings.profiles[0]
    if (!active) throw new Error('没有可用的 API profile')
    storeModule.useStore.getState().setSettings({
      ...state.settings,
      profiles: state.settings.profiles.map((profile: { id: string }) => profile.id === active.id
        ? { ...profile, model: 'gpt-image-2.5,gpt-image-1', selectedModel: 'gpt-image-2.5' }
        : profile),
    })
  })

  await expect(page.locator('[data-input-bar]')).toBeVisible()
  await expect(pill(page, 'gpt-image-2.5')).toBeVisible()
  await pill(page, 'gpt-image-2.5').click()
  await clickMenuItem(page, /^gpt-image-1$/)

  await expect.poll(async () => {
    const settings = (await readStore(page))?.settings
    const active = settings?.profiles?.find((profile) => profile.id === settings.activeProfileId)
    return active?.selectedModel
  }).toBe('gpt-image-1')
  await expect(pill(page, 'gpt-image-1')).toBeVisible()
})

test('M1：测试连接后可按关键词检索并加入模型', async ({ page }) => {
  await openApp(page)
  await page.evaluate(async () => {
    const storeModule = await import('/src/store.ts')
    const state = storeModule.useStore.getState()
    const active = state.settings.profiles.find((profile: { id: string }) => profile.id === state.settings.activeProfileId) ?? state.settings.profiles[0]
    if (!active) throw new Error('没有可用的 API profile')
    storeModule.useStore.getState().setSettings({
      ...state.settings,
      profiles: state.settings.profiles.map((profile: { id: string }) => profile.id === active.id
        ? { ...profile, model: 'gpt-image-2.5', selectedModel: 'gpt-image-2.5', baseUrl: 'http://127.0.0.1:8787/b64/v1', apiKey: 'test' }
        : profile),
    })
  })

  await expect(pill(page, 'gpt-image-2.5')).toBeVisible()
  await pill(page, 'gpt-image-2.5').click()
  await page.getByRole('menuitem', { name: '管理模型列表…' }).click()

  await page.getByRole('button', { name: '测试连接并获取模型' }).click()
  await expect(page.getByText(/连接成功.*返回 \d+ 个模型/)).toBeVisible({ timeout: 15_000 })
  await page.getByPlaceholder('搜索拉取到的模型...').fill('mock-image')
  await page.getByRole('button', { name: /mock-image-model/ }).click()

  await expect(page.getByText('mock-image-model').first()).toBeVisible()
})
