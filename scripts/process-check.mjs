#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const root = process.cwd()
const read = (path) => readFileSync(`${root}/${path}`, 'utf8')

function fail(errors) {
  console.error('process-check 失败：')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const stateText = read('docs/execution/STATE.md')
const stateMatch = stateText.match(/<!-- STATE_JSON\r?\n([\s\S]*?)\r?\nSTATE_JSON -->/)
if (!stateMatch) fail(['STATE.md 缺少 STATE_JSON 块'])
let state
try {
  state = JSON.parse(stateMatch[1])
} catch (error) {
  fail([`STATE_JSON 不是合法 JSON：${error.message}`])
}

const errors = []
const planText = read(state.plan)
const planHash = createHash('sha256').update(planText).digest('hex').toUpperCase()
if (planHash !== state.planHash) errors.push(`总方案哈希不一致：STATE=${state.planHash} 实际=${planHash}`)

const ledgerText = read(state.ledger)
const statuses = new Set(['✅', '🟡', '⬜', '⛔', '❓', '⏳'])
const counts = Object.fromEntries([...statuses].map((status) => [status, 0]))
const rows = []
let statusTable = false
for (const line of ledgerText.split(/\r?\n/)) {
  if (!line.startsWith('| ')) continue
  const cells = line.split('|').map((cell) => cell.trim())
  if (cells.length >= 5 && cells[3] === '状态') {
    statusTable = true
    continue
  }
  if (cells.length >= 5 && cells[3] === '说明') {
    statusTable = false
    continue
  }
  if (!statusTable) continue
  if (cells.length < 6) continue
  const id = cells[1]
  if (!/^(?:[A-Z]{1,2}\d(?:[-A-Za-z0-9\u4e00-\u9fa5]*)?|\d+\.\d+|C2-macOS)$/.test(id)) continue
  const status = [...cells[3]][0]
  if (!statuses.has(status)) {
    errors.push(`总账条目 ${id} 状态无效：${cells[3] || '(空)'}`)
    continue
  }
  counts[status] += 1
  rows.push({ id, status, title: cells[2] })
}

for (const row of rows) {
  if ((row.status === '⬜' || row.status === '🟡' || row.status === '❓') && !planText.includes(row.id)) {
    errors.push(`总账条目 ${row.id} 未进入总方案：${row.title}`)
  }
}

const total = rows.length
const remaining = counts['⬜'] + counts['🟡']
console.log(`PROCESS_CHECK: stage=${state.stage} phase=${state.phase} version=${state.version} release=${state.releaseAuthorized ? 'unlocked' : 'locked'}`)
console.log(`总账: ${total} 条，✅ ${counts['✅']} / 🟡 ${counts['🟡']} / ⬜ ${counts['⬜']} / ⛔ ${counts['⛔']} / ❓ ${counts['❓']} / ⏳ ${counts['⏳']}，剩余 ${remaining}`)
if (
  state.phase !== 'done' &&
  state.phase !== 'planning' &&
  state.phase !== 'approved' &&
  !/^stage-[A-Za-z0-9-]+(?:-review)?$/.test(state.phase)
) {
  errors.push(`STATE.phase 非法：${state.phase}`)
}
if (errors.length) fail(errors)
console.log('process-check 通过')
