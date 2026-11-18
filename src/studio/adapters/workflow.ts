import { enqueuePrompt, uploadImage, waitForPrompt, type ComfyOutputImage } from '../../lib/comfyClient'
import { clonePrompt, toSubmitPayload } from '../../lib/comfyPrompt'
import { API_WORKFLOW_BY_ID } from '../workflows/apiWorkflows'
import { WORKFLOWS, findWorkflow, type WorkflowManifest } from '../workflows/manifest'
import { applyParamValues } from '../workflows/anchors'
import { listWorkflows as listProjectWorkflows, type ProjectWorkflow } from '../workflows/projectWorkflows'

export interface AdapterWorkflowSummary {
  manifest: WorkflowManifest
  projectWorkflows: ProjectWorkflow[]
}

export interface WorkflowRunParams {
  [key: string]: unknown
  /** 需要上传的原图与蒙版 */
  image?: File | Blob
  mask?: File | Blob
}

export interface WorkflowRunResult {
  promptId: string
  images: ComfyOutputImage[]
}

/** 四条预置 + 项目内工作流条目 */
export function listWorkflows(): AdapterWorkflowSummary[] {
  const entries = listProjectWorkflows()
  return WORKFLOWS.map((manifest) => ({
    manifest,
    projectWorkflows: entries.filter((entry) => entry.presetId === manifest.id),
  }))
}

function asFile(value: File | Blob, name: string): File {
  return value instanceof File ? value : new File([value], name, { type: value.type || 'image/png' })
}

/** 按 manifest 参数跑一条工作流，转发给现有 comfyClient；不改客户端实现 */
export type WorkflowRunStage = 'uploading' | 'queued' | 'rendering'

/** 按 manifest 参数跑一条工作流，转发给现有 comfyClient；不改客户端实现 */
export async function runWorkflow(
  id: string,
  params: WorkflowRunParams,
  options: { timeoutMs?: number; signal?: AbortSignal; onStage?: (stage: WorkflowRunStage) => void } = {},
): Promise<WorkflowRunResult> {
  const manifest = findWorkflow(id)
  if (!manifest) throw new Error(`未知工作流：${id}`)
  const graph = API_WORKFLOW_BY_ID[id]
  if (!graph) throw new Error('这条工作流还没接通生成链路')

  const values: Record<string, unknown> = {}
  for (const param of manifest.params) {
    if (param.type === 'image') continue
    values[param.key] = param.defaultValue
  }
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    values[key] = value
  }

  if (params.image) {
    options.onStage?.('uploading')
    values.image = await uploadImage(asFile(params.image, 'workflow-input.png'))
  } else if (manifest.requiresImage) {
    throw new Error('这条工作流需要先选择原图')
  }
  if (manifest.params.some((param) => param.key === 'mask')) {
    if (!params.mask) throw new Error('这条工作流需要先涂抹蒙版')
    values.mask = await uploadImage(asFile(params.mask, 'workflow-mask.png'))
  }

  if (manifest.params.some((param) => param.anchor === '__SEED__') && Number(values.seed ?? 0) === 0) {
    values.seed = Math.floor(Math.random() * 1_000_000_000)
  }

  const prompt = clonePrompt(graph)
  applyParamValues(prompt, manifest.params, values)
  options.onStage?.('queued')
  const promptId = await enqueuePrompt(toSubmitPayload(prompt))
  options.onStage?.('rendering')
  const images = await waitForPrompt(promptId, {
    timeoutMs: options.timeoutMs ?? 15 * 60 * 1000,
    signal: options.signal,
  })
  return { promptId, images }
}
