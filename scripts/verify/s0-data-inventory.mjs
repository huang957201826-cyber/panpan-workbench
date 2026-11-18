import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const dataDir = path.resolve(
  process.argv[2] ??
    'E:/02-RUANJIAN/67-盼盼工作台/PanPan Workbench/data',
)
const dbPath = path.join(dataDir, 'data.db')

function fileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(fullPath))
    else if (entry.isFile()) files.push(fullPath)
  }
  return files
}

function directoryStats(dir) {
  const files = walkFiles(dir)
  return {
    exists: fs.existsSync(dir),
    files: files.length,
    bytes: files.reduce((total, filePath) => {
      try {
        return total + fs.statSync(filePath).size
      } catch {
        return total
      }
    }, 0),
  }
}

function duplicates(values) {
  const seen = new Set()
  const repeated = new Set()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    else seen.add(value)
  }
  return [...repeated].sort()
}

function parseJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function readTextVariants(filePath) {
  const bytes = fs.readFileSync(filePath)
  return `${bytes.toString('latin1')}\n${bytes.toString('utf16le')}`
}

function uniqueMatches(text, pattern) {
  return [...new Set([...text.matchAll(pattern)].map((match) => match[0]))].sort()
}

if (!fs.existsSync(dbPath)) throw new Error(`Database not found: ${dbPath}`)

const db = new DatabaseSync(dbPath, { readOnly: true })
const tableNames = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  .all()
  .map((row) => row.name)
const counts = Object.fromEntries(
  tableNames.map((table) => [
    table,
    db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count,
  ]),
)
const kv = Object.fromEntries(
  db.prepare('SELECT key, value FROM kv').all().map((row) => [row.key, row.value]),
)
const meta = Object.fromEntries(
  db.prepare('SELECT key, value FROM meta').all().map((row) => [row.key, row.value]),
)
const tasks = db
  .prepare('SELECT id, data FROM tasks ORDER BY id')
  .all()
  .map((row) => ({ id: row.id, ...parseJson(row.data) }))
const images = db
  .prepare('SELECT id FROM images ORDER BY id')
  .all()
  .map((row) => ({ id: row.id }))
const integrity = db.prepare('PRAGMA integrity_check').get()
const quickCheck = db.prepare('PRAGMA quick_check').get()
db.close()

const workspace = parseJson(kv['panpan-workspace-v1'] ?? '')?.state ?? {}
const capability = parseJson(kv['panpan-capability-skills-v1'] ?? '')?.state ?? {}
const promptSkills = parseJson(kv['panpan-prompt-skills-v1'] ?? '')?.state ?? {}
const projects = Array.isArray(workspace.projects) ? workspace.projects : []
const canvases = Array.isArray(workspace.canvases) ? workspace.canvases : []
const capabilitySkills = Array.isArray(capability.mine) ? capability.mine : []
const promptSkillItems = Array.isArray(promptSkills.skills) ? promptSkills.skills : []

const referencedImageIds = new Set()
for (const task of tasks) {
  for (const id of [
    ...(Array.isArray(task.inputImageIds) ? task.inputImageIds : []),
    ...(Array.isArray(task.outputImages) ? task.outputImages : []),
    ...(Array.isArray(task.transparentOriginalImages) ? task.transparentOriginalImages : []),
    ...(Array.isArray(task.streamPartialImageIds) ? task.streamPartialImageIds : []),
    ...(task.maskImageId ? [task.maskImageId] : []),
  ]) {
    if (typeof id === 'string' && id) referencedImageIds.add(id)
  }
}
for (const canvas of canvases) {
  for (const node of Array.isArray(canvas.imageNodes) ? canvas.imageNodes : []) {
    if (typeof node.imageId === 'string' && node.imageId) referencedImageIds.add(node.imageId)
  }
}
for (const skill of [...capabilitySkills, ...promptSkillItems]) {
  for (const id of [
    ...(skill.coverImageId ? [skill.coverImageId] : []),
    ...(Array.isArray(skill.referenceImageIds) ? skill.referenceImageIds : []),
  ]) {
    if (typeof id === 'string' && id) referencedImageIds.add(id)
  }
}

const storedImageIds = new Set(images.map((image) => image.id))
const missingImageIds = [...referencedImageIds].filter((id) => !storedImageIds.has(id)).sort()
const orphanImageIds = [...storedImageIds].filter((id) => !referencedImageIds.has(id)).sort()

const webviewRoot = path.join(dataDir, 'webview', 'EBWebView')
const localStorageRoot = path.join(webviewRoot, 'Default', 'Local Storage', 'leveldb')
const indexedDbRoot = path.join(webviewRoot, 'Default', 'IndexedDB')
const localStorageFiles = walkFiles(localStorageRoot).filter(
  (filePath) => /\.(log|ldb)$/i.test(filePath),
)
let workflowKeyFound = false
const workflowIds = new Set()
const workflowResultImageIds = new Set()
for (const filePath of localStorageFiles) {
  const text = readTextVariants(filePath)
  if (text.includes('panpan-project-workflows-v1')) workflowKeyFound = true
  for (const value of uniqueMatches(text, /wf-[0-9a-z]+-[a-z0-9]{4}/gi)) {
    workflowIds.add(value)
  }
  for (const value of uniqueMatches(
    text,
    /wfi-[0-9a-z]+-[0-9a-f]{8}-[0-9a-f-]{27}/gi,
  )) {
    workflowResultImageIds.add(value)
  }
}

const indexedDbFiles = walkFiles(indexedDbRoot)
let workflowIndexedDbKeyFound = false
for (const filePath of indexedDbFiles) {
  try {
    if (readTextVariants(filePath).includes('panpan-workflow-results')) {
      workflowIndexedDbKeyFound = true
      break
    }
  } catch {
    // 运行中的数据库可能短暂锁定；存在性仍由目录记录。
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  dataDirId: crypto.createHash('sha256').update(dataDir).digest('hex').slice(0, 16),
  database: {
    sha256: fileSha256(dbPath),
    bytes: fs.statSync(dbPath).size,
    walBytes: fs.existsSync(`${dbPath}-wal`) ? fs.statSync(`${dbPath}-wal`).size : 0,
    integrity,
    quickCheck,
    tables: counts,
    metaKeys: Object.keys(meta).sort(),
    kvKeys: Object.entries(kv)
      .map(([key, value]) => ({ key, valueLength: value.length }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  },
  workspace: {
    projectCount: projects.length,
    canvasCount: canvases.length,
    duplicateProjectIds: duplicates(projects.map((project) => project.id)),
    duplicateCanvasIds: duplicates(canvases.map((canvas) => canvas.id)),
    orphanCanvasCount: canvases.filter(
      (canvas) => !projects.some((project) => project.id === canvas.projectId),
    ).length,
    imageNodeCount: canvases.reduce(
      (total, canvas) => total + (canvas.imageNodes?.length ?? 0),
      0,
    ),
  },
  tasks: {
    total: tasks.length,
    statusCounts: tasks.reduce((result, task) => {
      const status = task.status ?? 'unknown'
      result[status] = (result[status] ?? 0) + 1
      return result
    }, {}),
  },
  images: {
    stored: images.length,
    referenced: referencedImageIds.size,
    missingReferenceCount: missingImageIds.length,
    orphanCount: orphanImageIds.length,
    missingReferenceIds: missingImageIds,
    orphanIds: orphanImageIds,
  },
  skills: {
    capabilityMine: capabilitySkills.length,
    promptSkills: promptSkillItems.length,
    duplicateNames: duplicates(
      [...capabilitySkills, ...promptSkillItems]
        .map((skill) => skill.name ?? skill.title ?? '')
        .filter(Boolean),
    ),
  },
  workflowStorage: {
    localStorageKeyFound: workflowKeyFound,
    workflowIdCount: workflowIds.size,
    workflowResultImageIdCount: workflowResultImageIds.size,
    indexedDbKeyFound: workflowIndexedDbKeyFound,
  },
  filesystem: {
    images: directoryStats(path.join(dataDir, 'images')),
    thumbnails: directoryStats(path.join(dataDir, 'thumbnails')),
    backups: directoryStats(path.join(dataDir, 'backups')),
    logs: directoryStats(path.join(dataDir, 'logs')),
    localWebStorage: directoryStats(localStorageRoot),
    workflowIndexedDb: directoryStats(indexedDbRoot),
  },
}

console.log(JSON.stringify(output, null, 2))
