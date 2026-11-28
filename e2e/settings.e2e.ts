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

async function seedWorkspace(page: Page) {
  await page.addInitScript((workspace) => {
    localStorage.setItem('panpan-workspace-v1', JSON.stringify({ state: workspace, version: 1 }))
    localStorage.setItem('panpan-view-mode', 'canvas')
    localStorage.setItem('panpan-start-activity', 'projects')
    localStorage.setItem('color-mode', 'light')
    localStorage.setItem('panpan-canvas-use-hint', '1')
  }, WORKSPACE)
}

test('设置：五个页签可切换，通用页不再有技能设置', async ({ page }) => {
  await seedWorkspace(page)
  await page.goto('/')
  await expect(page.locator('[data-input-bar]')).toBeVisible({ timeout: 30_000 })

  await page.getByLabel('设置').click()
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()

  await expect(page.getByText('已保存的 API 配置')).toBeVisible()

  await page.getByText('通用', { exact: true }).first().click()
  await expect(page.getByText('AI 工具集成')).toBeVisible()
  await expect(page.getByText('技能设置', { exact: true })).toHaveCount(0)

  await expect(page.getByText('外部 AI 唤醒联动提示词')).toBeVisible()
  await expect(page.getByRole('button', { name: '仅填入输入框' })).toBeVisible()
  await expect(page.getByRole('button', { name: '自动发送生图' })).toBeVisible()
  const promptPreview = page.locator('div.font-mono').filter({ hasText: 'https://meiyoutou.github.io/panpan-workbench/open/' })
  await expect(promptPreview).toContainText('💡 建议参考图')
  await expect(promptPreview).not.toContainText('&auto=1')
  await page.getByRole('button', { name: '自动发送生图' }).click()
  await expect(promptPreview).toContainText('&auto=1')
  await page.getByRole('button', { name: '仅填入输入框' }).click()
  await expect(promptPreview).not.toContainText('&auto=1')

  const copyPromptBtn = page.getByRole('button', { name: '复制 AI 联动提示词' })
  await expect(copyPromptBtn).toBeVisible()
  expect((await copyPromptBtn.innerText()).trim()).toBe('')
  await expect(copyPromptBtn.locator('svg')).toHaveCount(1)
  await copyPromptBtn.click()
  await expect(page.getByText('已复制 AI 联动提示词')).toBeVisible()
  await expect(page.getByText('任务完成、失败或下载完成时发送系统通知')).toBeVisible()
  // 确认通用页不再包含自定义软件名称
  await expect(page.getByPlaceholder('盼盼工作台')).toHaveCount(0)
  await page.screenshot({ path: 'docs/execution/evidence/verify-mcp-wakeup-prompt.png' })

  await page.getByText('外观', { exact: true }).first().click()
  await expect(page.getByText('颜色主题')).toBeVisible()
  await expect(page.getByText('界面缩放比例')).toBeVisible()

  const customNameInput = page.getByPlaceholder('盼盼工作台')
  await expect(customNameInput).toBeVisible()
  await customNameInput.fill('专属生图工作台')
  await expect(customNameInput).toHaveValue('专属生图工作台')
  await expect(page).toHaveTitle('专属生图工作台')
  await expect(page.locator('[data-app-rail-title]')).toHaveText('专属生图工作台')
  await page.screenshot({ path: 'docs/execution/evidence/verify-appearance-custom-name.png' })
  const resetNameBtn = page.getByRole('button', { name: '恢复默认' })
  await expect(resetNameBtn).toBeVisible()
  await resetNameBtn.click()
  await expect(customNameInput).toHaveValue('')
  await expect(page.locator('[data-app-rail-title]')).toHaveText('盼盼工作台')

  await page.getByText('数据', { exact: true }).first().click()
  await expect(page.getByText('从 ZIP 恢复导入')).toBeVisible()

  await page.getByText('关于', { exact: true }).first().click()
  await expect(page.getByText('使用说明与常见问题')).toBeVisible()

  await page.getByRole('button', { name: '完成', exact: true }).click()
  await expect(page.getByRole('heading', { name: '设置' })).toHaveCount(0)

  const promptInput = page.locator('[data-input-bar] textarea')
  await promptInput.fill('直接点击唤起盼盼工作台：\n[在盼盼工作台生成 · 夜幕钛晶](https://meiyoutou.github.io/panpan-workbench/open/?prompt=%E5%A4%9C%E5%B9%95%E9%92%9B%E6%99%B6&size=1024x1024&auto=0)')
  await expect(promptInput).toHaveValue('夜幕钛晶')
  await expect(page.getByText('已解析外部 AI 联动提示词')).toBeVisible()

  // 验证手机窄屏视口下项目重命名与画布重命名均可正常输入
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '打开项目抽屉' }).click()
  const projectRail = page.locator('[data-project-rail]')
  await expect(projectRail).toBeVisible()
  await projectRail.getByRole('button', { name: '更多项目操作' }).first().click()
  await page.getByRole('button', { name: '重命名', exact: true }).click()
  const projectNameInput = projectRail.getByLabel('项目名称')
  await expect(projectNameInput).toBeVisible()
  await projectNameInput.fill('移动端新项目名')
  await projectNameInput.press('Enter')
  await expect(projectRail.getByText('移动端新项目名')).toBeVisible()
  await page.getByRole('button', { name: '关闭项目抽屉' }).click()

  // 打开手机端画布切换面板并重命名画布
  await page.getByRole('button', { name: '切换画布' }).click()
  await page.getByRole('button', { name: /重命名画布/ }).first().click()
  const mobileCanvasInput = page.getByLabel('画布名称')
  await expect(mobileCanvasInput).toBeVisible()
  await mobileCanvasInput.fill('移动端新画布')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('移动端新画布').first()).toBeVisible()

  // 验证 HTTPS 唤醒跳转桥接页（/open/?prompt=...）不会触发下载失败，且正确展示提示词与唤醒按钮
  await page.goto('/open/index.html?prompt=%E5%A4%9C%E5%B9%95%E9%92%9B%E6%99%B6&size=1024x1024&auto=1')
  await expect(page.locator('#prompt-box')).toHaveText('夜幕钛晶')
  await expect(page.locator('#open-btn')).toBeVisible()
  await page.screenshot({ path: 'docs/execution/evidence/verify-open-bridge-page.png' })
})
