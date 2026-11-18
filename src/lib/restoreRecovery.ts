import { deleteImage } from './db'
import { deleteRestoreJournal, listRestoreJournals } from './dbTauri'
import { isTauri } from './platform'
import { deleteResultImages } from '../studio/workflows/resultImageStore'

interface RestoreJournalData {
  stagedImageIds?: unknown
  stagedThumbnailIds?: unknown
  stagedWorkflowImageIds?: unknown
}

function stringIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string' && Boolean(id))
    : []
}

export async function recoverPendingRestoreJournals() {
  if (!isTauri) return 0
  const rows = await listRestoreJournals()
  for (const row of rows) {
    let parsed: RestoreJournalData = {}
    try {
      parsed = JSON.parse(row.data) as RestoreJournalData
    } catch {
      // 损坏的 journal 也要删除，避免阻止后续正常恢复。
    }
    if (row.state === 'staging') {
      const imageIds = [...new Set([
        ...stringIds(parsed.stagedImageIds),
        ...stringIds(parsed.stagedThumbnailIds),
      ])]
      const workflowImageIds = stringIds(parsed.stagedWorkflowImageIds)
      if (imageIds.length) await Promise.all(imageIds.map((id) => deleteImage(id)))
      if (workflowImageIds.length) await deleteResultImages(workflowImageIds)
    }
    await deleteRestoreJournal(row.id)
  }
  return rows.length
}
