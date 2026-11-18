import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const roots = ['src', 'src-tauri/src']
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.rs'])
const findings = []

const rules = [
  { name: '动态代码执行', pattern: /\beval\s*\(|\bnew Function\s*\(/, hint: '改用显式解析或映射' },
  { name: '内联 HTML 注入', pattern: /dangerouslySetInnerHTML/, hint: '确认来源可信并使用白名单' },
  { name: '疑似 API Key', pattern: /\bsk-[A-Za-z0-9_-]{20,}/, hint: '移除硬编码密钥' },
  { name: '私钥内容', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, hint: '移除私钥' },
]

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    // 原型参考快照只用于来源校验，不参与运行与安全扫描
    if (path.replace(/\\/g, '/').includes('/modules/ported/')) continue
    const stat = statSync(path)
    if (stat.isDirectory()) {
      walk(path)
      continue
    }
    if (!extensions.has(path.slice(path.lastIndexOf('.')))) continue
    if (/\.test\.|\.spec\.|__tests__/.test(path)) continue
    const lines = readFileSync(path, 'utf8').split(/\r?\n/)
    const isRust = path.endsWith('.rs')
    for (const [index, line] of lines.entries()) {
      // Rust 测试模块里的假 Key/假数据不参与生产代码扫描
      if (isRust && line.includes('#[cfg(test)]')) break
      for (const rule of rules) {
        if (!rule.pattern.test(line)) continue
        findings.push(`${path}:${index + 1} [${rule.name}] ${rule.hint}`)
      }
    }
  }
}

for (const root of roots) walk(root)

if (findings.length) {
  console.error('SAST 失败：')
  for (const item of findings) console.error(`- ${item}`)
  process.exit(1)
}

console.log('SAST 通过：未发现动态代码执行、内联 HTML 注入或硬编码密钥。')

if (process.argv.includes('--audit')) {
  const raw = execFileSync('npm', ['audit', '--omit=dev', '--audit-level=high', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  const report = JSON.parse(raw)
  const summary = report.metadata?.vulnerabilities ?? {}
  console.log(`依赖扫描：high ${summary.high ?? 0} / critical ${summary.critical ?? 0}`)
}
