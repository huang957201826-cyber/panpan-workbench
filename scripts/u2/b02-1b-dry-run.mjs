#!/usr/bin/env node
/**
 * B02-1B 真实数据副本 dry-run：
 * 1. 只从 --source 读取，复制到 --work（不会写真实目录）。
 * 2. 对副本做清单 SHA256、任务/项目/画布计数、quick_check、Key 密文标记检查。
 * 3. 应用迁移请把 <install>/data-dir 指向 --work 后启动，再运行 `--verify --work <work>`。
 */
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

function parseArgs(argv) {
  const args = { source: '', work: '', verify: false, pretty: false }
  for (let i = 2; i < argv.length; i++) {
    const value = argv[i]
    if (value === '--source') args.source = argv[++i] ?? ''
    else if (value === '--work') args.work = argv[++i] ?? ''
    else if (value === '--verify') args.verify = true
    else if (value === '--pretty') args.pretty = true
    else if (value === '--help' || value === '-h') args.help = true
    else throw new Error(`未知参数：${value}`)
  }
  return args
}

function walk(root, current = root, files = []) {
  for (const entry of readdirSync(current)) {
    const path = join(current, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(root, path, files)
    else files.push({ path: relative(root, path).replace(/\\/g, '/'), bytes: stat.size })
  }
  return files
}

function manifest(root) {
  const files = walk(root).sort((a, b) => a.path.localeCompare(b.path))
  const hash = createHash('sha256')
  let bytes = 0
  for (const file of files) {
    hash.update(`${file.path}\0${file.bytes}\0`)
    hash.update(readFileSync(join(root, file.path)))
    bytes += file.bytes
  }
  return { files: files.length, bytes, sha256: hash.digest('hex') }
}

const PLAINTEXT_SECRET_PATTERNS = [
  /"apiKey"\s*:\s*"sk-[A-Za-z0-9._-]{16,}"/g,
  /(?<![A-Za-z0-9])sk-[A-Za-z0-9._-]{16,}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{16,}/g,
]

function countPlaintextSecrets(text) {
  return PLAINTEXT_SECRET_PATTERNS.reduce((count, pattern) => count + (text.match(pattern)?.length ?? 0), 0)
}

function scanPlaintextFiles(root) {
  let plaintextSecretBytes = 0
  const files = []
  for (const name of ['data.db', 'data.db-wal', 'data.db-shm']) {
    const path = join(root, name)
    if (!existsSync(path)) continue
    const text = readFileSync(path).toString('latin1')
    const count = countPlaintextSecrets(text)
    if (count > 0) files.push({ name, count })
    plaintextSecretBytes += count
    // UTF-16LE 也扫一遍，避免字符串以宽字符落盘
    const wide = readFileSync(path).toString('utf16le')
    const wideCount = countPlaintextSecrets(wide)
    if (wideCount > 0) files.push({ name: `${name} (UTF-16LE)`, count: wideCount })
    plaintextSecretBytes += wideCount
  }
  return { plaintextSecretBytes, files }
}

function inspect(root) {
  const dbPath = join(root, 'data.db')
  if (!existsSync(dbPath)) throw new Error(`副本缺少 data.db：${dbPath}`)
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const quick = db.prepare('PRAGMA quick_check(1)').get()
    const tasks = db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count
    const kvRows = db.prepare('SELECT key, value FROM kv').all()
    const settingsRow = kvRows.find((row) => row.key === 'gpt-image-playground')
    const settings = settingsRow ? JSON.parse(settingsRow.value) : null
    const state = settings?.state ?? settings
    const currentSettings = state?.settings ?? null
    const raw = settingsRow?.value ?? ''
    const workspaceRow = kvRows.find((row) => row.key === 'panpan-workspace-v1')
    const workspace = workspaceRow ? JSON.parse(workspaceRow.value) : null
    return {
      quickCheck: Object.values(quick ?? {})[0] ?? quick,
      taskCount: tasks,
      projectCount: Array.isArray(workspace?.projects) ? workspace.projects.length : 0,
      canvasCount: Array.isArray(workspace?.canvases) ? workspace.canvases.length : 0,
      profileCount: Array.isArray(currentSettings?.profiles) ? currentSettings.profiles.length : 0,
      encryptedApiKeyMarkers: (raw.match(/dpapi:v1:/g) ?? []).length,
      plaintextApiKeyFields: Array.isArray(currentSettings?.profiles)
        ? currentSettings.profiles.filter((profile) => typeof profile.apiKey === 'string' && profile.apiKey && !profile.apiKey.startsWith('dpapi:v1:')).length
        : 0,
      hasPlainSk: countPlaintextSecrets(raw) > 0,
      backupCount: existsSync(join(root, 'backups')) ? readdirSync(join(root, 'backups')).length : 0,
    }
  } finally {
    db.close()
  }
}

const args = parseArgs(process.argv)
if (args.help || !args.work || (!args.source && !args.verify)) {
  console.log('用法：node scripts/u2/b02-1b-dry-run.mjs --source <真实 data 目录> --work <副本目录> [--pretty]')
  console.log('迁移后复核：node scripts/u2/b02-1b-dry-run.mjs --verify --work <副本目录> [--pretty]')
  process.exit(args.help ? 0 : 1)
}
if (!existsSync(args.work)) mkdirSync(args.work, { recursive: true })

if (!args.verify) {
  if (!existsSync(args.source)) throw new Error(`真实数据目录不存在：${args.source}`)
  if (args.work === args.source) throw new Error('--work 不能与 --source 相同')
  if (readdirSync(args.work).length > 0) throw new Error(`副本目录必须为空：${args.work}`)
  cpSync(args.source, args.work, { recursive: true })
  const sourceManifest = manifest(args.source)
  const workManifest = manifest(args.work)
  if (sourceManifest.sha256 !== workManifest.sha256) throw new Error('复制后的副本清单与源不一致')
  console.log(JSON.stringify({
    mode: 'copy',
    source: args.source,
    work: args.work,
    sourceManifest,
    workManifest,
    before: inspect(args.work),
    next: '把 <install>/data-dir 指向 work 后启动应用完成迁移，再运行 --verify。',
  }, null, args.pretty ? 2 : 0))
} else {
  const rawScan = scanPlaintextFiles(args.work)
  console.log(JSON.stringify({
    mode: 'verify',
    work: args.work,
    manifest: manifest(args.work),
    after: inspect(args.work),
    plaintextSecretBytes: rawScan.plaintextSecretBytes,
    plaintextFiles: rawScan.files,
    checks: {
      apiKeyEncrypted: 'encryptedApiKeyMarkers > 0 且 plaintextApiKeyFields = 0',
      noPlainSkInKv: 'hasPlainSk = false',
      noPlaintextSecretBytes: 'plaintextSecretBytes = 0（含 data.db / data.db-wal / data.db-shm）',
      quickCheck: 'quickCheck = ok',
    },
  }, null, args.pretty ? 2 : 0))
}
