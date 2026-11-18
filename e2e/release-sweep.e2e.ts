import { test, expect } from '@playwright/test'

const RAIL = (name: string) => `button[aria-label="${name}"], button[title="${name}"]`

test.describe('发布前旅程与控件巡检', () => {
  test('设置：齿轮打开 → 五页签 → 关闭', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '设置' }).click()
    await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()
    for (const tab of ['API 配置', '通用', '外观', '数据', '关于']) {
      await page.getByRole('button', { name: tab, exact: false }).first().click()
    }
    await page.getByRole('button', { name: '关闭设置' }).click()
    await expect(page.getByRole('heading', { name: '设置' })).toBeHidden()
  })

  test('技能：新建 → 刷新仍在 → 删除', async ({ page }) => {
    await page.goto('/')
    await page.locator(RAIL('技能库')).first().click()
    await expect(page.getByText(/条内置/)).toBeVisible()
    await page.getByRole('button', { name: '新建技能' }).click()
    await page.getByPlaceholder('例如：商业中庭黄昏泛光').fill('SweepSkill')
    await page.getByPlaceholder(/现代商业空间/).fill('interior showroom, warm light, 8k')
    await page.getByRole('button', { name: '保存技能' }).click()
    await expect(page.getByText('SweepSkill').first()).toBeVisible()
    await page.reload()
    await page.locator(RAIL('技能库')).first().click()
    await page.getByRole('button', { name: /^我的技能\s*\d+$/ }).click()
    await expect(page.getByText('SweepSkill').first()).toBeVisible()

    page.on('dialog', (dialog) => dialog.accept())
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const heading = page.locator('h3').filter({ hasText: 'SweepSkill' }).first()
      if ((await heading.count()) === 0) break
      const card = heading.locator('xpath=ancestor::div[contains(@class,"group")]').first()
      await card.locator('button[title="删除自建技能"]').click()
      await page.waitForTimeout(300)
    }
    await expect(page.locator('h3').filter({ hasText: 'SweepSkill' })).toHaveCount(0)
  })

  test('工作流：进入 → 保存的工作流 → 保存工作流', async ({ page }) => {
    await page.goto('/')
    await page.locator(RAIL('工作流')).first().click()
    await expect(page.getByText('本地引擎').first()).toBeVisible()
    await page.getByRole('button', { name: /保存的工作流/ }).click()
    await expect(page.getByRole('heading', { name: '保存的工作流' })).toBeVisible()
    await page.getByLabel('关闭').click()

    await page.getByRole('button', { name: '保存工作流' }).click()
    await page.getByLabel('工作流名称').fill('SweepProject')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByText('已保存工作流「SweepProject」')).toBeVisible()
    await expect(page.getByText('SweepProject').first()).toBeVisible()
  })

  test('控件巡检：页面内非破坏性按钮逐一点击，console 无错误', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    const skip = /运行|生成|删除|清空|恢复|下载|启动|导入|导出|更新|重启|退出|关闭|新建项目|保存|取消/
    const pages = ['首页', '工作区', '工作流', '技能库']
    for (const activity of pages) {
      await page.goto('/')
      const rail = page.locator(RAIL(activity)).first()
      if ((await rail.count()) === 0) continue
      await rail.click()
      const buttons = page.locator('button:visible')
      const count = Math.min(await buttons.count(), 40)
      for (let i = 0; i < count; i += 1) {
        const button = buttons.nth(i)
        const label = ((await button.getAttribute('aria-label')) || (await button.textContent()) || '').trim()
        if (skip.test(label)) continue
        try {
          await button.click({ timeout: 1500 })
          await page.waitForTimeout(80)
        } catch {
          // 控件被遮挡或瞬态，跳过
        }
      }
    }
    expect(errors, errors.join('\n')).toEqual([])
  })
})


