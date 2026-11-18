#!/usr/bin/env node
/** 校验 vendor/prototype 与清单一致：逐文件 sha256，另报新增/缺失文件 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const manifestPath = 'vendor/prototype/vendor-manifest.json'
if (!existsSync(manifestPath)) {
  console.error('vendor 校验失败：缺少 vendor/prototype/vendor-manifest.json')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const root = 'vendor/prototype'
const srcRoot = join(root, 'src')

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) files.push(...walk(path))
    else files.push(path)
  }
  return files
}

if (!existsSync(srcRoot)) {
  console.error('vendor 校验失败：缺少 vendor/prototype/src')
  process.exit(1)
}

const actual = new Set(walk(srcRoot).map((path) => relative(root, path).split(sep).join('/')))
let failed = 0

for (const entry of manifest.files ?? []) {
  if (!actual.has(entry.path)) {
    console.error(`vendor 缺失：${entry.path}`)
    failed += 1
    continue
  }
  actual.delete(entry.path)
  const path = join(root, entry.path)
  const bytes = statSync(path).size
  const sha256 = createHash('sha256').update(readFileSync(path)).digest('hex')
  if (bytes !== entry.bytes || sha256 !== entry.sha256) {
    console.error(`vendor 不一致：${entry.path}（bytes ${entry.bytes} → ${bytes}）`)
    failed += 1
  }
}

for (const extra of actual) {
  console.error(`vendor 新增未登记文件：${extra}`)
  failed += 1
}

if (failed) {
  console.error(`vendor 校验失败：${failed} 处`)
  process.exit(1)
}
console.log(`vendor ok: ${manifest.files.length} files`)
