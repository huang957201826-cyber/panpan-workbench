import type { SavedWorkflowBackup } from '../types'
import {
  initializeSavedWorkflows,
  listWorkflows,
  replaceWorkflows,
  setSavedWorkflowCache,
  type ProjectWorkflow,
} from '../studio/workflows/projectWorkflows'
import {
  deleteResultImages,
  getResultImage,
  putResultImage,
} from '../studio/workflows/resultImageStore'
import type { ExportWorkflowImage } from './exportZip'
import { isTauri } from './platform'

export async function collectWorkflowBackup() {
  await initializeSavedWorkflows()
  const workflows = listWorkflows()
  const imageIds = [...new Set(workflows.flatMap((workflow) =>
    workflow.results.flatMap((result) => [result.imageId, result.inputImageId].filter((id): id is string => Boolean(id))),
  ))]
  const workflowImages: ExportWorkflowImage[] = []
  const missingImageIds: string[] = []
  for (const id of imageIds) {
    const dataUrl = await getResultImage(id)
    if (dataUrl) workflowImages.push({ id, dataUrl })
    else missingImageIds.push(id)
  }
  return {
    workflows: workflows as SavedWorkflowBackup[],
    workflowImages,
    missingImageIds,
  }
}

export interface PlannedWorkflowRestore {
  workflows: ProjectWorkflow[]
  stagedImages: Array<{ id: string; dataUrl: string }>
  missingImageIds: string[]
}

export function planWorkflowRestore(
  inputWorkflows: SavedWorkflowBackup[],
  workflowImages: Record<string, string>,
  operationId: string,
): PlannedWorkflowRestore {
  const stagedImages: Array<{ id: string; dataUrl: string }> = []
  const imageRemap = new Map<string, string>()
  const missingImageIds: string[] = []

  for (const [oldId, dataUrl] of Object.entries(workflowImages)) {
    const newId = `wfi-restore-${operationId}-${crypto.randomUUID()}`
    imageRemap.set(oldId, newId)
    stagedImages.push({ id: newId, dataUrl })
  }

  const workflows = inputWorkflows.map((workflow) => ({
    ...workflow,
    results: workflow.results.map((result) => {
      const imageId = imageRemap.get(result.imageId)
      const inputImageId = result.inputImageId ? imageRemap.get(result.inputImageId) : undefined
      const resultMissing = [
        ...(imageId ? [] : [result.imageId]),
        ...(result.inputImageId && !inputImageId ? [result.inputImageId] : []),
      ]
      missingImageIds.push(...resultMissing)
      return {
        ...result,
        imageId: imageId ?? result.imageId,
        inputImageId: inputImageId ?? result.inputImageId,
        ...(resultMissing.length ? { missingImageIds: resultMissing } : {}),
        record: result.record as ProjectWorkflow['results'][number]['record'],
      }
    }),
  }))
  return { workflows, stagedImages, missingImageIds }
}

export async function writePlannedWorkflowImages(images: Array<{ id: string; dataUrl: string }>) {
  for (const image of images) {
    await putResultImage(image.dataUrl, image.id)
  }
}

export async function cleanupPreparedWorkflowImages(ids: string[]) {
  await deleteResultImages(ids)
}

export async function replaceSavedWorkflowState(workflows: ProjectWorkflow[]) {
  if (isTauri) setSavedWorkflowCache(workflows)
  else await replaceWorkflows(workflows)
}
