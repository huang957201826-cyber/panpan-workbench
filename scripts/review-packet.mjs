#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : `（缺少 ${path}）`
const stateText = read('docs/execution/CHECKPOINT.md')
const start = stateText.indexOf('<!-- WORKFLOW_STATE_START -->')
const end = stateText.indexOf('<!-- WORKFLOW_STATE_END -->')
const state = start >= 0 && end > start
  ? JSON.parse(stateText.slice(start + '<!-- WORKFLOW_STATE_START -->'.length, end).trim())
  : null
let diff = '（git diff 不可用）'
try {
  diff = execFileSync('git', ['diff', '--stat'], { encoding: 'utf8' }).trim() || '（工作区无未提交改动）'
} catch {
  /* ignore */
}
let head = '（未知）'
try {
  head = execFileSync('git', ['log', '-1', '--oneline'], { encoding: 'utf8' }).trim()
} catch {
  /* ignore */
}

const lines = [
  '# REVIEW-PACKET',
  '',
  `- 生成时间：${new Date().toISOString()}`,
  `- HEAD：${head}`,
  `- 状态：${state ? JSON.stringify(state) : '（缺少 WORKFLOW_STATE）'}`,
  '',
  '## 总方案',
  '',
  read('docs/execution/PLAN-B03.md'),
  '',
  '## 逐项清单',
  '',
  read('docs/execution/B03-CHECKLIST.md'),
  '',
  '## 当前 diff',
  '',
  '```text',
  diff,
  '```',
  '',
  '## 门禁',
  '',
  read('docs/execution/GATES-B03.json'),
  '',
  '## 证据路径',
  '',
  '- `docs/execution/evidence/`',
  '- `artifacts/e2e-report/`',
  '- `artifacts/e2e-results/`',
  '',
]
writeFileSync(resolve('docs/execution/REVIEW-PACKET.md'), lines.join('\n'), 'utf8')
console.log('已生成 docs/execution/REVIEW-PACKET.md')
