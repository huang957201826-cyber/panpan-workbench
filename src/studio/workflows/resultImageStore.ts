/**
 * 工作流结果的持久图片库。
 * 独立于应用图片库：应用启动时会清理无人引用的图片，而保存的工作流结果不在它的引用集合里。
 */
const DB_NAME = 'panpan-workflow-results'
const STORE = 'images'
const DB_VERSION = 1

interface ResultImageRecord {
  id: string
  dataUrl: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function putResultImage(dataUrl: string, requestedId?: string): Promise<string> {
  const id = requestedId || `wfi-${Date.now().toString(36)}-${crypto.randomUUID()}`
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ id, dataUrl } satisfies ResultImageRecord)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return id
}

export async function getResultImage(id: string): Promise<string | undefined> {
  const db = await openDb()
  const record = await new Promise<ResultImageRecord | undefined>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
    request.onsuccess = () => resolve(request.result as ResultImageRecord | undefined)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return record?.dataUrl
}

export async function deleteResultImages(ids: (string | undefined)[]): Promise<void> {
  const valid = ids.filter((id): id is string => Boolean(id))
  if (valid.length === 0) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    for (const id of valid) tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
