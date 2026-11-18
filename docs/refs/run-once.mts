/**
 * 一次性实跑脚本：把保留的四条工作流各跑一遍，验证能否真正出图。
 * 用法：npx tsx docs/refs/run-once.mts
 * 前提：ComfyUI 在 127.0.0.1:8188，input 里有 su-sketch.png 与 mask-test.png
 */
import { WORKFLOWS } from '../../src/studio/workflows/manifest'
import { API_WORKFLOW_BY_ID } from '../../src/studio/workflows/apiWorkflows'
import { applyParamValues } from '../../src/studio/workflows/anchors'
import { clonePrompt, toSubmitPayload } from '../../src/lib/comfyPrompt'

const BASE = 'http://127.0.0.1:8188'
const IMAGE = 'su-sketch.png'
const MASK = 'mask-test.png'

async function submit(prompt: unknown): Promise<string> {
  const response = await fetch(`${BASE}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, client_id: `run-once-${Date.now()}` }),
  })
  const payload = (await response.json()) as { prompt_id?: string; error?: unknown; node_errors?: unknown }
  if (!payload.prompt_id) {
    throw new Error(`提交失败：${JSON.stringify(payload.node_errors ?? payload.error).slice(0, 300)}`)
  }
  return payload.prompt_id
}

async function wait(promptId: string, timeoutMs = 900000): Promise<string> {
  const start = Date.now()
  for (;;) {
    if (Date.now() - start > timeoutMs) throw new Error('超时')
    const response = await fetch(`${BASE}/history/${promptId}`)
    const history = (await response.json()) as Record<string, { outputs?: Record<string, { images?: Array<{ filename: string }> }>; status?: { status_str?: string } }>
    const entry = history[promptId]
    if (entry) {
      if (entry.status?.status_str === 'error') throw new Error('引擎执行报错')
      const images = Object.values(entry.outputs ?? {}).flatMap((output) => output.images ?? [])
      if (images.length > 0) return images[0].filename
      if (entry.status?.status_str === 'success') throw new Error('执行成功但没有图片')
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

const only = process.argv[2]
let failed = 0
for (const manifest of WORKFLOWS.filter((item) => !only || item.id === only)) {
  const graph = API_WORKFLOW_BY_ID[manifest.id]
  if (!graph) {
    console.log(`[跳过] ${manifest.name}：没有 API 图`)
    failed++
    continue
  }
  const values: Record<string, unknown> = {}
  for (const param of manifest.params) {
    values[param.key] = param.defaultValue
    if (param.key === 'image') values[param.key] = IMAGE
    if (param.key === 'mask') values[param.key] = MASK
  }
  try {
    const prompt = clonePrompt(graph)
    applyParamValues(prompt, manifest.params, values)
    for (const node of Object.values(prompt)) {
      if (node.class_type === 'KSampler' && 'seed' in node.inputs && !node.inputs.seed) {
        node.inputs.seed = Math.floor(Math.random() * 1_000_000_000)
      }
    }
    const promptId = await submit(toSubmitPayload(prompt))
    const filename = await wait(promptId)
    console.log(`[通过] ${manifest.name} → ${filename}`)
  } catch (err) {
    failed++
    console.log(`[失败] ${manifest.name} → ${err instanceof Error ? err.message : String(err)}`)
  }
}

console.log(failed === 0 ? '四条全部跑通' : `失败 ${failed} 条`)
process.exit(failed === 0 ? 0 : 1)
