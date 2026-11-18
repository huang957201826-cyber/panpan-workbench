#!/usr/bin/env node
/** 生成 vendor/prototype 的只读清单：相对路径、字节数、sha256 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

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

const files = walk(srcRoot)
  .map((path) => ({
    path: relative(root, path).split(sep).join('/'),
    bytes: statSync(path).size,
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
  }))
  .sort((a, b) => a.path.localeCompare(b.path))

writeFileSync(
  join(root, 'vendor-manifest.json'),
  `${JSON.stringify({ root: 'vendor/prototype/src', count: files.length, files }, null, 2)}\n`,
  'utf8',
)
console.log(`vendor manifest: ${files.length} files`)
