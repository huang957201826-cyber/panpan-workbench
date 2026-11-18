import { describe, expect, it } from 'vitest'
import type { AgentConversation, SavedWorkflowBackup, TaskRecord } from '../types'
import { mergeRestoreTasks, mergeRestoreWorkflows } from './restorePlan'

function task(id: string, conversationId?: string): TaskRecord {
  return {
    id,
    prompt: '',
    params: {} as TaskRecord['params'],
    inputImageIds: [],
    outputImages: [],
    status: 'done',
    error: null,
    createdAt: 1,
    finishedAt: 1,
    elapsed: 0,
    ...(conversationId ? { agentConversationId: conversationId } : {}),
  }
}

function conversation(id: string): AgentConversation {
  return {
    id,
    title: id,
    createdAt: 1,
    updatedAt: 1,
    rounds: [],
    messages: [],
  }
}

function workflow(id: string): SavedWorkflowBackup {
  return {
    id,
    workspaceProjectId: null,
    presetId: 'qwen-upscale',
    name: id,
    values: {},
    results: [],
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('restorePlan merge semantics', () => {
  it('skips existing conversations with their associated agent tasks', () => {
    const result = mergeRestoreTasks(
      [task('current-task')],
      [conversation('conversation-a')],
      [task('new-agent-task', 'conversation-a'), task('new-task')],
      [conversation('conversation-a'), conversation('conversation-b')],
      'merge',
    )
    expect(result.tasks.map((item) => item.id)).toEqual(['current-task', 'new-task'])
    expect(result.conversations.map((item) => item.id)).toEqual(['conversation-a', 'conversation-b'])
    expect(result.preview.conversationConflicts).toBe(1)
    expect(result.preview.skippedAgentTasks).toBe(1)
  })

  it('replaces tasks and conversations in replace mode', () => {
    const imported = [task('replacement')]
    const importedConversations = [conversation('replacement-conversation')]
    const result = mergeRestoreTasks(
      [task('current')],
      [conversation('current-conversation')],
      imported,
      importedConversations,
      'replace',
    )
    expect(result.tasks).toEqual(imported)
    expect(result.conversations).toEqual(importedConversations)
  })

  it('merges workflows without overwriting same IDs', () => {
    const result = mergeRestoreWorkflows(
      [workflow('same'), workflow('current')],
      [workflow('same'), workflow('new')],
      'merge',
    )
    expect(result.workflows.map((item) => item.id)).toEqual(['same', 'current', 'new'])
    expect(result.conflicts).toBe(1)
  })
})
