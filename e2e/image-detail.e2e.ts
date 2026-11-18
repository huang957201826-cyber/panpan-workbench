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

/** ImageDetailModal 只在 CardGridView 未传 onInspectArtboard 时渲染；当前 StudioShell 总会传，故这里用真实 store 挂载组件验证下载链路 */
test('卡片图片详情：GIF 任务下载不再回退 PNG', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await ensureMockProfile(page)

  await page.locator('[data-input-bar] button').filter({ hasText: '更多' }).first().click()
  await page.getByRole('menuitem', { name: 'GIF', exact: true }).click()
  await page.locator('[data-input-bar] textarea').fill('卡片详情 GIF')
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()
  const node = page.locator('[data-canvas-node]').first()
  await expect(node.locator('img').first()).toBeVisible({ timeout: 20_000 })
  const taskId = await node.getAttribute('data-task-id')
  if (!taskId) throw new Error('任务节点没有 taskId')

  const mounted = await page.evaluate(async (id) => {
    const storeModule = await import('/src/store.ts')
    const task = storeModule.useStore.getState().tasks.find((item: { id: string }) => item.id === id)
    if (!task) return { error: '找不到任务' }
    const resources = performance.getEntriesByType('resource').map((entry) => entry.name)
    const reactUrl = resources.find((url) => /\/deps\/react\.js/.test(url)) ?? '/@id/react'
    const reactDomUrl = resources.find((url) => /\/deps\/react-dom_client\.js/.test(url)) ?? '/@id/react-dom/client'
    const ReactModule = await import(reactUrl)
    const React = ReactModule.default ?? ReactModule
    const ReactDOM = await import(reactDomUrl)
    const createRoot = ReactDOM.createRoot ?? ReactDOM.default?.createRoot
    if (!createRoot) return { error: 'ReactDOM.createRoot 不可用' }
    const { ImageDetailModal } = await import('/src/studio/components/ImageDetailModal.tsx')
    const host = document.createElement('div')
    host.id = 'e2e-image-detail-host'
    document.body.appendChild(host)
    createRoot(host).render(React.createElement(ImageDetailModal, {
      artboard: {
        id: 'e2e-image-detail',
        title: '卡片详情 GIF',
        imageUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
        imageId: task.outputImages[0],
        taskId: task.id,
        aspectRatio: '16:9',
        resolution: '1024 × 1024',
        model: 'gpt-image-2.5',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
      onClose: () => {},
    }))
    return { error: null }
  }, taskId)
  if (mounted.error) throw new Error(mounted.error)

  const download = page.locator('#e2e-image-detail-host button[aria-label="下载原图"]')
  await expect(download).toBeVisible({ timeout: 10_000 })
  const [file] = await Promise.all([page.waitForEvent('download'), download.click()])
  expect(file.suggestedFilename()).toMatch(/\.gif$/i)
  const path = await file.path()
  if (!path) throw new Error('下载没有文件路径')
  expect((await readFile(path)).subarray(0, 6).toString()).toBe('GIF89a')
})
