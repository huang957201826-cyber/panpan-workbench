#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = { out: 'src-tauri/target/release/latest.json', notes: '盼盼工作台更新' }
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--out') args.out = process.argv[++i]
  else if (process.argv[i] === '--notes') args.notes = process.argv[++i]
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const version = pkg.version
const file = `PanPan Workbench_${version}_x64-setup.exe`
const installer = resolve('src-tauri/target/release/bundle/nsis', file)
const signature = `${installer}.sig`
if (!existsSync(installer)) throw new Error(`安装包不存在：${installer}`)
if (!existsSync(signature)) throw new Error(`签名不存在：${signature}（构建时设置 TAURI_SIGNING_PRIVATE_KEY）`)

// GitHub Release 会把资产名里的空格替换成点（"PanPan Workbench_..." -> "PanPan.Workbench_..."）。
// 更新清单里的下载地址必须写替换后的资产名，否则客户端自动更新会拿到 404。
const assetName = file.replace(/ /g, '.')
const url = `https://github.com/huang957201826-cyber/panpan-workbench/releases/download/v${version}/${encodeURIComponent(assetName)}`
const bytes = readFileSync(installer)
const manifest = {
  version,
  notes: args.notes,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: readFileSync(signature, 'utf8').trim(),
      url,
    },
  },
}
writeFileSync(args.out, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`latest.json 已写入 ${args.out}`)
console.log(`安装包 ${file}`)
console.log(`SHA256 ${createHash('sha256').update(bytes).digest('hex').toUpperCase()}`)
