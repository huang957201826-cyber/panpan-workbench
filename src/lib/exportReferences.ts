import type { AgentConversation, AgentInputDraft, TaskRecord, WorkspaceState } from '../types'

interface ReferenceSources {
  tasks: TaskRecord[]
  workspace?: WorkspaceState | null
  agentConversations?: AgentConversation[]
  galleryInputDraft?: AgentInputDraft | null
  agentInputDrafts?: Record<string, AgentInputDraft>
}

function addAll(target: Set<string>, ids: Array<string | null | undefined> | undefined) {
  for (const id of ids ?? []) {
    if (typeof id === 'string' && id) target.add(id)
  }
}

function addDraft(target: Set<string>, draft: AgentInputDraft | null | undefined) {
  if (!draft) return
  addAll(target, draft.inputImages.map((image) => image.id))
  if (draft.maskDraft?.targetImageId) target.add(draft.maskDraft.targetImageId)
  if (draft.maskEditorImageId) target.add(draft.maskEditorImageId)
}

/** 备份必须覆盖的全部图片引用；用于导出前发现“数据库里根本没有这张图”的悬空引用 */
export function collectReferencedImageIds(sources: ReferenceSources): Set<string> {
  const ids = new Set<string>()
  for (const task of sources.tasks) {
    addAll(ids, task.inputImageIds)
    addAll(ids, task.outputImages)
    addAll(ids, task.transparentOriginalImages)
    addAll(ids, task.streamPartialImageIds)
    if (task.maskImageId) ids.add(task.maskImageId)
    if (task.maskTargetImageId) ids.add(task.maskTargetImageId)
  }
  for (const canvas of sources.workspace?.canvases ?? []) {
    addAll(ids, canvas.referenceImageIds)
    addAll(ids, canvas.imageNodes?.map((node) => node.imageId))
    if (canvas.maskDraft?.targetImageId) ids.add(canvas.maskDraft.targetImageId)
    if (canvas.maskEditorImageId) ids.add(canvas.maskEditorImageId)
  }
  for (const conversation of sources.agentConversations ?? []) {
    for (const round of conversation.rounds) {
      addAll(ids, round.inputImageIds)
      if (round.maskImageId) ids.add(round.maskImageId)
      if (round.maskTargetImageId) ids.add(round.maskTargetImageId)
    }
    for (const message of conversation.messages) {
      addAll(ids, message.inputImageIds)
      if (message.maskImageId) ids.add(message.maskImageId)
      if (message.maskTargetImageId) ids.add(message.maskTargetImageId)
    }
  }
  addDraft(ids, sources.galleryInputDraft)
  for (const draft of Object.values(sources.agentInputDrafts ?? {})) addDraft(ids, draft)
  return ids
}
