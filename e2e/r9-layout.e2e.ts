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

function makeSkill(index: number) {
  const category = index === 0 ? '测试' : `分类${String(index).padStart(2, '0')}`
  return {
    id: `r9-skill-${index}`,
    name: `R9 技能 ${index}`,
    description: 'R9 技能选择器固定框测试',
    category,
    coverColor: '#E8DCC8',
    basePrompt: 'R9 技能基座',
    slots: [{ key: 'style', label: '风格', type: 'text', required: true, defaultValue: '' }],
    source: 'mine',
    version: 1,
    createdAt: 1,
    updatedAt: 1,
  }
}

async function seedWorkspace(page: Page, skills: unknown[] = [], workspace = WORKSPACE) {
  await page.addInitScript(({ workspace, seededSkills }) => {
    localStorage.setItem('panpan-workspace-v1', JSON.stringify({ state: workspace, version: 1 }))
    localStorage.setItem('panpan-view-mode', 'canvas')
    localStorage.setItem('panpan-start-activity', 'projects')
    localStorage.setItem('color-mode', 'light')
    localStorage.setItem('panpan-canvas-use-hint', '1')
    if (seededSkills.length) {
      localStorage.setItem('panpan-capability-skills-v1', JSON.stringify({ state: { mine: seededSkills }, version: 2 }))
    }
  }, { workspace, seededSkills: skills })
}

async function layoutMetrics(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null
      const rect = el.getBoundingClientRect()
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
      }
    }
    return {
      canvas: box(document.querySelector('[data-canvas-root]')),
      card: box(document.querySelector('[data-input-card]')),
      zoom: box(document.querySelector('[data-canvas-zoom-controls]')),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }
  })
}

function overlaps(a: { x: number; y: number; right: number; bottom: number }, b: { x: number; y: number; right: number; bottom: number }) {
  return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y
}

test('N55/N56：输入框 2560 约 1320，1440/1024 不溢出且缩放控件不被遮挡', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })

  for (const [width, height] of [[2560, 1440], [1440, 900], [1024, 768]] as const) {
    await page.setViewportSize({ width, height })
    await page.waitForTimeout(300)
    const metrics = await layoutMetrics(page)
    if (!metrics.canvas || !metrics.card || !metrics.zoom) throw new Error(`${width} 布局元素缺失`)

    expect(metrics.overflow).toBeLessThanOrEqual(1)
    expect(metrics.card.x).toBeGreaterThanOrEqual(metrics.canvas.x)
    expect(metrics.card.right).toBeLessThanOrEqual(metrics.canvas.right)
    expect(metrics.zoom.right).toBe(metrics.canvas.right - 16)
    expect(metrics.zoom.y).toBe(metrics.canvas.y + 16)
    expect(overlaps(metrics.card, metrics.zoom)).toBe(false)

    if (width === 2560) {
      expect(metrics.card.width).toBeGreaterThanOrEqual(1260)
      expect(metrics.card.width).toBeLessThanOrEqual(1320)
    }
    if (width === 1440) expect(metrics.card.width).toBeGreaterThanOrEqual(1040)
    // 1.2.0 在 1024 下同为 637px，本轮不允许收窄
    if (width === 1024) expect(metrics.card.width).toBeGreaterThanOrEqual(636)
    await page.screenshot({ path: `docs/execution/evidence/r9-input-${width}.png` })
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(200)
  const before = await layoutMetrics(page)
  await page.locator('[data-input-bar] textarea').fill(Array.from({ length: 8 }, (_, index) => `第 ${index + 1} 行`).join('\n'))
  await page.waitForTimeout(200)
  const after = await layoutMetrics(page)
  if (!before.zoom || !after.zoom || !after.card) throw new Error('缩放控件布局缺失')
  expect(after.zoom.y).toBe(before.zoom.y)
  expect(overlaps(after.card, after.zoom)).toBe(false)
})

test('N57：技能选择器固定框，切分类不缩放，长列表可滚动', async ({ page }) => {
  await seedWorkspace(page, Array.from({ length: 21 }, (_, index) => makeSkill(index)))
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '选用技能' }).click()
  const modal = page.locator('[data-skill-picker]')
  await expect(modal).toBeVisible()
  const firstBox = await modal.boundingBox()
  if (!firstBox) throw new Error('技能选择器没有布局')
  expect(Math.round(firstBox.width)).toBe(880)
  expect(Math.round(firstBox.height)).toBe(640)

  const categories = modal.locator('[data-skill-categories]')
  const list = modal.locator('[data-skill-list]')
  const scrollable = (locator: typeof categories) => locator.evaluate((el) => el.scrollHeight > el.clientHeight)
  await expect(modal.getByText('正在加载技能…')).toHaveCount(0)
  await expect.poll(() => scrollable(categories)).toBe(true)
  await expect.poll(() => scrollable(list)).toBe(true)

  await categories.getByRole('button', { name: /分类01/ }).click()
  const secondBox = await modal.boundingBox()
  if (!secondBox) throw new Error('切换分类后没有布局')
  expect(Math.abs(secondBox.width - firstBox.width)).toBeLessThan(2)
  expect(Math.abs(secondBox.height - firstBox.height)).toBeLessThan(2)

  await categories.getByRole('button', { name: /全部/ }).click()
  await categories.evaluate((el) => { el.scrollTop = el.scrollHeight })
  expect(await categories.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  await list.evaluate((el) => { el.scrollTop = el.scrollHeight })
  expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)

  await page.screenshot({ path: 'docs/execution/evidence/r9-skill-picker-1440.png' })

  await page.setViewportSize({ width: 1024, height: 768 })
  await page.waitForTimeout(200)
  const compactBox = await modal.boundingBox()
  if (!compactBox) throw new Error('1024 技能选择器没有布局')
  expect(Math.round(compactBox.width)).toBe(880)
  expect(Math.round(compactBox.height)).toBe(640)
  await page.screenshot({ path: 'docs/execution/evidence/r9-skill-picker-1024.png' })
})

test('S6：960×640 在 125% 和 150% 界面缩放下不横向溢出', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await page.setViewportSize({ width: 960, height: 640 })

  for (const scale of [125, 150]) {
    await page.evaluate((uiScale) => {
      const raw = localStorage.getItem('gpt-image-playground')
      if (!raw) throw new Error('设置尚未持久化')
      const data = JSON.parse(raw)
      data.state.settings.uiScale = uiScale
      localStorage.setItem('gpt-image-playground', JSON.stringify(data))
    }, scale)
    await page.reload()
    await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(250)
    const metrics = await layoutMetrics(page)
    if (!metrics.canvas || !metrics.card || !metrics.zoom) throw new Error(`${scale}% 布局元素缺失`)
    expect(metrics.overflow).toBeLessThanOrEqual(1)
    expect(metrics.card.right).toBeLessThanOrEqual(metrics.canvas.right)
    expect(overlaps(metrics.card, metrics.zoom)).toBe(false)
    await page.screenshot({ path: `docs/execution/evidence/s6-960-scale-${scale}.png` })
  }
})
