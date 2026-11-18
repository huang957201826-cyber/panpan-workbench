import fs from 'node:fs'
import path from 'node:path'

const FILES = [
  {
    page: '工作流',
    files: [
      'src/studio/modules/workflow/ComfyWorkflowView.tsx',
      'src/studio/components/WorkflowHub.tsx',
      'src/studio/components/WorkflowProjectPicker.tsx',
      'src/studio/components/LocalEngineCard.tsx',
    ],
  },
  {
    page: '设置',
    files: [
      'src/studio/modules/settings/SettingsModal.tsx',
      'src/components/settings/McpSettingsSection.tsx',
      'src/components/settings/StorageInfoSection.tsx',
      'src/components/settings/DeleteBackupSection.tsx',
    ],
  },
  {
    page: '技能',
    files: [
      'src/studio/components/SkillHubHost.tsx',
      'src/studio/modules/skills/SkillHubView.tsx',
      'src/studio/components/SkillPickerModal.tsx',
    ],
  },
  {
    page: '侧栏与标题栏',
    files: ['src/studio/components/AppSidebar.tsx', 'src/studio/components/TitleBar.tsx'],
  },
]

function labelOf(block) {
  const aria = block.match(/aria-label="([^"]+)"/)
  if (aria) return aria[1]
  const title = block.match(/title="([^"]+)"/)
  if (title) return title[1]
  const tail = block.slice(0, block.lastIndexOf('</button>'))
  const text = tail
    .slice(tail.lastIndexOf('>') + 1)
    .replace(/\{[^{}]*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, 48) || '(无文案)'
}

function onClickBody(block) {
  const match = block.match(/onClick=\{([\s\S]*?)\n\s*\}/)
  if (match) return match[1]
  const inline = block.match(/onClick=\{([^}]*)\}/)
  return inline ? inline[1] : ''
}

function isSuspicious(body, block) {
  if (!body) return false
  const compact = body.trim()
  if (!compact) return true
  const onlyToast = /^(showToast|notifyUser)\s*\(/.test(compact) && !/\b(set[A-Z]|on[A-Z]|handle[A-Z]|await|void|fetch|invoke)\b/.test(compact)
  return onlyToast && !/onMouseDown|onPointerDown/.test(block)
}

const rows = []
for (const group of FILES) {
  for (const file of group.files) {
    if (!fs.existsSync(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    const blocks = text.match(/<button[\s\S]*?<\/button>/g) ?? []
    for (const block of blocks) {
      const label = labelOf(block)
      const hasHandler = /on(?:Click|MouseDown|PointerDown)=/.test(block)
      const submit = /type="submit"/.test(block)
      const disabled = /disabled(?:=|\s|>)/.test(block)
      const body = onClickBody(block)
      rows.push({
        page: group.page,
        file: path.basename(file),
        label,
        onClick: hasHandler || submit,
        disabled,
        suspicious: !disabled && isSuspicious(body, block),
      })
    }
  }
}

const count = (predicate) => rows.filter(predicate).length
const byPage = [...new Set(rows.map((row) => row.page))].map((page) => {
  const list = rows.filter((row) => row.page === page)
  return { page, total: list.length, disabled: list.filter((row) => row.disabled).length, suspicious: list.filter((row) => row.suspicious).length }
})

const lines = [
  '# 控件清单（2026-11-17）',
  '',
  `- 扫描文件：${FILES.reduce((sum, group) => sum + group.files.length, 0)} 个`,
  `- 按钮总数：${rows.length}`,
  `- 无 onClick 且非 disabled：${count((row) => !row.onClick && !row.disabled)}`,
  `- 疑似只有 setState / toast 的假动作：${count((row) => row.suspicious)}`,
  '',
  '## 按页面',
  '',
  '| 页面 | 按钮 | disabled | 疑似假动作 |',
  '|---|---:|---:|---:|',
  ...byPage.map((item) => `| ${item.page} | ${item.total} | ${item.disabled} | ${item.suspicious} |`),
  '',
  '## 明细',
  '',
  '| 页面 | 文件 | 按钮文案 | onClick | disabled | 疑似假动作 |',
  '|---|---|---|---|---|---|',
  ...rows.map((row) =>
    `| ${row.page} | ${row.file} | ${row.label.replace(/\|/g, '\\|')} | ${row.onClick ? '有' : '无'} | ${row.disabled ? '是' : ''} | ${row.suspicious ? '是' : ''} |`,
  ),
  '',
]

fs.mkdirSync('docs/execution', { recursive: true })
fs.writeFileSync('docs/execution/CONTROLS-20261117.md', lines.join('\n'), 'utf8')
console.log(`控件清单：${rows.length} 个按钮；无 onClick 且非 disabled ${count((row) => !row.onClick && !row.disabled)}；疑似假动作 ${count((row) => row.suspicious)}`)
console.log('已写入 docs/execution/CONTROLS-20261117.md')
