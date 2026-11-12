#!/usr/bin/env node
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const source = resolve(process.env.SKILL_KIT || process.env.LOVART_SKILL_KIT || join(homedir(), 'lovart-skill-kit'))
const dest = resolve('public/skill-kit')
const manifestPath = join(source, 'MANIFEST.json')

if (!existsSync(manifestPath)) {
  console.warn(`[skill-kit] 未找到技能包：${manifestPath}；跳过同步，应用会显示“未找到技能包”。`)
  process.exit(0)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
rmSync(dest, { recursive: true, force: true })
cpSync(source, dest, { recursive: true })
console.log(`[skill-kit] 已同步 ${manifest.skills?.length ?? 0} 条技能到 public/skill-kit（源包只读，未修改）。`)
