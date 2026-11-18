#!/usr/bin/env node
/**
 * 空控件扫描：找出没有 onClick、没有 disabled、也不是 submit 的 <button>。
 * 用法：node scripts/scan-empty-buttons.mjs [文件或目录...]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const targets = process.argv.slice(2)
if (targets.length === 0) {
  console.error('用法：node scripts/scan-empty-buttons.mjs <文件或目录> ...')
  process.exit(2)
}

function walk(path, out = []) {
  const st = statSync(path)
  if (st.isDirectory()) {
    for (const name of readdirSync(path)) walk(join(path, name), out)
  } else if (/\.tsx$/.test(path)) {
    out.push(path)
  }
  return out
}

const files = targets.flatMap((target) => walk(target))
let bad = 0

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/)
  for (const match of text.matchAll(/<button\b([\s\S]*?)>/g)) {
    const attrs = match[1]
    if (/onClick|disabled|type="submit"|type='submit'/.test(attrs)) continue
    const index = text.slice(0, match.index).split(/\r?\n/).length
    // 忽略片段拼接出来的按钮（属性来自变量）
    if (/\{\.\.\./.test(attrs)) continue
    console.log(`${relative(process.cwd(), file)}:${index}`)
    bad += 1
  }
}

console.log(bad === 0 ? '空控件：0' : `空控件：${bad} 处`)
process.exit(bad === 0 ? 0 : 1)
