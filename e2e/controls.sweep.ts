import fs from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

const SKIP = /运行|生成|删除|清空|恢复|覆盖|下载|启动|导入|导出|更新|重启|退出|关闭|新建项目|保存|取消|上传|加载|选择|反馈|帮助|文档|GitHub|测试连接|检查更新|安装|卸载|重置|移除|中断|停止|切换项目|浏览|打开文件|登录|授权|端口|连线|选图|画布选|引擎|检测|最小化|最大化|替换|追加|应用/
const NAV = /^(首页|工作区|工作流|技能库|设置)$/
const WRITE_REASON = '写操作/破坏性动作，人工确认'
const PAGES = [
  { name: '首页', rail: '首页' },
  { name: '工作区', rail: '工作区' },
  { name: '工作流', rail: '工作流' },
  { name: '技能库', rail: '技能库' },
  { name: '设置', rail: '设置' },
]

type Row = { page: string; label: string; result: 'PASS' | 'FAIL' | 'SKIP'; reason: string }

async function openPage(page: Page, rail: string) {
  await page.goto('/')
  await page.waitForTimeout(350)
  if (await page.getByRole('heading', { name: '设置' }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: '完成', exact: true }).click().catch(() => {})
    await page.waitForTimeout(200)
  }
  await expect(page.getByRole('button', { name: '工作区' }).first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: rail, exact: true }).first().click()
  await page.waitForTimeout(500)
}

for (const item of PAGES) {
  test(`控件巡检：${item.name}`, async ({ page }) => {
    test.setTimeout(180_000)
    if (item.name === '工作流') {
      await page.route('http://127.0.0.1:8188/**', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          system: { comfyui_version: 'test', devices: [] },
          devices: [],
        }),
      }))
    }
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('dialog', (dialog) => void dialog.dismiss())

    await openPage(page, item.rail)
    const rows: Row[] = []
    const buttons = page.locator('button:visible')
    const maxButtons = item.name === '工作流' || item.name === '技能库' ? 80 : 220
    const total = Math.min(await buttons.count(), maxButtons)
    const seen = new Set<string>()

    for (let index = 0; index < total; index += 1) {
      const button = buttons.nth(index)
      const label = (
        (await button.getAttribute('aria-label', { timeout: 250 }).catch(() => null)) ||
        (await button.getAttribute('title', { timeout: 250 }).catch(() => null)) ||
        (await button.innerText({ timeout: 250 }).catch(() => '')) ||
        ''
      ).replace(/\s+/g, ' ').trim().slice(0, 48)
      if (!label || seen.has(label)) continue
      if (!(await button.isVisible({ timeout: 250 }).catch(() => false))) continue
      seen.add(label)
      if (NAV.test(label)) {
        rows.push({ page: item.name, label, result: 'SKIP', reason: '导航入口，另行覆盖' })
        continue
      }
      if (SKIP.test(label)) {
        rows.push({ page: item.name, label, result: 'SKIP', reason: WRITE_REASON })
        continue
      }
      if (item.name === '工作流' && (/^\d+:\d+$/.test(label) || /跳过|Bypass|蒙版|输入:|输出:|采样|种子|步数|倍率|比例|跟随|模型|参数|参考|连线|端口|展开|收起|节|节点|画布/.test(label))) {
        rows.push({ page: item.name, label, result: 'SKIP', reason: '画布节点交互，人工复核' })
        continue
      }
      try {
        await button.evaluate((element) => (element as HTMLElement).click())
        await page.waitForTimeout(200)
        await page.keyboard.press('Escape')
        await page.waitForTimeout(60)
        rows.push({ page: item.name, label, result: 'PASS', reason: '' })
      } catch (err) {
        rows.push({
          page: item.name,
          label,
          result: 'FAIL',
          reason: err instanceof Error ? err.message.split('\n')[0].slice(0, 120) : String(err).slice(0, 120),
        })
        await page.keyboard.press('Escape').catch(() => {})
      }
    }

    for (const error of errors) {
      rows.push({ page: item.name, label: 'console.error', result: 'FAIL', reason: error.slice(0, 160) })
    }
    rows.push({ page: item.name, label: `（本页 ${total} 个可见按钮，${seen.size} 个唯一控件）`, result: 'PASS', reason: '' })
    fs.mkdirSync('artifacts', { recursive: true })
    fs.writeFileSync(`artifacts/controls-${item.name}.json`, JSON.stringify(rows, null, 2), 'utf8')
    expect(rows.filter((row) => row.result === 'FAIL')).toEqual([])
  })
}

test('控件巡检汇总', async () => {
  const rows: Row[] = []
  for (const item of PAGES) {
    const file = `artifacts/controls-${item.name}.json`
    if (!fs.existsSync(file)) {
      rows.push({ page: item.name, label: '页面未执行', result: 'FAIL', reason: '巡检未产出结果' })
      continue
    }
    rows.push(...(JSON.parse(fs.readFileSync(file, 'utf8')) as Row[]))
  }
  const pass = rows.filter((row) => row.result === 'PASS').length
  const fail = rows.filter((row) => row.result === 'FAIL').length
  const skip = rows.filter((row) => row.result === 'SKIP').length
  const consoleErrors = rows.filter((row) => row.label === 'console.error')
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
  const doc = [
    `# 控件巡检结果（${today}）`,
    '',
    `- PASS：${pass}`,
    `- FAIL：${fail}`,
    `- 跳过：${skip}`,
    `- console error：${consoleErrors.length}`,
    '',
    '## 明细',
    '',
    '| 页面 | 控件 | 结果 | 原因 |',
    '|---|---|---|---|',
    ...rows.map((row) => `| ${row.page} | ${row.label.replace(/\|/g, '\\|')} | ${row.result} | ${row.reason.replace(/\|/g, '\\|')} |`),
    '',
  ]
  fs.writeFileSync('docs/execution/CONTROL-SWEEP-RESULT.md', doc.join('\n'), 'utf8')
  expect(fail, '存在 FAIL 控件').toBe(0)
  expect(consoleErrors, '存在 console error').toEqual([])
})
