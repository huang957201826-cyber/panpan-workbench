import fs from 'node:fs'
import path from 'node:path'

const FILES = [
  'src/studio/components/TitleBar.tsx',
  'src/studio/components/AppSidebar.tsx',
  'src/studio/components/WorkflowHub.tsx',
  'src/studio/components/SkillHubHost.tsx',
  'src/studio/modules/settings/SettingsModal.tsx',
  'src/studio/modules/skills/SkillHubView.tsx',
  'src/components/InputBar.tsx',
  'src/studio/components/BottomPromptBar.tsx',
]

const TEXT_PX = /text-\[\d+(?:\.\d+)?px\]/g
const LEADING = /leading-\[[^\]]+\]/g

let textCount = 0
let leadingCount = 0
const details = []

for (const file of FILES) {
  if (!fs.existsSync(file)) continue
  const text = fs.readFileSync(file, 'utf8')
  const texts = text.match(TEXT_PX) ?? []
  const leadings = text.match(LEADING) ?? []
  textCount += texts.length
  leadingCount += leadings.length
  if (texts.length || leadings.length) {
    details.push(`${file}: text-[数字px] ${texts.length}，leading-[...] ${leadings.length}`)
  }
}

console.log('排版扫描（六档令牌外的裸数值）')
console.log(`text-[数字px]：${textCount}`)
console.log(`leading-[...]：${leadingCount}`)
for (const line of details) console.log('  ' + line)
if (textCount || leadingCount) process.exitCode = 1
