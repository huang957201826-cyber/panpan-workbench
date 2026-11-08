#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'

const TRIGGERS = ['b02_fail_task_insert', 'b02_fail_task_update']

function parseArgs(argv) {
  const args = { db: process.env.PANPAN_U2_FAIL_DB || '', action: '', verify: false }
  for (let i = 2; i < argv.length; i++) {
    const value = argv[i]
    if (value === '--db') args.db = argv[++i] ?? ''
    else if (value === '--create') args.action = 'create'
    else if (value === '--drop') args.action = 'drop'
    else if (value === '--list') args.action = 'list'
    else if (value === '--verify') args.verify = true
    else if (value === '--help' || value === '-h') args.help = true
    else throw new Error(`未知参数：${value}`)
  }
  return args
}

function supportsJsonExtract(db) {
  try {
    db.prepare("SELECT json_extract('{\"status\":\"done\"}', '$.status') AS value").get()
    return true
  } catch {
    return false
  }
}

function markerCondition(useJson) {
  const done = useJson
    ? "json_extract(NEW.data, '$.status') = 'done'"
    : "instr(NEW.data, '\"status\":\"done\"') > 0"
  return `instr(NEW.data, '__B02_FAIL__') > 0 AND ${done}`
}

const args = parseArgs(process.argv)
if (args.help || !args.db || !args.action) {
  console.log('用法：node scripts/u2/fail-task-write.mjs --db <fail-data/data.db> --create|--drop|--list [--verify]')
  console.log('触发器只在任务 data 含 __B02_FAIL__ 且 status 为 done 时中止 tasks 写入；创建/删除前应先关闭应用。')
  process.exit(args.help ? 0 : 1)
}
if (!existsSync(args.db)) {
  console.error(`数据库不存在：${args.db}`)
  process.exit(1)
}

const db = new DatabaseSync(args.db)
try {
  if (args.action === 'list') {
    const triggers = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name IN (?, ?) ORDER BY name")
      .all(...TRIGGERS)
    console.log(JSON.stringify({ triggers }, null, 2))
  } else if (args.action === 'drop') {
    for (const name of TRIGGERS) db.exec(`DROP TRIGGER IF EXISTS ${name}`)
    console.log(JSON.stringify({ dropped: TRIGGERS }, null, 2))
  } else {
    const useJson = supportsJsonExtract(db)
    const condition = markerCondition(useJson)
    for (const name of TRIGGERS) db.exec(`DROP TRIGGER IF EXISTS ${name}`)
    db.exec(`CREATE TRIGGER b02_fail_task_insert
      BEFORE INSERT ON tasks
      WHEN ${condition}
      BEGIN
        SELECT RAISE(ABORT, 'injected task write failure');
      END`)
    db.exec(`CREATE TRIGGER b02_fail_task_update
      BEFORE UPDATE ON tasks
      WHEN ${condition}
      BEGIN
        SELECT RAISE(ABORT, 'injected task write failure');
      END`)

    let verified = null
    if (args.verify) {
      db.exec('SAVEPOINT b02_verify')
      try {
        db.prepare('INSERT INTO tasks (id, data, updated_at) VALUES (?, ?, ?)')
          .run('__b02_fail_verify__', JSON.stringify({ status: 'done', prompt: '__B02_FAIL__' }), Date.now())
        verified = 'not-blocked'
      } catch (err) {
        verified = String(err?.message ?? err)
      } finally {
        db.exec('ROLLBACK TO b02_verify')
        db.exec('RELEASE b02_verify')
      }
    }
    console.log(JSON.stringify({ created: TRIGGERS, useJsonExtract: useJson, verified }, null, 2))
  }
} finally {
  db.close()
}
