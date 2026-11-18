import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'

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

async function selectFormat(page: Page, format: string) {
  await page.locator('[data-input-bar] button').filter({ hasText: '更多' }).first().click()
  await page.getByRole('menuitem', { name: format, exact: true }).click()
}

async function setCount(page: Page, count: number) {
  await page.locator('[data-input-bar] button').filter({ hasText: '数量' }).first().click()
  await page.getByRole('menuitem', { name: `${count} 张` }).click()
}

async function generateImage(page: Page, prompt: string) {
  const before = await page.locator('[data-canvas-node]').count()
  await page.locator('[data-input-bar] textarea').fill(prompt)
  await page.locator('[data-input-bar] button[title^="立即生成方案"]').click()
  await expect(page.locator('[data-canvas-node]')).toHaveCount(before + 1, { timeout: 20_000 })
  const node = page.locator('[data-canvas-node]').nth(before)
  await expect(node.locator('img').first()).toBeVisible({ timeout: 20_000 })
  return node
}

async function gifFrameCount(page: Page, path: string) {
  const base64 = (await readFile(path)).toString('base64')
  return page.evaluate(async (encoded) => {
    const binary = atob(encoded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const Ctor = (window as unknown as { ImageDecoder?: new (init: { data: Uint8Array; type: string }) => { tracks: { ready: Promise<void>; selectedTrack?: { frameCount: number } } } }).ImageDecoder
    if (!Ctor) return -1
    const decoder = new Ctor({ data: bytes, type: 'image/gif' })
    await decoder.tracks.ready
    return decoder.tracks.selectedTrack?.frameCount ?? -1
  }, base64)
}

test('透明 PNG 编码为带透明索引的 GIF，多图按顺序动画且上限 2048', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })

  const result = await page.evaluate(async () => {
    const modulePath = '/src/lib/imageExport.ts'
    const mod = await import(modulePath) as {
      GIF_MAX_SIDE: number
      encodeImagesAsGif: (urls: string[], options?: { maxSide?: number }) => Promise<{
        bytes: Uint8Array
        width: number
        height: number
        frameCount: number
        transparent: boolean
      } | null>
    }
    const makeFrame = (color: string) => {
      const canvas = document.createElement('canvas')
      canvas.width = 16
      canvas.height = 16
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('没有 canvas')
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 8, 16)
      return canvas.toDataURL('image/png')
    }
    const encoded = await mod.encodeImagesAsGif([makeFrame('#ff0000'), makeFrame('#0000ff')], { maxSide: 64 })
    if (!encoded) return null
    let transparentFlag = -1
    for (let index = 0; index < encoded.bytes.length - 3; index += 1) {
      if (encoded.bytes[index] === 0x21 && encoded.bytes[index + 1] === 0xf9 && encoded.bytes[index + 2] === 0x04) {
        transparentFlag = encoded.bytes[index + 3] & 1
        break
      }
    }
    return {
      flag: transparentFlag,
      transparent: encoded.transparent,
      frameCount: encoded.frameCount,
      width: encoded.width,
      height: encoded.height,
      maxSide: mod.GIF_MAX_SIDE,
    }
  })

  expect(result).not.toBeNull()
  expect(result?.transparent).toBe(true)
  expect(result?.flag).toBe(1)
  expect(result?.frameCount).toBe(2)
  expect(result?.width).toBe(16)
  expect(result?.height).toBe(16)
  expect(result?.maxSide).toBe(2048)
})

test('详情：显示 GIF 本地格式，当前下载与全部下载都按 GIF 动画输出', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await ensureMockProfile(page)

  await selectFormat(page, 'GIF')
  await setCount(page, 2)
  const node = await generateImage(page, '详情 GIF 下载')
  await node.dblclick()

  const format = page.locator('[data-export-format]')
  await expect(format).toHaveText('GIF（本地转换）')
  await expect(page.getByText('最长边上限 2048px')).toBeVisible()
  const currentDownload = page.locator('button[aria-label="下载图片"]').first()
  await expect(currentDownload).toBeVisible()
  const [currentFile] = await Promise.all([page.waitForEvent('download'), currentDownload.click()])
  expect(currentFile.suggestedFilename()).toMatch(/\.gif$/i)

  const allDownload = page.locator('button[aria-label="下载全部"]').first()
  await expect(allDownload).toBeVisible()
  const [allFile] = await Promise.all([page.waitForEvent('download'), allDownload.click()])
  expect(allFile.suggestedFilename()).toMatch(/\.gif$/i)
  const allPath = await allFile.path()
  if (!allPath) throw new Error('GIF 全部下载没有文件路径')
  expect(await gifFrameCount(page, allPath)).toBe(2)
})

test('图片右键：详情图按任务本地格式下载 GIF', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await ensureMockProfile(page)

  await selectFormat(page, 'GIF')
  const node = await generateImage(page, '右键 GIF 下载')
  await node.dblclick()
  const image = page.locator('img.saveable-image').first()
  await expect(image).toBeVisible()
  await image.click({ button: 'right' })
  const download = page.getByRole('button', { name: '下载', exact: true }).last()
  await expect(download).toBeVisible()
  const [file] = await Promise.all([page.waitForEvent('download'), download.click()])
  expect(file.suggestedFilename()).toMatch(/\.gif$/i)
  expect((await readFile(await file.path() as string)).subarray(0, 6).toString()).toBe('GIF89a')
})

test('底部输入台：不再提供链接添加入口', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await ensureMockProfile(page)

  await selectFormat(page, 'GIF')
  await generateImage(page, '抽屉 GIF 下载')
  await page.keyboard.press('Escape')
  await expect(page.getByTitle('通过图片链接添加参考图')).toHaveCount(0)
})

test('批量 ZIP：两个 GIF 任务打包后仍为 .gif 文件', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-canvas-root]')).toBeVisible({ timeout: 30_000 })
  await ensureMockProfile(page)

  await selectFormat(page, 'GIF')
  await generateImage(page, '批量 GIF 一')
  await generateImage(page, '批量 GIF 二')
  await page.getByRole('tab', { name: '卡片' }).click()
  await page.getByRole('button', { name: '多选' }).click()
  const cards = page.locator('[data-card]')
  await expect(cards).toHaveCount(2)
  await cards.nth(0).click()
  await cards.nth(1).click()

  const [zipFile] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载', exact: true }).click(),
  ])
  expect(zipFile.suggestedFilename()).toMatch(/\.zip$/i)
  const zipPath = await zipFile.path()
  if (!zipPath) throw new Error('ZIP 没有文件路径')
  const entries = unzipSync(new Uint8Array(await readFile(zipPath)))
  const names = Object.keys(entries).filter((name) => !name.endsWith('/'))
  expect(names).toHaveLength(2)
  expect(names.every((name) => name.endsWith('.gif'))).toBe(true)
})
