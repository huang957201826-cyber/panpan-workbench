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

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
)

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

async function dropImage(page: Page) {
  const dataTransfer = await page.evaluateHandle(({ data }) => {
    const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
    const transfer = new DataTransfer()
    transfer.items.add(new File([bytes], 'space.png', { type: 'image/png' }))
    return transfer
  }, { data: TINY_PNG.toString('base64') })
  await page.locator('[data-canvas-root]').dispatchEvent('drop', {
    dataTransfer,
    clientX: 620,
    clientY: 320,
  })
}

test('工作流：入口打开保存的工作流页，界面无 Lovart', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: '工作流' }).click()
  await expect(page.getByRole('heading', { name: '工作流', exact: true }).first()).toBeVisible()
  await expect(page.getByText('本地引擎').first()).toBeVisible()
  await expect(page.getByText('无损放大').first()).toBeVisible()
  await expect(page.getByText('抠图', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('该模块仍在规划中，项目已开源')).toHaveCount(0)
  await expect(page.getByText('工作流编排')).toHaveCount(0)
  await expect(page.getByText('Lovart')).toHaveCount(0)
  await page.screenshot({ path: 'docs/execution/evidence/b04a-workflow.png' })
})

test('U6：选中画布素材后点空白，Delete 不再弹删除框', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })

  await dropImage(page)
  const asset = page.locator('[data-canvas-image-node]').first()
  await expect(asset).toBeVisible({ timeout: 20_000 })
  await asset.click()

  const box = await page.locator('[data-canvas-root]').boundingBox()
  if (!box) throw new Error('画布没有布局')
  await page.mouse.click(box.x + 140, box.y + 140)
  await page.keyboard.press('Delete')
  await expect(page.getByText('删除所选内容')).toHaveCount(0)
  await expect(asset).toBeVisible()

  await asset.click()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Delete')
  await expect(page.getByText('删除所选内容')).toHaveCount(0)
  await expect(asset).toBeVisible()
})

test('跨视图选中：九宫格选中后切回画布，Delete 仍作用于该任务', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await ensureMockProfile(page)

  await page.locator('[data-input-bar] textarea').fill('跨视图选中回归')
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()
  const node = page.locator('[data-canvas-node]').first()
  await expect(node).toBeVisible({ timeout: 20_000 })
  await expect(node.locator('img').first()).toBeVisible({ timeout: 20_000 })

  await page.getByRole('tab', { name: '卡片' }).click()
  await page.getByRole('button', { name: '多选' }).click()
  await page.locator('img[alt="跨视图选中回归"]').first().click()
  await expect(page.getByText('已选 1')).toBeVisible()

  await page.getByRole('tab', { name: '画布' }).click()
  await page.keyboard.press('Delete')
  await expect(page.getByText('删除所选内容')).toBeVisible()
  await page.getByRole('button', { name: '取消' }).click()
  await expect(page.getByText('删除所选内容')).toHaveCount(0)
})

test('U1：项目右键出现重命名/删除菜单，新建项目在侧栏底部', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })

  await expect(page.getByRole('button', { name: '新建项目' })).toBeVisible()
  await expect(page.getByText('新建创作方案')).toHaveCount(0)
  await page.getByText('默认项目', { exact: true }).first().click({ button: 'right' })
  await expect(page.getByRole('button', { name: '重命名' })).toBeVisible()
  await expect(page.getByRole('button', { name: '删除' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建方案' })).toHaveCount(0)
})

test('R1/N39：侧栏折叠后画布、卡片、首页都能展开方案', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: '收起方案侧栏' }).click()
  await expect(page.getByRole('button', { name: '展开方案' })).toBeVisible()
  await expect(page.getByLabel('搜索任务')).toHaveCount(0)

  await page.getByRole('tab', { name: '卡片' }).click()
  await expect(page.getByRole('button', { name: '展开方案' })).toBeVisible()
  await expect(page.getByLabel('搜索任务')).toBeVisible()
  await expect(page.getByRole('button', { name: '多选' })).toBeVisible()
  await expect(page.getByRole('button', { name: /最新优先/ })).toBeVisible()
  await expect(page.locator('[data-canvas-capsule]')).toBeVisible()

  await page.getByRole('button', { name: '首页' }).click()
  await expect(page.getByRole('button', { name: '展开方案' })).toHaveCount(0)
  await page.getByRole('button', { name: '工作区' }).click()
  await expect(page.getByRole('button', { name: '展开方案' })).toBeVisible()
  await page.getByRole('button', { name: '展开方案' }).click()

  await expect(page.getByText('默认项目', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '多选' })).toBeVisible()
  await page.getByRole('tab', { name: '画布' }).click()
  await expect(page.locator('[data-canvas-root]')).toBeVisible()
})

test('R1/N39：收起侧栏后撤销按钮仍可点击', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await dropImage(page)
  const asset = page.locator('[data-canvas-image-node]').first()
  await expect(asset).toBeVisible({ timeout: 20_000 })
  const readLeft = () => asset.evaluate((el) => parseFloat(el.style.left))
  const before = await readLeft()
  const box = await asset.boundingBox()
  if (!box) throw new Error('素材节点没有布局')
  await page.mouse.move(box.x + 10, box.y + box.height - 10)
  await page.mouse.down()
  await page.waitForTimeout(120)
  await page.mouse.move(box.x + 80, box.y + box.height + 30, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const undo = page.locator('[data-canvas-root] button[aria-label="撤销"]')
  await expect(undo).toBeEnabled()

  await page.getByRole('button', { name: '收起方案侧栏' }).click()
  await expect(page.getByRole('button', { name: '展开方案' })).toBeVisible()
  await undo.click()
  await page.waitForTimeout(300)
  expect(Math.abs(await readLeft() - before)).toBeLessThan(1)
})

test('R2/N32：项目重命名按 Escape 取消，不触发 blur 提交', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })

  await page.getByText('默认项目', { exact: true }).first().click({ button: 'right' })
  await page.getByRole('button', { name: '重命名' }).click()
  const input = page.getByLabel('项目名称')
  await expect(input).toBeVisible()
  await input.fill('不应提交')
  await input.press('Escape')
  await expect(page.getByLabel('项目名称')).toHaveCount(0)
  await expect(page.getByText('默认项目', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('不应提交')).toHaveCount(0)
})

test('R2/N32：侧栏搜索只匹配项目名，不匹配画布名', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: '搜索项目' }).click()
  await page.getByLabel('搜索项目名').fill('画布 1')
  await expect(page.getByText('没有匹配的项目')).toBeVisible()
  await page.getByLabel('搜索项目名').fill('默认')
  await expect(page.getByText('默认项目', { exact: true }).first()).toBeVisible()
})

test('N11：两个任务节点框选后整组拖动', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await ensureMockProfile(page)

  for (const prompt of ['任务A', '任务B']) {
    await page.locator('[data-input-bar] textarea').fill(prompt)
    await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()
    await page.waitForTimeout(400)
  }
  const nodes = page.locator('[data-canvas-node]')
  await expect(nodes).toHaveCount(2, { timeout: 30_000 })
  await expect(nodes.nth(0).locator('img').first()).toBeVisible({ timeout: 20_000 })
  await page.keyboard.press('Control+0')
  await page.waitForTimeout(400)

  const box = await page.locator('[data-canvas-root]').boundingBox()
  if (!box) throw new Error('画布没有布局')
  await page.mouse.click(box.x + 20, box.y + 20)
  await page.keyboard.press('Control+0')
  await page.waitForTimeout(300)
  await page.keyboard.press('Control+a')
  await expect(page.getByText('已选 2')).toBeVisible()

  const first = await nodes.nth(0).boundingBox()
  const second = await nodes.nth(1).boundingBox()
  if (!first || !second) throw new Error('任务节点没有布局')
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2)
  await page.mouse.down()
  await page.mouse.move(first.x + first.width / 2 + 50, first.y + first.height / 2 + 40, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(300)

  const movedFirst = await nodes.nth(0).boundingBox()
  const movedSecond = await nodes.nth(1).boundingBox()
  if (!movedFirst || !movedSecond) throw new Error('拖动后任务节点消失')
  expect(movedFirst.x - first.x).toBeGreaterThan(30)
  expect(Math.abs((movedSecond.x - second.x) - (movedFirst.x - first.x))).toBeLessThan(3)
})
