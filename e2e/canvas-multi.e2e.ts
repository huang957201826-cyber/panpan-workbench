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

type WorkspaceSeed = typeof WORKSPACE

function workspaceWithCanvases(count: number, activeIndex = 0): WorkspaceSeed {
  const canvases = Array.from({ length: count }, (_, index) => ({
    id: `canvas-${index + 1}`,
    projectId: 'default-project',
    name: `画布 ${index + 1}`,
    order: index,
    createdAt: index + 1,
    updatedAt: index + 1,
  }))
  return {
    ...WORKSPACE,
    canvases,
    activeCanvasId: canvases[activeIndex]?.id ?? canvases[0].id,
  }
}

const MULTI_PROJECT_WORKSPACE: WorkspaceSeed = {
  ...WORKSPACE,
  projects: [
    { id: 'project-1', name: '项目一', createdAt: 1, updatedAt: 1 },
    { id: 'project-2', name: '项目二', createdAt: 2, updatedAt: 2 },
  ],
  canvases: [
    { id: 'p1-c1', projectId: 'project-1', name: '画布 1', order: 0, createdAt: 1, updatedAt: 1 },
    { id: 'p1-c2', projectId: 'project-1', name: '画布 2', order: 1, createdAt: 2, updatedAt: 2 },
    { id: 'p2-c1', projectId: 'project-2', name: '画布 1', order: 2, createdAt: 3, updatedAt: 3 },
  ],
  activeProjectId: 'project-2',
  activeCanvasId: 'p2-c1',
}

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
)
const TINY_PNG_2 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function seedWorkspace(page: Page, workspace: WorkspaceSeed = WORKSPACE) {
  await page.addInitScript((state) => {
    localStorage.setItem('panpan-workspace-v1', JSON.stringify({ state, version: 1 }))
    localStorage.setItem('panpan-view-mode', 'canvas')
    localStorage.setItem('panpan-start-activity', 'projects')
    localStorage.setItem('color-mode', 'light')
    localStorage.setItem('panpan-canvas-use-hint', '1')
  }, workspace)
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

async function dropTwoImages(page: Page) {
  const dataTransfer = await page.evaluateHandle(({ first, second }) => {
    const toBytes = (data: string) => Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
    const transfer = new DataTransfer()
    transfer.items.add(new File([toBytes(first)], 'a.png', { type: 'image/png' }))
    transfer.items.add(new File([toBytes(second)], 'b.png', { type: 'image/png' }))
    return transfer
  }, { first: TINY_PNG.toString('base64'), second: TINY_PNG_2.toString('base64') })
  const box = await page.locator('[data-canvas-root]').boundingBox()
  if (!box) throw new Error('画布没有布局')
  await page.locator('[data-canvas-root]').dispatchEvent('drop', {
    dataTransfer,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  })
}

test('多选：整组拖动、左对齐、撤销位置', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })

  await dropTwoImages(page)
  const nodes = page.locator('[data-canvas-image-node]')
  await expect(nodes).toHaveCount(2, { timeout: 20_000 })

  const first = await nodes.nth(0).boundingBox()
  const second = await nodes.nth(1).boundingBox()
  if (!first || !second) throw new Error('素材节点没有布局')
  const left = Math.min(first.x, second.x) - 20
  const top = Math.min(first.y, second.y) - 20
  const right = Math.max(first.x + first.width, second.x + second.width) + 20
  const bottom = Math.max(first.y + first.height, second.y + second.height) + 20

  await page.mouse.move(left, top)
  await page.mouse.down()
  await page.mouse.move(right, bottom, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByText('已选 2')).toBeVisible()

  const dragStartX = first.x + 6
  const dragStartY = first.y + first.height - 6
  await page.mouse.move(dragStartX, dragStartY)
  await page.mouse.down()
  await page.mouse.move(dragStartX + 60, dragStartY + 40, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(300)

  const movedFirst = await nodes.nth(0).boundingBox()
  const movedSecond = await nodes.nth(1).boundingBox()
  if (!movedFirst || !movedSecond) throw new Error('拖动后节点消失')
  expect(movedFirst.x - first.x).toBeGreaterThan(40)
  expect(movedFirst.y - first.y).toBeGreaterThan(20)
  expect(Math.abs((movedSecond.x - second.x) - (movedFirst.x - first.x))).toBeLessThan(3)

  await page.getByRole('button', { name: '左对齐', exact: true }).click()
  await page.waitForTimeout(300)
  const alignedFirst = await nodes.nth(0).boundingBox()
  const alignedSecond = await nodes.nth(1).boundingBox()
  if (!alignedFirst || !alignedSecond) throw new Error('对齐后节点消失')
  expect(Math.abs(alignedFirst.x - alignedSecond.x)).toBeLessThan(2)

  await page.getByRole('button', { name: '撤销' }).click()
  await page.waitForTimeout(300)
  const undoneFirst = await nodes.nth(0).boundingBox()
  if (!undoneFirst) throw new Error('撤销后节点消失')
  expect(Math.abs(undoneFirst.x - movedFirst.x)).toBeLessThan(2)
})

test('B06b：素材节点删除后可撤销', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })

  await dropTwoImages(page)
  const nodes = page.locator('[data-canvas-image-node]')
  await expect(nodes).toHaveCount(2, { timeout: 20_000 })

  await nodes.nth(0).click({ button: 'right' })
  await page.getByRole('button', { name: '删除素材' }).click()
  await expect(nodes).toHaveCount(1, { timeout: 10_000 })

  const undo = page.locator('[data-canvas-root] button[aria-label="撤销"]')
  await expect(undo).toBeEnabled()
  await undo.click()
  await expect(nodes).toHaveCount(2, { timeout: 10_000 })
})

test('R1：单素材拖动、缩放后撤销回到原位置/原尺寸', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })

  await dropTwoImages(page)
  const nodes = page.locator('[data-canvas-image-node]')
  await expect(nodes).toHaveCount(2, { timeout: 20_000 })
  const node = nodes.nth(1)
  const undo = page.locator('[data-canvas-root] button[aria-label="撤销"]')
  const readPosition = () => node.evaluate((el) => ({
    left: parseFloat(el.style.left),
    top: parseFloat(el.style.top),
    width: parseFloat(el.style.width),
    height: parseFloat(el.style.height),
  }))

  const before = await node.boundingBox()
  const beforeStyle = await readPosition()
  if (!before) throw new Error('素材节点没有布局')
  await expect(undo).toBeDisabled()
  const dragX = before.x + 10
  const dragY = before.y + before.height - 10
  await page.mouse.move(dragX, dragY)
  await page.mouse.down()
  await page.waitForTimeout(120)
  await page.mouse.move(before.x + before.width / 2 + 60, before.y + before.height / 2 + 40, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const movedStyle = await readPosition()
  expect(movedStyle.left - beforeStyle.left).toBeGreaterThan(20)
  expect(movedStyle.top - beforeStyle.top).toBeGreaterThan(10)

  await expect(undo).toBeEnabled()
  await undo.click()
  await expect(undo).toBeDisabled()
  await page.waitForTimeout(300)
  const restored = await readPosition()
  expect(Math.abs(restored.left - beforeStyle.left)).toBeLessThan(1)
  expect(Math.abs(restored.top - beforeStyle.top)).toBeLessThan(1)

  await node.hover()
  const handle = node.locator('button[aria-label="缩放素材"]')
  const handleBox = await handle.boundingBox()
  if (!handleBox) throw new Error('缩放把手没有布局')
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(120)
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 56, handleBox.y + handleBox.height / 2 + 24, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const resized = await readPosition()
  expect(resized.width - restored.width).toBeGreaterThan(10)

  await expect(undo).toBeEnabled()
  await undo.click()
  await page.waitForTimeout(300)
  const undoResized = await readPosition()
  expect(Math.abs(undoResized.width - restored.width)).toBeLessThan(1)
  expect(Math.abs(undoResized.height - restored.height)).toBeLessThan(1)
})

test('R1：单任务拖动后撤销回到原位', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await ensureMockProfile(page)

  await page.locator('[data-input-bar] textarea').fill('撤销单任务')
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()
  const node = page.locator('[data-canvas-node]').first()
  await expect(node).toBeVisible({ timeout: 20_000 })
  await expect(node.locator('img').first()).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(400)

  const before = await node.boundingBox()
  if (!before) throw new Error('任务节点没有布局')
  const beforeStyle = await node.evaluate((el) => ({ left: parseFloat(el.style.left), top: parseFloat(el.style.top) }))
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(120)
  await page.mouse.move(before.x + before.width / 2 + 80, before.y + before.height / 2 + 50, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const movedStyle = await node.evaluate((el) => ({ left: parseFloat(el.style.left), top: parseFloat(el.style.top) }))
  expect(movedStyle.left - beforeStyle.left).toBeGreaterThan(20)
  expect(movedStyle.top - beforeStyle.top).toBeGreaterThan(10)

  const undo = page.locator('[data-canvas-root] button[aria-label="撤销"]')
  await expect(undo).toBeEnabled()
  await undo.click()
  await page.waitForTimeout(300)
  const restored = await node.evaluate((el) => ({ left: parseFloat(el.style.left), top: parseFloat(el.style.top) }))
  expect(Math.abs(restored.left - beforeStyle.left)).toBeLessThan(1)
  expect(Math.abs(restored.top - beforeStyle.top)).toBeLessThan(1)
})

test('R1：任务删除后左上撤销恢复任务', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await ensureMockProfile(page)

  await page.locator('[data-input-bar] textarea').fill('撤销删除任务')
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()
  const node = page.locator('[data-canvas-node]').first()
  await expect(node).toBeVisible({ timeout: 20_000 })
  await expect(node.locator('img').first()).toBeVisible({ timeout: 20_000 })

  await node.hover()
  await node.locator('button[aria-label="更多操作"]').click()
  await page.getByRole('menuitem', { name: '删除', exact: true }).click()
  await page.getByRole('button', { name: '删除任务', exact: true }).click()
  await expect(page.locator('[data-canvas-node]')).toHaveCount(0, { timeout: 10_000 })

  const undo = page.locator('[data-canvas-root] button[aria-label="撤销"]')
  await expect(undo).toBeEnabled()
  await undo.click()
  await expect(page.locator('[data-canvas-node]')).toHaveCount(1, { timeout: 10_000 })
  await expect(page.locator('[data-canvas-node] img').first()).toBeVisible({ timeout: 20_000 })
})

test('R2/N50：胶囊双击改名、复制、新建直接进入命名态、删除当前画布切相邻', async ({ page }) => {
  await seedWorkspace(page, workspaceWithCanvases(3, 1))
  await page.goto('/')
  await expect(page.locator('[data-canvas-capsule]')).toBeVisible({ timeout: 30_000 })
  const capsule = page.locator('[data-canvas-capsule]')
  await expect(capsule.locator('[data-canvas-id]')).toHaveCount(3)

  await capsule.locator('[data-canvas-id="canvas-2"]').dblclick()
  const renameInput = page.getByLabel('画布名称')
  await expect(renameInput).toBeVisible()
  await renameInput.fill('项目二画布')
  await renameInput.press('Enter')
  await expect(capsule.locator('[data-canvas-id="canvas-2"]')).toHaveAttribute('title', '项目二画布')

  await capsule.locator('[data-canvas-id="canvas-2"]').click({ button: 'right' })
  await page.getByRole('button', { name: '复制', exact: true }).click()
  await expect(capsule.locator('[data-canvas-id]')).toHaveCount(4)
  const copyId = await page.evaluate(() => JSON.parse(localStorage.getItem('panpan-workspace-v1')!).state.activeCanvasId as string)
  expect(copyId).not.toBe('canvas-2')

  await capsule.locator('button[aria-label="新建画布"]').click()
  const createInput = page.getByLabel('画布名称')
  await expect(createInput).toBeVisible()
  await createInput.fill('临时画布')
  await createInput.press('Enter')
  await expect(capsule.locator('button[title="临时画布"]')).toBeVisible()
  const tempId = await page.evaluate(() => JSON.parse(localStorage.getItem('panpan-workspace-v1')!).state.activeCanvasId as string)
  expect(tempId).not.toBe(copyId)

  await capsule.locator(`[data-canvas-id="${tempId}"]`).click({ button: 'right' })
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await page.getByRole('button', { name: '删除画布及其任务' }).click()
  await expect(capsule.locator(`[data-canvas-id="${tempId}"]`)).toHaveCount(0)
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('panpan-workspace-v1')!).state.activeCanvasId as string)).toBe(copyId)
})

test('R2/N50：胶囊重命名按 Escape 取消，不触发 blur 提交', async ({ page }) => {
  await seedWorkspace(page, workspaceWithCanvases(2, 0))
  await page.goto('/')
  await expect(page.locator('[data-canvas-capsule]')).toBeVisible({ timeout: 30_000 })
  const capsule = page.locator('[data-canvas-capsule]')

  await capsule.locator('[data-canvas-id="canvas-1"]').dblclick()
  const input = page.getByLabel('画布名称')
  await expect(input).toBeVisible()
  await input.fill('不应提交')
  await input.press('Escape')
  await expect(page.getByLabel('画布名称')).toHaveCount(0)
  await expect(capsule.locator('[data-canvas-id="canvas-1"]')).toHaveAttribute('title', '画布 1')
  const storedName = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('panpan-workspace-v1')!).state
    return state.canvases.find((canvas: { id: string }) => canvas.id === 'canvas-1').name as string
  })
  expect(storedName).toBe('画布 1')
})

test('R1：切换画布后旧删除 Toast 自动失效', async ({ page }) => {
  await seedWorkspace(page, workspaceWithCanvases(2, 0))
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await dropTwoImages(page)
  const nodes = page.locator('[data-canvas-image-node]')
  await expect(nodes).toHaveCount(2, { timeout: 20_000 })

  await nodes.nth(0).click({ button: 'right' })
  await page.getByRole('button', { name: '删除素材' }).click()
  await expect(nodes).toHaveCount(1, { timeout: 10_000 })
  await expect(page.getByText('已删除 0 个任务 / 1 个素材')).toBeVisible()

  await page.locator('[data-canvas-capsule] [data-canvas-id="canvas-2"]').click()
  await expect(page.getByText('已删除 0 个任务 / 1 个素材')).toHaveCount(0)
})

test('R2/N50：最后一个画布不能删除', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-capsule]')).toBeVisible({ timeout: 30_000 })
  const capsule = page.locator('[data-canvas-capsule]')
  await capsule.locator('[data-canvas-id="default-canvas"]').click({ button: 'right' })
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await expect(page.getByText('至少保留一个画布，最后一个画布不能删除')).toBeVisible()
  await expect(capsule.locator('[data-canvas-id]')).toHaveCount(1)
  await expect(page.getByRole('button', { name: '删除画布及其任务' })).toHaveCount(0)
})

test('R2/N32：点击项目恢复该项目上次画布，首次进入回落第一个画布', async ({ page }) => {
  await seedWorkspace(page, MULTI_PROJECT_WORKSPACE)
  await page.goto('/')
  await expect(page.locator('[data-canvas-capsule]')).toBeVisible({ timeout: 30_000 })
  const capsule = page.locator('[data-canvas-capsule]')

  await page.getByText('项目一', { exact: true }).click()
  await expect(capsule.locator('[data-canvas-id="p1-c1"]')).toHaveAttribute('aria-current', 'page')

  await capsule.locator('[data-canvas-id="p1-c2"]').click()
  await expect(capsule.locator('[data-canvas-id="p1-c2"]')).toHaveAttribute('aria-current', 'page')

  await page.getByText('项目二', { exact: true }).click()
  await expect(capsule.locator('[data-canvas-id="p2-c1"]')).toHaveAttribute('aria-current', 'page')

  await page.getByText('项目一', { exact: true }).click()
  await expect(capsule.locator('[data-canvas-id="p1-c2"]')).toHaveAttribute('aria-current', 'page')
})

test('R2/N50：卡片视图也能通过胶囊切换、新建画布', async ({ page }) => {
  await seedWorkspace(page, workspaceWithCanvases(2, 0))
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('tab', { name: '卡片' }).click()

  const capsule = page.locator('[data-canvas-capsule]')
  await expect(capsule).toBeVisible()
  await expect(capsule.locator('[data-canvas-id]')).toHaveCount(2)
  await page.screenshot({ path: 'docs/execution/evidence/r2-card-capsule-1440.png' })
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'docs/execution/evidence/r2-card-capsule-1024.png' })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await capsule.locator('[data-canvas-id="canvas-2"]').click()
  await expect(capsule.locator('[data-canvas-id="canvas-2"]')).toHaveAttribute('aria-current', 'page')

  await capsule.locator('button[aria-label="新建画布"]').click()
  const input = page.getByLabel('画布名称')
  await expect(input).toBeVisible()
  await input.fill('卡片新画布')
  await input.press('Enter')
  await expect(capsule.locator('[data-canvas-id]')).toHaveCount(3)
  await expect(capsule.locator('button[title="卡片新画布"]')).toBeVisible()
})

test('R2/N50：有任务的画布删除时可把任务迁移到相邻画布', async ({ page }) => {
  await seedWorkspace(page, workspaceWithCanvases(2, 0))
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await ensureMockProfile(page)

  await page.locator('[data-input-bar] textarea').fill('迁移画布任务')
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()
  await expect(page.locator('[data-canvas-node]')).toHaveCount(1, { timeout: 20_000 })
  await expect(page.locator('[data-canvas-node] img').first()).toBeVisible({ timeout: 20_000 })

  const capsule = page.locator('[data-canvas-capsule]')
  await capsule.locator('[data-canvas-id="canvas-1"]').click({ button: 'right' })
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await page.getByRole('button', { name: '移到当前项目的默认画布' }).click()

  await expect(capsule.locator('[data-canvas-id="canvas-1"]')).toHaveCount(0)
  await expect(capsule.locator('[data-canvas-id="canvas-2"]')).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('[data-canvas-node]')).toHaveCount(1, { timeout: 15_000 })
})

test('R1：切换画布清空对应撤销栈，不跨画布撤销', async ({ page }) => {
  await seedWorkspace(page, workspaceWithCanvases(2, 0))
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await dropTwoImages(page)
  const nodes = page.locator('[data-canvas-image-node]')
  await expect(nodes).toHaveCount(2, { timeout: 20_000 })
  const node = nodes.nth(1)
  const undo = page.locator('[data-canvas-root] button[aria-label="撤销"]')
  const readPosition = () => node.evaluate((el) => ({ left: parseFloat(el.style.left), top: parseFloat(el.style.top) }))

  const before = await readPosition()
  const box = await node.boundingBox()
  if (!box) throw new Error('素材节点没有布局')
  await page.mouse.move(box.x + 10, box.y + box.height - 10)
  await page.mouse.down()
  await page.waitForTimeout(120)
  await page.mouse.move(box.x + 80, box.y + box.height + 30, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  await expect(undo).toBeEnabled()
  const moved = await readPosition()
  expect(moved.left - before.left).toBeGreaterThan(20)

  const capsule = page.locator('[data-canvas-capsule]')
  await capsule.locator('[data-canvas-id="canvas-2"]').click()
  await expect(undo).toBeDisabled()
  await capsule.locator('[data-canvas-id="canvas-1"]').click()
  await expect(undo).toBeDisabled()
  const afterReturn = await readPosition()
  expect(Math.abs(afterReturn.left - moved.left)).toBeLessThan(1)
  expect(Math.abs(afterReturn.top - moved.top)).toBeLessThan(1)
})

test('R2/N50：超过 6 个画布全部渲染并可横向滚动', async ({ page }) => {
  await seedWorkspace(page, workspaceWithCanvases(10, 0))
  await page.goto('/')
  await expect(page.locator('[data-canvas-capsule]')).toBeVisible({ timeout: 30_000 })
  const capsule = page.locator('[data-canvas-capsule]')
  await expect(capsule.locator('[data-canvas-id]')).toHaveCount(10)
  const scroller = capsule.locator('.overflow-x-auto')
  const size = await scroller.evaluate((el) => ({ clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }))
  expect(size.scrollWidth).toBeGreaterThan(size.clientWidth)
  await expect(page.getByRole('button', { name: '向右滚动画布' })).toBeVisible()
})

test('R2/N50：1440/1024 画布胶囊与侧栏不溢出', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedWorkspace(page, workspaceWithCanvases(10, 0))
  await page.goto('/')
  await expect(page.locator('[data-canvas-capsule]')).toBeVisible({ timeout: 30_000 })
  await page.keyboard.press('Control+Shift+F')
  await page.waitForTimeout(200)
  await page.screenshot({ path: 'docs/execution/evidence/r2-canvas-1440.png' })

  await page.setViewportSize({ width: 1024, height: 768 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'docs/execution/evidence/r2-canvas-1024.png' })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  const capsuleBox = await page.locator('[data-canvas-capsule]').boundingBox()
  if (!capsuleBox) throw new Error('胶囊没有布局')
  expect(capsuleBox.width).toBeLessThanOrEqual(1024)
})
