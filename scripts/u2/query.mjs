#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'

function parseArgs(argv) {
  const args = { db: process.env.PANPAN_U2_DB || '', pretty: false }
  for (let i = 2; i < argv.length; i++) {
    const value = argv[i]
    if (value === '--db') args.db = argv[++i] ?? ''
    else if (value === '--pretty') args.pretty = true
    else if (value === '--help' || value === '-h') args.help = true
    else throw new Error(`未知参数：${value}`)
  }
  return args
}

function readJson(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function taskStatus(data) {
  return typeof data?.status === 'string' ? data.status : 'unknown'
}

function summarize(db) {
  const tasks = db.prepare('SELECT id, data, updated_at FROM tasks ORDER BY updated_at DESC').all()
  const kv = db.prepare('SELECT key, value, updated_at FROM kv ORDER BY key').all()
  const statusCounts = {}
  const taskSummaries = []
  for (const row of tasks) {
    const data = readJson(row.data)
    const status = taskStatus(data)
    statusCounts[status] = (statusCounts[status] || 0) + 1
    taskSummaries.push({
      id: row.id,
      status,
      prompt: typeof data?.prompt === 'string' ? data.prompt : '',
      updatedAt: row.updated_at,
      hasCustomTaskId: Boolean(data?.customTaskId),
      customRecoverable: Boolean(data?.customRecoverable),
      hasFalRequest: Boolean(data?.falRequestId && data?.falEndpoint),
      falRecoverable: Boolean(data?.falRecoverable),
      outputImageCount: Array.isArray(data?.outputImages) ? data.outputImages.length : 0,
    })
  }

  const workspaceRow = kv.find((row) => row.key === 'panpan-workspace-v1')
  const workspace = readJson(workspaceRow?.value)
  const settingsRow = kv.find((row) => row.key === 'gpt-image-playground')
  const persisted = readJson(settingsRow?.value)
  const settingsState = persisted?.state ?? persisted
  const settings = settingsState?.settings ?? persisted ?? null

  return {
    db: true,
    taskCount: tasks.length,
    statusCounts,
    tasks: taskSummaries,
    kvKeys: kv.map((row) => row.key),
    workspace: workspace
      ? {
          projectCount: Array.isArray(workspace.projects) ? workspace.projects.length : 0,
          canvasCount: Array.isArray(workspace.canvases) ? workspace.canvases.length : 0,
          activeProjectId: workspace.activeProjectId ?? null,
          activeCanvasId: workspace.activeCanvasId ?? null,
        }
      : null,
    profiles: Array.isArray(settings?.profiles)
      ? settings.profiles.map((profile) => ({ id: profile.id, name: profile.name, provider: profile.provider }))
      : [],
    customProviders: Array.isArray(settings?.customProviders)
      ? settings.customProviders.map((provider) => ({ id: provider.id, name: provider.name, hasPoll: Boolean(provider.poll) }))
      : [],
    retryMode: settings?.retryMode ?? null,
    counts: {
      images: tableCount(db, 'images'),
      thumbnails: tableCount(db, 'thumbnails'),
      agentConversations: tableCount(db, 'agent_conversations'),
    },
    triggers: db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name").all().map((row) => row.name),
  }
}

function tableCount(db, table) {
  try {
    return db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count
  } catch {
    return null
  }
}

const args = parseArgs(process.argv)
if (args.help || !args.db) {
  console.log('用法：node scripts/u2/query.mjs --db <data.db 的副本路径> [--pretty]')
  console.log('默认读取环境变量 PANPAN_U2_DB。只应传入副本路径，不要直接打开真实 WAL 库。')
  process.exit(args.help ? 0 : 1)
}
if (!existsSync(args.db)) {
  console.error(`数据库不存在：${args.db}`)
  process.exit(1)
}

const db = new DatabaseSync(args.db, { readOnly: true })
try {
  const result = summarize(db)
  console.log(JSON.stringify(result, null, args.pretty ? 2 : 0))
} finally {
  db.close()
}
