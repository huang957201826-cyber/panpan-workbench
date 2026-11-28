#!/usr/bin/env node
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const source = resolve(process.env.SKILL_KIT || process.env.LOVART_SKILL_KIT || join(homedir(), 'lovart-skill-kit'))
const dest = resolve('public/skill-kit')
const sourceManifestPath = join(source, 'MANIFEST.json')
const destManifestPath = join(dest, 'MANIFEST.json')

if (existsSync(sourceManifestPath)) {
  const manifest = JSON.parse(readFileSync(sourceManifestPath, 'utf8'))
  rmSync(dest, { recursive: true, force: true })
  cpSync(source, dest, { recursive: true })
  console.log(`[skill-kit] 已同步 ${manifest.skills?.length ?? 0} 条技能到 public/skill-kit（源包只读，未修改）。`)
} else if (!existsSync(destManifestPath)) {
  console.warn(`[skill-kit] 未找到技能包：${sourceManifestPath}；跳过同步，应用会显示“未找到技能包”。`)
  process.exit(0)
}

const manifest = JSON.parse(readFileSync(destManifestPath, 'utf8'))
if (Array.isArray(manifest.skills) && manifest.skills.length > 0) {
  const skills = manifest.skills.map((item) => {
    const base = item.path.endsWith('/') ? item.path : `${item.path}/`
    const skill = JSON.parse(readFileSync(join(dest, `${base}skill.json`), 'utf8'))
    const prompt = readFileSync(join(dest, `${base}prompt.md`), 'utf8')
    return { key: skill.key, skill, prompt }
  })
  const bundlePath = join(dest, 'BUNDLE.json')
  writeFileSync(bundlePath, JSON.stringify({ manifest, skills }), 'utf8')
  console.log(`[skill-kit] 已生成合并索引 public/skill-kit/BUNDLE.json（共 ${skills.length} 条技能，单次请求即可加载）。`)
}

await import('./build-pro-skills-pack.mjs')


