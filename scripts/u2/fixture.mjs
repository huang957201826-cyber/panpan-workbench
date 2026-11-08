#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'

const MINUTE = 60 * 1000

function parseArgs(argv) {
  const args = { db: process.env.PANPAN_U2_FIXTURE_DB || '', settingsDb: '', profile: 'mock-custom-async', now: Date.now() }
  for (let i = 2; i < argv.length; i++) {
    const value = argv[i]
    if (value === '--db') args.db = argv[++i] ?? ''
    else if (value === '--settings-db') args.settingsDb = argv[++i] ?? ''
    else if (value === '--profile') args.profile = argv[++i] ?? ''
    else if (value === '--now') args.now = Number(argv[++i])
    else if (value === '--help' || value === '-h') args.help = true
    else throw new Error(`未知参数：${value}`)
  }
  return args
}

function readJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function readSettings(db) {
  const row = db.prepare("SELECT value FROM kv WHERE key = 'gpt-image-playground'").get()
  if (!row) throw new Error('kv 中没有 gpt-image-playground 设置，无法读取 mock-custom-async 配置')
  const persisted = readJson(row.value)
  const state = persisted?.state ?? persisted
  const settings = state?.settings ?? null
  if (!settings) throw new Error('设置中没有 settings 字段')
  return settings
}

function findMockProfile(settings, wanted) {
  const profiles = Array.isArray(settings.profiles) ? settings.profiles : []
  const profile = profiles.find((item) => item.id === wanted || item.name === wanted)
    ?? profiles.find((item) => String(item.id).includes(wanted) || String(item.name).includes(wanted))
  if (!profile) throw new Error(`找不到配置：${wanted}`)
  if (profile.provider === 'openai' || profile.provider === 'fal') {
    throw new Error(`配置 ${profile.id} 的 provider 是 ${profile.provider}，不是自定义异步服务商`)
  }
  const customProviders = Array.isArray(settings.customProviders) ? settings.customProviders : []
  const provider = customProviders.find((item) => item.id === profile.provider)
  if (!provider?.poll) throw new Error(`配置 ${profile.id} 对应的服务商 ${profile.provider} 缺少 poll 定义`)
  return { profile, provider }
}

function buildFixtureTask({ id, prompt, startedAt, createdAt, profile }) {
  return {
    id,
    prompt,
    params: { n: 1, size: '1024x1024', quality: 'auto', output_format: 'png' },
    apiProvider: profile.provider,
    apiProfileId: profile.id,
    apiProfileName: profile.name,
    apiMode: profile.apiMode,
    apiModel: profile.model,
    inputImageIds: [],
    maskTargetImageId: null,
    maskImageId: null,
    outputImages: [],
    status: 'running',
    error: null,
    createdAt,
    startedAt,
    finishedAt: null,
    elapsed: null,
    customTaskId: `mock:async-pending:${createdAt}`,
    customRecoverable: false,
    sourceMode: 'gallery',
  }
}

const args = parseArgs(process.argv)
if (args.help || !args.db) {
  console.log('用法：node scripts/u2/fixture.mjs --db <fixture-data/data.db> [--settings-db <主测试库 data.db>] [--profile mock-custom-async] [--now <毫秒>]')
  console.log('从主测试库 kv 读取指定自定义异步配置，向 fixture 库插入 31 分钟与 29 分钟两条 running 任务。')
  process.exit(args.help ? 0 : 1)
}
if (!existsSync(args.db)) {
  console.error(`fixture 数据库不存在：${args.db}`)
  process.exit(1)
}
const settingsPath = args.settingsDb || args.db
if (!existsSync(settingsPath)) {
  console.error(`设置数据库不存在：${settingsPath}`)
  process.exit(1)
}

const settingsDb = settingsPath === args.db ? null : new DatabaseSync(settingsPath, { readOnly: true })
const targetDb = new DatabaseSync(args.db)

try {
  const settings = readSettings(settingsDb ?? targetDb)
  const { profile, provider } = findMockProfile(settings, args.profile)
  const now = Number.isFinite(args.now) ? args.now : Date.now()
  const expired = buildFixtureTask({
    id: `b02-fixture-31m-${now}`,
    prompt: '__B02_FIXTURE_31M__',
    startedAt: now - 31 * MINUTE,
    createdAt: now - 31 * MINUTE,
    profile,
  })
  const nearDeadline = buildFixtureTask({
    id: `b02-fixture-29m-${now}`,
    prompt: '__B02_FIXTURE_29M__',
    startedAt: now - 29 * MINUTE,
    createdAt: now - 29 * MINUTE,
    profile,
  })

  const insert = targetDb.prepare('INSERT OR REPLACE INTO tasks (id, data, updated_at) VALUES (?, ?, ?)')
  for (const task of [expired, nearDeadline]) {
    insert.run(task.id, JSON.stringify(task), now)
  }

  console.log(JSON.stringify({
    inserted: [expired.id, nearDeadline.id],
    profile: { id: profile.id, name: profile.name, provider: profile.provider },
    providerHasPoll: Boolean(provider.poll),
    now,
    expiredTaskId: expired.id,
    nearDeadlineTaskId: nearDeadline.id,
  }, null, 2))
} finally {
  settingsDb?.close()
  targetDb.close()
}
