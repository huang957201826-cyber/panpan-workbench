#!/usr/bin/env node
/**
 * 基线体检：六个指标，输出到 docs/execution/BASELINE-<日期>.md。
 * 用法：node scripts/baseline-scan.mjs
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, basename } from 'node:path'

const root = process.cwd()
const src = resolve(root, 'src')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) walk(path, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(path)
  }
  return out
}

const files = walk(src).filter((file) => !file.endsWith('.d.ts'))
const rows = files.map((path) => {
  const text = readFileSync(path, 'utf8')
  return { path, rel: relative(root, path).replace(/\\/g, '/'), text, lines: text.split(/\r?\n/).length }
})

// 1. 最大文件与 >800 行文件
const sorted = [...rows].sort((a, b) => b.lines - a.lines)
const over800 = sorted.filter((r) => r.lines > 800)

// 2. 裸 px：Tailwind 任意值里的像素写法
const pxPattern = /\[-?\d+(?:\.\d+)?px\]/g
let pxCount = 0
const pxByFile = new Map()
for (const r of rows) {
  const hits = r.text.match(pxPattern)
  if (!hits) continue
  pxCount += hits.length
  pxByFile.set(r.rel, hits.length)
}

// 3. 依赖图：谁被 import
const imported = new Set()
for (const r of rows) {
  const specs = [
    ...[...r.text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]),
    ...[...r.text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
  ]
  for (const rawSpec of specs) {
    const spec = rawSpec.replace(/\.(tsx?|jsx?|mjs|cjs)$/, '')
    if (!spec.startsWith('.')) continue
    const target = resolve(r.path, '..', spec)
    for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
      try {
        const st = statSync(target + ext)
        if (st.isFile()) imported.add(resolve(target + ext))
      } catch {}
    }
  }
}
const entries = new Set([resolve(src, 'main.tsx'), resolve(src, 'App.tsx')])
const dead = rows
  .filter((r) => !entries.has(r.path) && !r.rel.includes('.test.') && !imported.has(r.path))
  .map((r) => r.rel)

// 4. 重复实现：同名文件出现在多个目录
const byName = new Map()
for (const r of rows) {
  if (r.rel.includes('.test.')) continue
  const key = basename(r.rel).toLowerCase()
  if (!byName.has(key)) byName.set(key, [])
  byName.get(key).push(r.rel)
}
const dupNames = [...byName.entries()].filter(([name, list]) => list.length > 1 && name !== 'index.ts' && name !== 'index.tsx')

// 5. 入口 → 组件：StudioShell 里每个活动入口是否有分支
const shell = rows.find((r) => r.rel.endsWith('studio/StudioShell.tsx'))
const activities = ['home', 'projects', 'workflow', 'skills']
const missingBranches = shell
  ? activities.filter((id) => !new RegExp(`activeActivity\\s*===\\s*'${id}'`).test(shell.text))
  : activities

const top10 = sorted.slice(0, 10).map((r) => `| \`${r.rel}\` | ${r.lines} |`)
const pxTop = [...pxByFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([f, n]) => `| \`${f}\` | ${n} |`)
const dupLines = dupNames.map(([name, list]) => `| ${name} | ${list.map((f) => '`' + f + '`').join('<br>')} |`)

const md = `# 基线体检（六指标）

- 扫描时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}
- 范围：\`src/**/*.{ts,tsx}\`
- 脚本：\`node scripts/baseline-scan.mjs\`

## 数字

| # | 指标 | 数值 |
|---|---|---|
| 1 | 重复实现（同名文件组） | ${dupNames.length} |
| 2 | 最大文件行数 | ${sorted[0].lines} |
| 3 | >800 行文件数 | ${over800.length} |
| 4 | 裸 px 出现次数 | ${pxCount} |
| 5 | 死代码文件数（无入边） | ${dead.length} |
| 6 | 入口映射缺失数 | ${missingBranches.length} |

## 明细

### 最大的 10 个文件

| 文件 | 行数 |
|---|---|
${top10.join('\n')}

### 同名（可能是重复实现）文件组

| 文件名 | 路径 |
|---|---|
${dupLines.join('\n') || '| — | — |'}

### 裸 px 最多的 10 个文件

| 文件 | 次数 |
|---|---|
${pxTop.join('\n') || '| — | — |'}

### 死代码文件（无 import 入边）

${dead.map((f) => `- \`${f}\``).join('\n') || '- 无'}

### 入口映射缺失

${missingBranches.map((a) => `- \`${a}\``).join('\n') || '- 无'}
`

const out = resolve(root, `docs/execution/${process.argv[2] ?? 'BASELINE-20261117.md'}`)
writeFileSync(out, md, 'utf8')
console.log(md.split('## 明细')[0])
console.log(`已写入 ${relative(root, out)}`)
