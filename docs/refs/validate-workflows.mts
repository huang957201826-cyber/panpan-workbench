/**
 * 工作流结构校验：把 API 图逐节点对一遍运行中的 ComfyUI，不跑生成、不占显存。
 *
 * 用法（Node ≥ 23，或 ≥ 22.6 加 --experimental-strip-types）：
 *   node docs/refs/validate-workflows.mts
 *   COMFY_URL=http://127.0.0.1:8188 COMFY_MODELS=D:/AI/ComfyUI/ComfyUI/models node docs/refs/validate-workflows.mts
 *
 * 检查项：节点类名是否存在、必填输入是否给全、连线的节点与输出序号是否越界、
 * 连线两端的类型是否一致、manifest 里的模型文件是否真在盘上、参数锚点是否有对应节点。
 */
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const URL_BASE = process.env.COMFY_URL ?? 'http://127.0.0.1:8188'
const MODELS = process.env.COMFY_MODELS ?? 'D:/AI/ComfyUI/ComfyUI/models'
const load = (path: string) => import(pathToFileURL(resolve(ROOT, path)).href)

const graphs: Record<string, any> = {
  'qwen-upscale': (await load('src/studio/workflows/api/qwen-upscale.ts')).QWEN_UPSCALE,
  'matte-cutout': (await load('src/studio/workflows/api/matte-cutout.ts')).MATTE_CUTOUT,
  'qwen-retouch': (await load('src/studio/workflows/api/qwen-retouch.ts')).QWEN_RETOUCH,
  'qwen-su-render': (await load('src/studio/workflows/api/qwen-su-render.ts')).QWEN_SU_RENDER,
}

const oi = (await (await fetch(`${URL_BASE}/object_info`)).json()) as Record<string, any>
const { WORKFLOWS } = await load('src/studio/workflows/manifest.ts')

/** 同一节点上的多个参数共用一个类名，标题只落在主锚点上 */
const TITLE_OPTIONAL = new Set(['__DENOISE__', '__STEPS__'])

let failed = 0

for (const [id, graph] of Object.entries(graphs)) {
  const errors: string[] = []
  const warns: string[] = []

  for (const [nid, node] of Object.entries<any>(graph)) {
    const spec = oi[node.class_type]
    if (!spec) {
      errors.push(`${nid} 未知节点 ${node.class_type}`)
      continue
    }
    const required = spec.input?.required ?? {}
    for (const key of Object.keys(required)) {
      const optionalByTemplate = required[key]?.[1]?.template?.min === 0
      if (node.inputs[key] === undefined && !optionalByTemplate) {
        errors.push(`${nid}.${node.class_type} 缺必填输入 ${key}`)
      }
    }
    for (const [key, value] of Object.entries<any>(node.inputs)) {
      if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string') continue
      const source = graph[value[0]]
      if (!source) {
        errors.push(`${nid}.${key} 连到不存在的节点 ${value[0]}`)
        continue
      }
      const sourceSpec = oi[source.class_type]
      if (sourceSpec && value[1] >= sourceSpec.output.length) {
        errors.push(`${nid}.${key} 连到 ${source.class_type} 第 ${value[1]} 个输出，越界`)
      }
      const expected = required[key]?.[0]
      const actual = sourceSpec?.output?.[value[1]]
      if (expected && actual && expected !== actual) {
        errors.push(`${nid}.${key} 类型不符：要 ${expected}，得到 ${actual}`)
      }
    }
  }

  const manifest: any = WORKFLOWS.find((item: any) => item.id === id)
  if (!manifest) errors.push('manifest 里没有这条')

  if (manifest) {
    for (const model of manifest.models) {
      if (!existsSync(`${MODELS}/${model}`)) warns.push(`缺模型 models/${model}`)
    }
    const titles = Object.values<any>(graph).map((node: any) => node._meta?.title).filter(Boolean)
    for (const param of manifest.params) {
      if (!param.anchor || TITLE_OPTIONAL.has(param.anchor)) continue
      if (!titles.includes(param.anchor)) warns.push(`锚点 ${param.anchor} 没有同名节点标题`)
    }
  }

  console.log(`\n[${id}] 节点 ${Object.keys(graph).length} · 参数 ${manifest?.params.length ?? 0}`)
  for (const item of errors) console.log(`  ✗ ${item}`)
  for (const item of warns) console.log(`  ! ${item}`)
  if (errors.length === 0) console.log('  ✓ 结构通过')
  failed += errors.length
}

console.log(failed === 0 ? '\n总结果：全部结构通过' : `\n总结果：${failed} 处结构错误`)
process.exitCode = failed === 0 ? 0 : 1
