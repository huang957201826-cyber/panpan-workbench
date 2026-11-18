import { chromium } from '@playwright/test'

const url = process.env.PERF_URL ?? 'http://localhost:5173'
const browser = await chromium.launch({ channel: 'msedge', headless: false })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(url, { waitUntil: 'networkidle' })
await page.click('button[aria-label="工作流"]')
await page.waitForSelector('.workflow-node', { timeout: 15000 })
await page.waitForTimeout(1200)

const node = page.locator('.workflow-node').first()
const box = await node.boundingBox()
if (!box) throw new Error('node box not found')
const startX = box.x + Math.min(80, box.width / 2)
const startY = box.y + 15
await page.mouse.move(startX, startY)
await page.mouse.down()
const steps = 120
const duration = 3000
for (let i = 0; i < steps; i += 1) {
  await page.mouse.move(startX + i * 1.5, startY + Math.sin(i / 8) * 24)
  await page.waitForTimeout(duration / steps)
}
await page.mouse.up()
await page.waitForTimeout(400)
const hud = page.locator('[data-drag-perf]')
const text = (await hud.count()) ? await hud.innerText() : '(no HUD)'
console.log('DRAG_PERF', text)
await browser.close()
