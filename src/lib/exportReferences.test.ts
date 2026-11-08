import { describe, expect, it } from 'vitest'
import { collectReferencedImageIds } from './exportReferences'
import type { AgentConversation, TaskRecord, WorkspaceState } from '../types'

function task(patch: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-a',
    prompt: 'prompt',
    params: { size: 'auto', quality: 'auto', output_format: 'png', output_compression: null, moderation: 'auto', n: 1, transparent_output: false },
    inputImageIds: [],
    outputImages: [],
    status: 'done',
    error: null,
    createdAt: 1,
    finishedAt: 2,
    elapsed: 1,
    ...patch,
  }
}

describe('collectReferencedImageIds', () => {
  it('covers task, workspace, agent and draft references', () => {
    const workspace = {
      version: 1,
      projects: [],
      canvases: [{
        id: 'canvas-a',
        projectId: 'project-a',
        name: '画布',
        order: 0,
        createdAt: 1,
        updatedAt: 1,
        referenceImageIds: ['workspace-ref'],
        imageNodes: [{ id: 'node-a', imageId: 'workspace-node', x: 0, y: 0, w: 320, h: 240 }],
        maskDraft: { targetImageId: 'workspace-mask-target', maskDataUrl: 'data:image/png;base64,x', updatedAt: 1 },
      }],
      activeProjectId: 'project-a',
      activeCanvasId: 'canvas-a',
      viewMode: 'canvas' as const,
      inputDockPosition: 'bottom' as const,
    } satisfies WorkspaceState
    const conversation = {
      id: 'conversation-a',
      title: '对话',
      activeRoundId: null,
      createdAt: 1,
      updatedAt: 1,
      messages: [{ id: 'message-a', role: 'user' as const, content: 'x', roundId: 'round-a', inputImageIds: ['message-image'], createdAt: 1 }],
      rounds: [{
        id: 'round-a',
        index: 1,
        userMessageId: 'message-a',
        prompt: 'x',
        inputImageIds: ['round-image'],
        maskImageId: 'round-mask',
        maskTargetImageId: 'round-mask-target',
        outputTaskIds: [],
        status: 'done' as const,
        error: null,
        createdAt: 1,
        finishedAt: 2,
      }],
    } satisfies AgentConversation

    const ids = collectReferencedImageIds({
      tasks: [task({ inputImageIds: ['task-input'], outputImages: ['task-output'], maskImageId: 'task-mask', transparentOriginalImages: ['task-original'] })],
      workspace,
      agentConversations: [conversation],
      galleryInputDraft: { prompt: '', inputImages: [{ id: 'draft-image', dataUrl: '' }], maskDraft: null, maskEditorImageId: null, updatedAt: 1 },
      agentInputDrafts: {
        'conversation-a': { prompt: '', inputImages: [{ id: 'agent-draft-image', dataUrl: '' }], maskDraft: null, maskEditorImageId: 'agent-mask-editor', updatedAt: 1 },
      },
    })

    expect([...ids].sort()).toEqual([
      'agent-draft-image',
      'agent-mask-editor',
      'draft-image',
      'message-image',
      'round-image',
      'round-mask',
      'round-mask-target',
      'task-input',
      'task-mask',
      'task-original',
      'task-output',
      'workspace-mask-target',
      'workspace-node',
      'workspace-ref',
    ])
  })

  it('does not invent ids for empty references', () => {
    expect([...collectReferencedImageIds({ tasks: [task()] })]).toEqual([])
  })
})
