import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const INPUT = 'C:\\Users\\95720\\AppData\\Local\\Temp\\opencode\\upscale-input.png'
const OUT = 'C:\\Users\\95720\\Downloads'
const EVIDENCE = 'docs/execution/evidence'
const PROXY_PORT = 8189

fs.mkdirSync(EVIDENCE, { recursive: true })

const proxy = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': '*',
      'access-control-max-age': '600',
    })
    res.end()
    return
  }
  const headers = { ...req.headers }
  delete headers.host
  delete headers.origin
  delete headers.referer
  const upstream = http.request(
    { host: '127.0.0.1', port: 8188, path: req.url, method: req.method, headers },
    (up) => {
      const out = { ...up.headers }
      delete out['content-length']
      res.writeHead(up.statusCode || 502, {
        ...out,
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
      })
      up.pipe(res)
    },
  )
  upstream.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`proxy error: ${err.message}`)
  })
  req.pipe(upstream)
})

await new Promise((resolve) => proxy.listen(PROXY_PORT, '127.0.0.1', resolve))

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'zh-CN',
  acceptDownloads: true,
  reducedMotion: 'reduce',
})
const page = await context.newPage()
const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})

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

await page.addInitScript((workspace) => {
  localStorage.setItem('panpan-workspace-v1', JSON.stringify({ state: workspace, version: 1 }))
  localStorage.setItem('panpan-view-mode', 'canvas')
  localStorage.setItem('panpan-start-activity', 'projects')
  localStorage.setItem('color-mode', 'light')
  localStorage.setItem('panpan-canvas-use-hint', '1')
  localStorage.setItem('panpan-comfy-engine-url', 'http://127.0.0.1:8189')
}, WORKSPACE)

const result = { downloads: [], checks: {} }

async function shot(name) {
  await page.screenshot({ path: path.join(EVIDENCE, name), fullPage: false })
}

async function saveDownload(label) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20_000 }),
    page.getByRole('button', { name: '下载图片' }).first().click(),
  ])
  const suggested = download.suggestedFilename()
  let target = path.join(OUT, suggested)
  let index = 1
  while (fs.existsSync(target)) {
    target = path.join(OUT, suggested.replace(/\.png$/, `-${index}.png`))
    index += 1
  }
  await download.saveAs(target)
  const failure = await download.failure()
  const size = fs.statSync(target).size
  const head = fs.readFileSync(target).subarray(0, 8).toString('hex')
  const entry = { label, file: target, size, failure, png: head === '89504e470d0a1a0a' }
  result.downloads.push(entry)
  return entry
}

try {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-input-bar]', { timeout: 30_000 })
  await page.getByRole('button', { name: '工作流' }).click()
  await page.getByRole('heading', { name: '工作流', exact: true }).first().waitFor()
  await page.getByText('无损放大').first().waitFor()

  // 1. 空态：没有结果时点击下载，应给出明确提示
  // aria-disabled 只做视觉提示，按钮本身仍可点；Playwright 会把它当禁用，故强制点击
  await page.getByRole('button', { name: '下载图片' }).first().click({ force: true })
  await page.getByText('还没有生成结果，先运行一次再下载').waitFor({ timeout: 5_000 })
  result.checks.emptyToast = true
  await shot('n163-1-empty-toast.png')
  await page.waitForTimeout(1_500)

  // 2. 上传原图并真跑一次无损放大
  await page.locator('input[type=file]').first().setInputFiles(INPUT)
  await page.locator('img[alt="Primary input"]').waitFor({ timeout: 15_000 })
  const runButton = page.getByRole('button', { name: /运行电池组/ })
  await runButton.waitFor()
  if (await runButton.isDisabled()) throw new Error('运行按钮仍为禁用状态')
  await runButton.click()
  await page.locator('div[title*="点击还原图与全部参数"]').first().waitFor({ timeout: 180_000 })
  await page.waitForTimeout(800)
  await shot('n163-2-result.png')

  // 3. 连续下载两次
  const first = await saveDownload('连续下载-1')
  await page.waitForTimeout(600)
  const second = await saveDownload('连续下载-2')
  result.checks.twoDownloads = first.size > 0 && second.size > 0
  await shot('n163-3-after-two-downloads.png')
  await page.waitForTimeout(1_000)

  // 4. 历史回放：重新上传清掉 outputBlobRef，再点历史记录下载
  await page.locator('input[type=file]').first().setInputFiles(INPUT)
  await page.waitForTimeout(500)
  await page.locator('div[title*="点击还原图与全部参数"]').first().click()
  await page.getByText(/已回溯「无损放大/).waitFor({ timeout: 5_000 })
  await shot('n163-4-history-replay.png')
  const third = await saveDownload('历史记录下载')
  result.checks.historyDownload = third.size > 0

  // 5. 三次下载之间互不影响（revoke 延迟生效）
  result.checks.consecutive = [first, second, third].every((d) => d.size > 0 && d.png)
} catch (err) {
  result.error = err instanceof Error ? err.stack || err.message : String(err)
  await page.screenshot({ path: path.join(EVIDENCE, 'n163-failure.png') }).catch(() => {})
} finally {
  result.consoleErrors = consoleErrors.slice(0, 10)
  await browser.close()
  proxy.close()
}

fs.writeFileSync(
  path.join('docs/execution', 'DOWNLOAD-163-VERIFY.json'),
  JSON.stringify(result, null, 2),
  'utf8',
)
console.log(JSON.stringify(result, null, 2))
process.exit(result.error ? 1 : 0)
