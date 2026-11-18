#!/usr/bin/env node
/**
 * 来源校验：本地复制件与来源文件的行相似度（LCS），低于清单阈值即失败。
 * 用法：node scripts/verify-provenance.mjs
 * 清单：docs/execution/provenance.json
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const manifestPath = resolve(root, 'docs/execution/provenance.json')
if (!existsSync(manifestPath)) {
  console.log('provenance: 未登记来源，跳过')
  process.exit(0)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
let failed = 0

function similarity(a, b) {
  const n = a.length
  const m = b.length
  if (n === 0 || m === 0) return 0
  let prev = new Uint16Array(m + 1)
  for (let i = 1; i <= n; i += 1) {
    const cur = new Uint16Array(m + 1)
    for (let j = 1; j <= m; j += 1) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1])
    }
    prev = cur
  }
  return (prev[m] * 2) / (n + m)
}

for (const entry of manifest.files ?? []) {
  const localPath = resolve(root, entry.local)
  const sourcePath = resolve(root, entry.source)
  const threshold = entry.minSimilarity ?? 95
  if (!existsSync(localPath)) {
    console.error(`缺少本地文件：${entry.local}`)
    failed += 1
    continue
  }
  if (!existsSync(sourcePath)) {
    console.error(`缺少来源文件：${entry.source}`)
    failed += 1
    continue
  }
  const local = readFileSync(localPath, 'utf8').split(/\r?\n/)
  const source = readFileSync(sourcePath, 'utf8').split(/\r?\n/)
  const ratio = similarity(local, source) * 100
  const line = `${entry.local} ← ${entry.source}: ${ratio.toFixed(2)}% (阈值 ${threshold}%)`
  if (ratio < threshold) {
    console.error(`provenance 不达标：${line}`)
    failed += 1
  } else {
    console.log(`provenance 通过：${line}`)
  }
}

if (failed) {
  console.error(`provenance 校验失败：${failed} 个文件`)
  process.exit(1)
}
console.log('provenance 校验通过')
