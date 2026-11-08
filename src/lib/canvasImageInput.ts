import { createInputImageFromFile, useStore, withInputPending } from '../store'
import { useCanvasViewStore } from './canvasViewStore'
import { addCanvasImageNode, createCanvasImageNode, fitCanvasImageNodeSize } from './canvasImageNodes'
import { useWorkspaceStore } from './workspaceStore'

function centerWorld() {
  const view = useCanvasViewStore.getState()
  return {
    x: (view.size.width / 2 - view.viewport.x) / Math.max(0.05, view.viewport.k),
    y: (Math.max(1, view.size.height - view.bottomInset) / 2 - view.viewport.y) / Math.max(0.05, view.viewport.k),
  }
}

/** 文件入库后同时加入输入选择与当前画布素材节点；同一图像只建一个节点。 */
export async function addImageFileToCanvas(canvasId: string, file: File, position = centerWorld()) {
  return withInputPending(async () => {
    const image = await createInputImageFromFile(file)
    if (!image) return null
    useStore.getState().addInputImage(image)
    if (!canvasId) return image
    const canvas = useWorkspaceStore.getState().canvases.find((item) => item.id === canvasId)
    if (!canvas) return image
    const existing = canvas.imageNodes?.find((node) => node.imageId === image.id)
    if (existing) return image
    const size = await new Promise<{ width: number; height: number }>((resolve) => {
      const probe = new Image()
      probe.onload = () => resolve(fitCanvasImageNodeSize(probe.naturalWidth, probe.naturalHeight))
      probe.onerror = () => resolve(fitCanvasImageNodeSize(0, 0))
      probe.src = image.dataUrl
    })
    const node = createCanvasImageNode(image.id, position.x, position.y, size.width, size.height)
    const latest = useWorkspaceStore.getState().canvases.find((item) => item.id === canvasId) ?? canvas
    useWorkspaceStore.getState().updateCanvas(canvasId, {
      imageNodes: addCanvasImageNode(latest.imageNodes ?? [], node),
      ...(latest.removedImageIds?.includes(image.id)
        ? { removedImageIds: latest.removedImageIds.filter((id) => id !== image.id) }
        : {}),
    })
    return image
  })
}
