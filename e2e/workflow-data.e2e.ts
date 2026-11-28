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

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
)

const ENGINE = 'http://127.0.0.1:8199'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': '*',
}

async function seedWorkspace(page: Page) {
  await page.addInitScript(
    ({ workspace, engine }) => {
      localStorage.setItem('panpan-workspace-v1', JSON.stringify({ state: workspace, version: 1 }))
      localStorage.setItem('panpan-view-mode', 'canvas')
      localStorage.setItem('panpan-start-activity', 'projects')
      localStorage.setItem('color-mode', 'light')
      localStorage.setItem('panpan-canvas-use-hint', '1')
      localStorage.setItem('panpan-comfy-engine-url', engine)
    },
    { workspace: WORKSPACE, engine: ENGINE },
  )
}

async function mockComfy(page: Page) {
  await page.route(`${ENGINE}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS })
      return
    }
    if (url.pathname === '/system_stats') {
      await route.fulfill({
        status: 200,
        headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify({
          system: { comfyui_version: '0.3.0', python_version: '3.12' },
          devices: [{ name: 'E2E Mock GPU', vram_total: 12 * 1024 ** 3 }],
        }),
      })
      return
    }
    if (url.pathname === '/upload/image') {
      await route.fulfill({
        status: 200,
        headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'e2e-input.png', subfolder: '', type: 'input' }),
      })
      return
    }
    if (url.pathname === '/prompt') {
      await route.fulfill({
        status: 200,
        headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify({ prompt_id: 'e2e-prompt' }),
      })
      return
    }
    if (url.pathname === '/history/e2e-prompt') {
      await route.fulfill({
        status: 200,
        headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify({
          'e2e-prompt': {
            status: { completed: true, status_str: 'success' },
            outputs: { '9': { images: [{ filename: 'e2e-output.png', subfolder: '', type: 'output' }] } },
          },
        }),
      })
      return
    }
    if (url.pathname === '/view') {
      await route.fulfill({
        status: 200,
        headers: { ...CORS, 'content-type': 'image/png' },
        body: TINY_PNG,
      })
      return
    }
    await route.fulfill({ status: 404, headers: CORS, body: 'not mocked' })
  })
}

test('D-11/D-10：保存项目并运行后，刷新仍能看到项目、记录和缩略图', async ({ page }) => {
  await seedWorkspace(page)
  await mockComfy(page)
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: '工作流' }).click()
  await expect(page.getByText('本地引擎').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '返回工作区' })).toHaveCount(0)
  await expect(page.locator('div.absolute.bottom-4.left-4')).toHaveCount(0)

  await page.locator('input[type=file]').first().setInputFiles({
    name: 'e2e-input.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  })
  await expect(page.locator('img[alt="Primary input"]')).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: '保存工作流' }).click()
  const nameInput = page.getByLabel('工作流名称')
  await expect(nameInput).toBeVisible()
  await nameInput.fill('E2E 持久化项目')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('已保存工作流「E2E 持久化项目」')).toBeVisible()
  await expect(page.getByText('E2E 持久化项目').first()).toBeVisible()

  await page.getByRole('button', { name: /运行电池组/ }).click()
  await expect(page.locator('div[title*="点击还原图与全部参数"]').first()).toBeVisible({ timeout: 60_000 })

  await expect.poll(async () => {
    return page.evaluate(() => {
      const raw = localStorage.getItem('panpan-project-workflows-v1')
      const list = raw ? JSON.parse(raw) : []
      return list[0]?.results?.length ?? 0
    })
  }, { timeout: 10_000 }).toBe(1)

  const storedBeforeReload = await page.evaluate(() => {
    const raw = localStorage.getItem('panpan-project-workflows-v1')
    return raw ? JSON.parse(raw) : []
  })
  expect(storedBeforeReload).toHaveLength(1)
  expect(storedBeforeReload[0].results).toHaveLength(1)
  expect(JSON.stringify(storedBeforeReload)).not.toContain('blob:')

  await page.reload()
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '工作流' }).click()
  await page.getByRole('button', { name: /保存的工作流/ }).click()

  await expect(page.getByText('E2E 持久化项目').first()).toBeVisible()
  await expect(page.getByText('1 条记录')).toBeVisible()
  const projectThumbs = page.locator('img[src^="data:image"]')
  await expect(projectThumbs.first()).toBeVisible({ timeout: 15_000 })

  await page.getByText('E2E 持久化项目').first().click()
  await expect(page.locator('div[title*="点击还原图与全部参数"]').first()).toBeVisible({ timeout: 15_000 })
})
