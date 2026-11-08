import { describe, expect, it } from 'vitest'
import { REPO_ISSUES_URL, REPO_READY, REPO_URL } from './repoLinks'
import { UPDATE_ENDPOINT } from './appUpdate'

/**
 * 公开仓上线后，设置页「关于」曾被一个硬编码 REPO_READY = false 继续禁用，
 * 用户看到的仍是「仓库上线后可用」。这里把上线状态与更新端点钉死。
 * tauri.conf.json 的 updater.endpoints 由发布流程另行核对（Node 侧不参与前端 tsc）。
 */
describe('release links', () => {
  it('public repo is live: about-tab entries stay enabled', () => {
    expect(REPO_READY).toBe(true)
    expect(REPO_URL).toBe('https://github.com/huang957201826-cyber/panpan-workbench')
    expect(REPO_ISSUES_URL).toBe(`${REPO_URL}/issues/new`)
  })

  it('updater endpoint points at the public repo releases', () => {
    expect(UPDATE_ENDPOINT).toBe(`${REPO_URL}/releases/latest/download/latest.json`)
  })
})
