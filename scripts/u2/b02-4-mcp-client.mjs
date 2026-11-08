#!/usr/bin/env node
/**
 * B02-4 MCP 客户端自检：
 *   node scripts/u2/b02-4-mcp-client.mjs --url http://127.0.0.1:7331/mcp --token <token>
 *   node scripts/u2/b02-4-mcp-client.mjs --exe "<path>/gpt-image-playground.exe" --stdio
 *
 * HTTP 模式验证 initialize / tools/list / tools/call(task.list)；
 * stdio 模式 spawn <exe> --mcp-stdio 并验证 task.list。
 */
import { spawn } from 'node:child_process'
import process from 'node:process'

const args = process.argv.slice(2)
const get = (name, fallback = '') => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] ?? fallback : fallback
}

const url = get('--url', 'http://127.0.0.1:7331/mcp')
const token = get('--token', process.env.MCP_TOKEN ?? '')
const exe = get('--exe', '')
const stdioMode = args.includes('--stdio')
const protocolVersion = '2025-06-18'

function fail(message) {
  console.error(`MCP 自检失败：${message}`)
  process.exit(1)
}

function parsePayload(text, contentType) {
  if (contentType.includes('text/event-stream')) {
    const data = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean)
      .at(-1)
    if (!data) throw new Error('SSE 响应没有 data 行')
    return JSON.parse(data)
  }
  return JSON.parse(text)
}

async function httpRpc(state, method, params, notification = false) {
  const body = notification
    ? { jsonrpc: '2.0', method, params }
    : { jsonrpc: '2.0', id: ++state.id, method, params }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(state.sessionId ? { 'mcp-session-id': state.sessionId } : {}),
    },
    body: JSON.stringify(body),
  })
  const session = response.headers.get('mcp-session-id')
  if (session) state.sessionId = session
  if (notification && response.status === 202) return null
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  const text = await response.text()
  if (!text.trim()) return null
  const payload = parsePayload(text, response.headers.get('content-type') ?? '')
  if (payload.error) throw new Error(`JSON-RPC ${payload.error.code}: ${payload.error.message}`)
  return payload.result
}

async function checkHttp() {
  if (!token) fail('缺少 --token')
  const state = { id: 0, sessionId: '' }
  const init = await httpRpc(state, 'initialize', {
    protocolVersion,
    capabilities: {},
    clientInfo: { name: 'b02-4-mcp-client', version: '1.0.0' },
  })
  if (!init?.serverInfo?.name) fail('initialize 返回缺少 serverInfo')
  console.log(`initialize: ${init.serverInfo.name} ${init.serverInfo.version ?? ''}`)
  await httpRpc(state, 'notifications/initialized', {}, true)
  const list = await httpRpc(state, 'tools/list', {})
  const names = (list?.tools ?? []).map((tool) => tool.name)
  for (const required of ['task.list', 'settings.get']) {
    if (!names.includes(required)) fail(`tools/list 缺少 ${required}`)
  }
  console.log(`tools/list: ${names.length} 个工具`)
  const result = await httpRpc(state, 'tools/call', { name: 'task.list', arguments: { limit: 1, offset: 0 } })
  const text = result?.content?.find((part) => part.type === 'text')?.text
  if (!text) fail('task.list 没有 text 结果')
  const parsed = JSON.parse(text)
  if (typeof parsed.total !== 'number') fail('task.list 结果缺少 total')
  console.log(`task.list: total=${parsed.total}, items=${parsed.items?.length ?? 0}`)
}

async function checkStdio() {
  if (!exe) fail('stdio 模式需要 --exe')
  const child = spawn(exe, ['--mcp-stdio'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  let buffer = ''
  const pending = new Map()
  let id = 0
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    let index
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (!line) continue
      try {
        const message = JSON.parse(line)
        if (message.id && pending.has(message.id)) {
          pending.get(message.id)(message)
          pending.delete(message.id)
        }
      } catch {
        // 忽略非 JSON 输出
      }
    }
  })
  child.stderr.on('data', (chunk) => process.stderr.write(chunk))
  const request = (method, params, notification = false) => new Promise((resolve, reject) => {
    const message = notification
      ? { jsonrpc: '2.0', method, params }
      : { jsonrpc: '2.0', id: ++id, method, params }
    if (!notification) {
      const timer = setTimeout(() => reject(new Error(`${method} 超时`)), 15000)
      pending.set(message.id, (response) => {
        clearTimeout(timer)
        if (response.error) reject(new Error(response.error.message))
        else resolve(response.result)
      })
    }
    child.stdin.write(`${JSON.stringify(message)}\n`)
    if (notification) resolve(null)
  })
  const init = await request('initialize', {
    protocolVersion,
    capabilities: {},
    clientInfo: { name: 'b02-4-mcp-client', version: '1.0.0' },
  })
  if (!init?.serverInfo?.name) fail('stdio initialize 返回缺少 serverInfo')
  console.log(`stdio initialize: ${init.serverInfo.name}`)
  await request('notifications/initialized', {}, true)
  const list = await request('tools/list', {})
  const names = (list?.tools ?? []).map((tool) => tool.name)
  if (!names.includes('task.list')) fail('stdio tools/list 缺少 task.list')
  console.log(`stdio tools/list: ${names.length} 个工具`)
  const result = await request('tools/call', { name: 'task.list', arguments: { limit: 1 } })
  const text = result?.content?.find((part) => part.type === 'text')?.text
  if (!text) fail('stdio task.list 没有 text 结果')
  const parsed = JSON.parse(text)
  console.log(`stdio task.list: total=${parsed.total}`)
  const write = await request('tools/call', { name: 'task.create', arguments: { prompt: 'x' } })
  const writeText = write?.content?.find((part) => part.type === 'text')?.text ?? ''
  if (!writeText.includes('stdio 不支持写入')) fail('stdio 写入工具没有明确拒绝')
  console.log('stdio write rejected')
  child.kill()
}

try {
  if (stdioMode) await checkStdio()
  else await checkHttp()
  console.log('MCP 自检通过')
} catch (err) {
  fail(err instanceof Error ? err.message : String(err))
}
