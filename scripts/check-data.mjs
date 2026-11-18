#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite'

const path = process.argv[2]
if (!path) {
  console.error('用法：node scripts/check-data.mjs <data.db>')
  process.exit(2)
}

const db = new DatabaseSync(path, { readOnly: true })
const quickCheck = db.prepare('PRAGMA quick_check').all()
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name)
const count = (table) => tables.includes(table)
  ? db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n
  : null

console.log(JSON.stringify({
  path,
  quickCheck,
  tasks: count('tasks'),
  images: count('images'),
  tables,
}, null, 2))
