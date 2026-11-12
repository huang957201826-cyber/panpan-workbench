#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { scanBinaryFile, scanDistDir, scanPresetJson } from './preset-scan.mjs'
import { parseJsonWithBom, stripBom, validateProductIdentity } from './release-check-lib.mjs'
import { checkTauriAcl, collectPermissionFiles } from './check-tauri-acl.mjs'

const args = { presets: 'sponsor-presets.json', dist: 'dist', gates: 'docs/execution/GATES-B02-4.json', skipDist: false, skipGates: false, release: false }
for (let i = 2; i < process.argv.length; i++) {
  const value = process.argv[i]
  if (value === '--presets') args.presets = process.argv[++i]
  else if (value === '--dist') args.dist = process.argv[++i]
  else if (value === '--gates') args.gates = process.argv[++i]
  else if (value === '--no-dist') args.skipDist = true
  else if (value === '--no-gates') args.skipGates = true
  else if (value === '--release') args.release = true
  else throw new Error(`未知参数：${value}`)
}

const errors = []
const notes = []
const read = (path) => stripBom(readFileSync(resolve(path), 'utf8'))

const packageJson = parseJsonWithBom(read('package.json'), 'package.json')
const cargoToml = read('src-tauri/Cargo.toml')
const cargoLock = read('src-tauri/Cargo.lock')
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1]
const lockVersion = cargoLock.match(/\[\[package\]\]\nname = "gpt-image-playground"\nversion = "([^"]+)"/)?.[1]
if (cargoVersion !== packageJson.version) errors.push(`版本不一致：package.json=${packageJson.version} Cargo.toml=${cargoVersion}`)
if (lockVersion !== packageJson.version) errors.push(`版本不一致：package.json=${packageJson.version} Cargo.lock=${lockVersion}`)
notes.push(`版本 ${packageJson.version}`)

const tauriConfig = parseJsonWithBom(read('src-tauri/tauri.conf.json'), 'tauri.conf.json')
errors.push(...validateProductIdentity(tauriConfig))
const icons = tauriConfig.bundle?.icon ?? []
if (!icons.includes('icons/icon.ico') || icons.length < 2) errors.push('图标列表缺少 icon.ico 或尺寸不全')
for (const icon of icons) {
  if (!existsSync(resolve('src-tauri', icon))) errors.push(`图标不存在：src-tauri/${icon}`)
}
const nsis = tauriConfig.bundle?.windows?.nsis
if (!nsis) errors.push('缺少 NSIS 配置')
else {
  if (nsis.installMode !== 'currentUser') errors.push(`NSIS installMode 应为 currentUser，实际 ${nsis.installMode}`)
  if (nsis.installerIcon && !existsSync(resolve('src-tauri', nsis.installerIcon))) errors.push(`安装器图标不存在：${nsis.installerIcon}`)
}
const schemes = tauriConfig.plugins?.['deep-link']?.desktop?.schemes ?? []
if (!schemes.includes('panpan-workbench')) errors.push('协议缺少 panpan-workbench')
if (!existsSync(resolve('src-tauri/windows/installer.nsi'))) errors.push('缺少 NSIS 安装模板')

const acl = checkTauriAcl({
  libSource: read('src-tauri/src/lib.rs'),
  permissionFiles: collectPermissionFiles(resolve('src-tauri/permissions')),
  capability: parseJsonWithBom(read('src-tauri/capabilities/default.json'), 'default.json'),
})
errors.push(...acl.missing.map((command) => `Tauri 命令缺少权限：${command}`))
errors.push(...acl.capabilityMissing.map((identifier) => `capability 缺少权限集：${identifier}`))

const presetText = read(args.presets)
errors.push(...scanPresetJson(presetText, args.presets))
const presets = parseJsonWithBom(presetText, args.presets)
const profileIds = (presets.profiles ?? []).map((profile) => profile.id)
if (profileIds.length !== 1 || !profileIds.includes('gpt_image_playground-default-openai')) {
  errors.push(`预置只应包含默认接口，当前：${profileIds.join(', ')}`)
}
if ((presets.customProviders ?? []).length > 0) errors.push('预置不应再包含 customProviders')
if (/\baff=|返利|推荐链接|特惠 API/.test(presetText)) errors.push('预置不应包含返利/推荐内容')

if (!args.skipDist) {
  if (!existsSync(resolve(args.dist))) errors.push(`构建产物不存在：${args.dist}`)
  else errors.push(...scanDistDir(resolve(args.dist)))
}

if (!args.skipGates) {
  if (!existsSync(resolve(args.gates))) {
    errors.push(`门禁文件不存在：${args.gates}`)
  } else {
    const gates = parseJsonWithBom(read(args.gates), args.gates)
    const installerPath = gates?.gates?.installerPath
    const expected = gates?.gates?.installerSha256
    const bytes = gates?.gates?.installerBytes
    if (!installerPath || !existsSync(installerPath)) {
      errors.push(`GATES 记录的候选安装包不存在：${installerPath ?? '缺失'}`)
    } else {
      const actualBytes = readFileSync(installerPath)
      const actual = createHash('sha256').update(actualBytes).digest('hex').toUpperCase()
      if (actual !== String(expected).toUpperCase()) errors.push(`候选 SHA 不匹配：GATES=${expected} 实际=${actual}`)
      if (Number(bytes) !== actualBytes.length) errors.push(`候选大小不匹配：GATES=${bytes} 实际=${actualBytes.length}`)
      errors.push(...scanBinaryFile(installerPath))
      if (args.release) {
        const sig = `${installerPath}.sig`
        if (!existsSync(sig)) errors.push(`--release 模式缺少签名文件：${sig}`)
      }
      notes.push(`候选 ${actual}`)
    }
  }
}

if (errors.length) {
  console.error('release-check 失败：')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
console.log(`release-check 通过（${notes.join('；')}）`)
