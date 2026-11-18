/** 提交给 ComfyUI /prompt 的 API 格式工作流：节点 id → 类名与输入 */
export type ApiPromptNode = {
  class_type: string
  inputs: Record<string, unknown>
  _meta?: { title?: string }
}

export type ApiPrompt = Record<string, ApiPromptNode>

/** 按节点标题写入输入值；标题是画布上可以改的名字，比随机节点 id 稳定 */
export function applyAnchors(prompt: ApiPrompt, titleToInputs: Record<string, Record<string, unknown>>): ApiPrompt {
  const missing: string[] = []
  for (const [title, values] of Object.entries(titleToInputs)) {
    const hit = Object.values(prompt).find((node) => node._meta?.title === title)
    if (!hit) {
      missing.push(title)
      continue
    }
    Object.assign(hit.inputs, values)
  }
  if (missing.length > 0) {
    throw new Error(`工作流缺少锚点：${missing.join('、')}。请在 ComfyUI 里把对应节点标题改成这些名字后重新导出`)
  }
  return prompt
}

/** 深拷贝一份模板再改值，避免连续两次运行互相污染 */
export function clonePrompt(prompt: ApiPrompt): ApiPrompt {
  return JSON.parse(JSON.stringify(prompt)) as ApiPrompt
}

/** 提交前去掉本地用的 _meta，避免把编辑器信息送进引擎 */
export function toSubmitPayload(prompt: ApiPrompt): Record<string, { class_type: string; inputs: Record<string, unknown> }> {
  return Object.fromEntries(
    Object.entries(prompt).map(([id, node]) => [id, { class_type: node.class_type, inputs: node.inputs }]),
  )
}
