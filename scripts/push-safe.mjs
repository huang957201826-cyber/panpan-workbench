#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const text = readFileSync('docs/execution/STATE.md', 'utf8')
const match = text.match(/<!-- STATE_JSON\r?\n([\s\S]*?)\r?\nSTATE_JSON -->/)
if (!match) {
  console.error('STATE.md 缺少 STATE_JSON，拒绝推送。')
  process.exit(1)
}
const state = JSON.parse(match[1])
if (state.releaseAuthorized !== true) {
  console.error('发布锁为 locked：未经用户明确口头同意，禁止 push 公开远端/上传 Release。')
  console.error('如需发布，先让用户明确说“可以发到公共盘/可以上传仓库/可以发布”，再更新 STATE.releaseAuthorized。')
  process.exit(1)
}
const result = spawnSync('git', ['push', ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(result.status ?? 1)
