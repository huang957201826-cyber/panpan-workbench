import { describe, expect, it } from 'vitest'
import { buildTaskSubmitInput, requestedImageIds } from './mcpWrite'

describe('mcpWrite', () => {
  it('does not attach current input images when imageIds is missing', () => {
    const request = { id: '1', tool: 'task.create', prompt: '画一只猫' }
    expect(requestedImageIds(request)).toEqual([])
    expect(buildTaskSubmitInput(request, []).inputImages).toEqual([])
  })

  it('uses exactly the image ids supplied by the MCP request', () => {
    const request = { id: '2', tool: 'task.create', prompt: '重绘', imageIds: ['a', 'b'] }
    const images = [
      { id: 'a', dataUrl: 'data:image/png;base64,a' },
      { id: 'b', dataUrl: 'data:image/png;base64,b' },
    ]
    expect(requestedImageIds(request)).toEqual(['a', 'b'])
    expect(buildTaskSubmitInput(request, images)).toEqual({
      prompts: ['重绘'],
      inputImages: images,
    })
  })

  it('trims the prompt and ignores non-string image ids', () => {
    const request = {
      id: '3',
      tool: 'task.create',
      prompt: '  风景  ',
      imageIds: ['a', 1, null] as unknown as string[],
    }
    expect(requestedImageIds(request)).toEqual(['a'])
    expect(buildTaskSubmitInput(request, []).prompts).toEqual(['风景'])
  })
})
