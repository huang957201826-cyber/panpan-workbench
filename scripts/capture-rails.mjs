import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const OUT = 'docs/execution/evidence'
fs.mkdirSync(OUT, { recursive: true })

const WORKSPACE = {
  version: 1,
  projects: [
    { id: 'default-project', name: '默认项目', createdAt: 1, updatedAt: 1 },
    { id: 'p2', name: '商业空间改造', createdAt: 2, updatedAt: 2 },
    { id: 'p3', name: '住宅软装', createdAt: 3, updatedAt: 3 },
  ],
  canvases: [
    { id: 'default-canvas', projectId: 'default-project', name: '画布 1', order: 0, createdAt: 1, updatedAt: 1 },
    { id: 'c2', projectId: 'p2', name: '画布 1', order: 0, createdAt: 2, updatedAt: 2 },
    { id: 'c3', projectId: 'p3', name: '画布 1', order: 0, createdAt: 3, updatedAt: 3 },
  ],
  activeProjectId: 'default-project',
  activeCanvasId: 'default-canvas',
  viewMode: 'canvas',
  inputDockPosition: 'bottom',
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', reducedMotion: 'reduce' })
await page.addInitScript((workspace) => {
  localStorage.setItem('panpan-workspace-v1', JSON.stringify({ state: workspace, version: 1 }))
  localStorage.setItem('panpan-view-mode', 'canvas')
  localStorage.setItem('panpan-start-activity', 'projects')
  localStorage.setItem('color-mode', 'light')
  localStorage.setItem('panpan-canvas-use-hint', '1')
}, WORKSPACE)

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('[data-input-bar]', { timeout: 30_000 })
await page.waitForTimeout(600)
await page.screenshot({ path: path.join(OUT, 'd08-app-sidebar.png'), clip: { x: 0, y: 0, width: 320, height: 900 } })

await page.getByRole('button', { name: '工作流' }).click()
await page.waitForSelector('text=本地引擎', { timeout: 20_000 })
await page.waitForTimeout(600)
await page.screenshot({ path: path.join(OUT, 'd08-workflow-rail.png'), clip: { x: 0, y: 0, width: 320, height: 900 } })

await page.getByRole('button', { name: '技能库' }).click()
await page.waitForSelector('text=全部技能', { timeout: 20_000 })
await page.waitForTimeout(600)
await page.screenshot({ path: path.join(OUT, 'd08-skills-rail.png'), clip: { x: 0, y: 0, width: 320, height: 900 } })

const images = ['d08-app-sidebar.png', 'd08-workflow-rail.png', 'd08-skills-rail.png'].map((name) => {
  const data = fs.readFileSync(path.join(OUT, name)).toString('base64')
  return `data:image/png;base64,${data}`
})

const composite = await browser.newPage({ viewport: { width: 1020, height: 940 }, deviceScaleFactor: 1 })
await composite.setContent(`
  <style>
    body { margin: 0; padding: 16px; background: #eef1f6; font-family: sans-serif; }
    .row { display: flex; gap: 12px; }
    figure { margin: 0; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,.08); }
    figcaption { padding: 8px 10px; font-size: 12px; color: #475569; }
    img { display: block; width: 320px; height: 900px; object-fit: cover; object-position: left top; }
  </style>
  <div class="row">
    <figure><img src="${images[0]}"><figcaption>应用侧栏（项目）</figcaption></figure>
    <figure><img src="${images[1]}"><figcaption>工作流左栏</figcaption></figure>
    <figure><img src="${images[2]}"><figcaption>技能库左栏</figcaption></figure>
  </div>
`)
await composite.screenshot({ path: path.join(OUT, 'd08-left-rails.png'), fullPage: true })

await browser.close()
console.log('saved', path.join(OUT, 'd08-left-rails.png'))
