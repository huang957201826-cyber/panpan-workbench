#!/usr/bin/env node
import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'

const FILE = resolve('docs/execution/CHECKPOINT.md')
const START = '<!-- WORKFLOW_STATE_START -->'
const END = '<!-- WORKFLOW_STATE_END -->'
const FIELDS = ['batch', 'stage', 'phase', 'plan', 'planHash', 'gate', 'review', 'next']

function readState(text) {
  const start = text.indexOf(START)
  const end = text.indexOf(END)
  if (start < 0 || end < 0 || end < start) throw new Error('CHECKPOINT 缺少 WORKFLOW_STATE 块')
  return JSON.parse(text.slice(start + START.length, end).trim())
}

function writeState(text, state) {
  const start = text.indexOf(START)
  const end = text.indexOf(END)
  const next = `${text.slice(0, start + START.length)}\n${JSON.stringify(state, null, 2)}\n${text.slice(end)}`
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, next, 'utf8')
  renameSync(tmp, FILE)
}

function assertComplete(state) {
  const missing = FIELDS.filter((field) => !(field in state))
  if (missing.length) throw new Error(`状态缺字段：${missing.join(', ')}`)
}

const text = readFileSync(FILE, 'utf8')
const cmd = process.argv[2] ?? 'get'

if (cmd === 'get') {
  console.log(JSON.stringify(readState(text), null, 2))
} else if (cmd === 'set') {
  const input = process.argv[3]
  if (!input) throw new Error('用法：node scripts/workflow-state.mjs set \'<json>\'')
  const state = { ...readState(text), ...JSON.parse(input) }
  assertComplete(state)
  writeState(text, state)
  console.log(JSON.stringify(state, null, 2))
} else if (cmd === 'set-key') {
  const key = process.argv[3]
  const value = process.argv[4]
  if (!FIELDS.includes(key)) throw new Error(`未知字段：${key}`)
  const state = { ...readState(text), [key]: value }
  writeState(text, state)
  console.log(JSON.stringify(state, null, 2))
} else {
  throw new Error(`未知命令：${cmd}`)
}
