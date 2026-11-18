import type { AgentConversation, SavedWorkflowBackup, TaskRecord } from '../types'

export type RestoreMode = 'merge' | 'replace'

export interface RestoreConflictPreview {
  taskConflicts: number
  conversationConflicts: number
  workflowConflicts: number
  skippedAgentTasks: number
}

export function mergeRestoreTasks(
  currentTasks: TaskRecord[],
  currentConversations: AgentConversation[],
  importedTasks: TaskRecord[],
  importedConversations: AgentConversation[],
  mode: RestoreMode,
) {
  const normalizedConversations = importedConversations.filter(
    (conversation) => conversation && typeof conversation.id === 'string' && conversation.id,
  )
  if (mode === 'replace') {
    return {
      tasks: importedTasks,
      conversations: normalizedConversations,
      preview: {
        taskConflicts: 0,
        conversationConflicts: 0,
        workflowConflicts: 0,
        skippedAgentTasks: 0,
      } satisfies RestoreConflictPreview,
    }
  }

  const currentTaskIds = new Set(currentTasks.map((task) => task.id))
  const currentConversationIds = new Set(currentConversations.map((conversation) => conversation.id))
  const importedConversationIds = new Set(normalizedConversations.map((conversation) => conversation.id))
  let taskConflicts = 0
  let conversationConflicts = 0
  let skippedAgentTasks = 0

  const conversations = [
    ...currentConversations,
    ...normalizedConversations.filter((conversation) => {
      if (currentConversationIds.has(conversation.id)) {
        conversationConflicts += 1
        return false
      }
      return true
    }),
  ]
  const tasks = [
    ...currentTasks,
    ...importedTasks.filter((task) => {
      if (currentTaskIds.has(task.id)) {
        taskConflicts += 1
        return false
      }
      const agentConversationId = task.agentConversationId
      if (
        agentConversationId
        && importedConversationIds.has(agentConversationId)
        && currentConversationIds.has(agentConversationId)
      ) {
        skippedAgentTasks += 1
        return false
      }
      return true
    }),
  ]
  return {
    tasks,
    conversations,
    preview: {
      taskConflicts,
      conversationConflicts,
      workflowConflicts: 0,
      skippedAgentTasks,
    } satisfies RestoreConflictPreview,
  }
}

export function mergeRestoreWorkflows(
  current: SavedWorkflowBackup[],
  incoming: SavedWorkflowBackup[],
  mode: RestoreMode,
) {
  if (mode === 'replace') return { workflows: incoming, conflicts: 0 }
  const existingIds = new Set(current.map((workflow) => workflow.id))
  let conflicts = 0
  const workflows = [
    ...current,
    ...incoming.filter((workflow) => {
      if (existingIds.has(workflow.id)) {
        conflicts += 1
        return false
      }
      return true
    }),
  ]
  return { workflows, conflicts }
}
