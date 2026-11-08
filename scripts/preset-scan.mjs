import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const FORBIDDEN_PRESET_TEXT = ['api-sz-link', 'api.sz-link', 'jucodex', 'apimart', 'moyuu', 'muteki', 'sublyx', 'custom-apimart']
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.json', '.txt', '.map'])

export function scanPresetValue(value, path = '$') {
  const violations = []
  if (Array.isArray(value)) {
    value.forEach((item, index) => violations.push(...scanPresetValue(item, `${path}[${index}]`)))
    return violations
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') {
      const lower = value.toLowerCase()
      for (const token of FORBIDDEN_PRESET_TEXT) {
        if (lower.includes(token)) violations.push(`${path}: 含旧广告/预置标识 ${token}`)
      }
    }
    return violations
  }
  for (const [key, item] of Object.entries(value)) {
    const nextPath = `${path}.${key}`
    if (key === 'apiKey' && typeof item === 'string' && item.trim()) {
      violations.push(`${nextPath}: 预置配置不能带非空 apiKey`)
    }
    violations.push(...scanPresetValue(item, nextPath))
  }
  return violations
}

export function scanPresetJson(text, label = 'sponsor-presets.json') {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed
  try {
    parsed = JSON.parse(clean)
  } catch (err) {
    return [`${label}: JSON 解析失败：${err.message}`]
  }
  return scanPresetValue(parsed).map((item) => `${label}: ${item}`)
}

export function scanText(text, label = 'text') {
  const violations = []
  const lower = text.toLowerCase()
  for (const token of ['api-sz-link', 'api.sz-link', 'jucodex', 'apimart', 'moyuu', 'muteki', 'sublyx']) {
    if (lower.includes(token)) violations.push(`${label}: 命中旧广告/中转标识 ${token}`)
  }
  if (/\bsk-[A-Za-z0-9._-]{20,}/.test(text)) violations.push(`${label}: 命中疑似明文 API Key`)
  if (/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/.test(text)) violations.push(`${label}: 命中 Bearer token`)
  if (/apiKey\s*:\s*["'][^"']{8,}["']/.test(text) || /"apiKey"\s*:\s*"[^"]{8,}"/.test(text)) {
    violations.push(`${label}: 命中非空 apiKey 字面量`)
  }
  return violations
}

export function scanDistDir(dir) {
  const violations = []
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const path = join(current, name)
      const stat = statSync(path)
      if (stat.isDirectory()) {
        walk(path)
        continue
      }
      if (!TEXT_EXTENSIONS.has(extname(name)) || stat.size > 20 * 1024 * 1024) continue
      violations.push(...scanText(readFileSync(path, 'utf8'), path))
    }
  }
  walk(dir)
  return violations
}

/** 扫描二进制安装包中的 UTF-8 / UTF-16LE / UTF-16BE 可见字符串。 */
export function scanBinaryFile(path) {
  const buffer = readFileSync(path)
  const violations = scanText(buffer.toString('utf8'), path)
  violations.push(...scanText(buffer.toString('utf16le'), `${path} (UTF-16LE)`))
  const swapped = Buffer.from(buffer)
  if (swapped.length % 2 === 1) swapped.subarray(0, swapped.length - 1).swap16()
  else swapped.swap16()
  violations.push(...scanText(swapped.toString('utf16le'), `${path} (UTF-16BE)`))
  return [...new Set(violations)]
}

function parseArgs(argv) {
  const args = { presets: 'sponsor-presets.json', dist: 'dist' }
  for (let i = 2; i < argv.length; i++) {
    const value = argv[i]
    if (value === '--presets') args.presets = argv[++i]
    else if (value === '--dist') args.dist = argv[++i]
    else if (value === '--no-dist') args.dist = ''
    else throw new Error(`未知参数：${value}`)
  }
  return args
}

/** Vite 插件：构建前扫描预置，构建结束扫描 dist。 */
export function presetScanPlugin(options = {}) {
  const presets = options.presets ?? 'sponsor-presets.json'
  const dist = options.dist ?? 'dist'
  return {
    name: 'panpan-preset-scan',
    buildStart() {
      const violations = scanPresetJson(readFileSync(presets, 'utf8'), presets)
      if (violations.length) this.error(`预置配置扫描失败：\n${violations.join('\n')}`)
    },
    closeBundle() {
      if (!dist) return
      try {
        const violations = scanDistDir(dist)
        if (violations.length) this.error(`构建产物扫描失败：\n${violations.join('\n')}`)
      } catch (err) {
        if (err?.code !== 'ENOENT') throw err
      }
    },
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv)
  const violations = [
    ...scanPresetJson(readFileSync(args.presets, 'utf8'), args.presets),
    ...(args.dist ? scanDistDir(args.dist) : []),
  ]
  if (violations.length) {
    console.error(violations.join('\n'))
    process.exit(1)
  }
  console.log('预置与构建产物扫描通过')
}
