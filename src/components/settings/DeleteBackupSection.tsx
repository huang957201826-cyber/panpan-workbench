import { useEffect, useState } from 'react'
import { listDeleteSnapshots, readDeleteSnapshotFile, type DeleteSnapshot } from '../../lib/deleteSnapshot'
import { formatBytes } from '../../lib/formatBytes'
import { importData, useStore } from '../../store'

/** 设置页：最近 5 份删除前快照，恢复复用现有 ZIP 导入。 */
export default function DeleteBackupSection() {
  const showToast = useStore((state) => state.showToast)
  const setConfirmDialog = useStore((state) => state.setConfirmDialog)
  const [files, setFiles] = useState<DeleteSnapshot[]>([])
  const [error, setError] = useState('')

  const reload = () => {
    listDeleteSnapshots()
      .then((list) => setFiles(list.slice(0, 5)))
      .catch((err) => {
        console.error('读取删除快照失败：', err)
        setError(err instanceof Error ? err.message : String(err))
      })
  }

  useEffect(reload, [])

  const restore = (file: DeleteSnapshot) => {
    setConfirmDialog({
      title: '恢复删除快照',
      message: `将导入 ${file.name}（${formatBytes(file.bytes)}）中的任务和图片。当前数据不会被清空，同名任务会按导入规则合并。`,
      confirmText: '恢复',
      busyText: '正在恢复…',
      awaitAction: true,
      action: async () => {
        try {
          const backup = await readDeleteSnapshotFile(file.name)
          const imported = await importData(backup, { importConfig: false, importTasks: true })
          if (imported) {
            showToast('删除快照已恢复', 'success')
            reload()
          }
          return true
        } catch (err) {
          console.error('恢复删除快照失败：', err)
          showToast(err instanceof Error ? err.message : '恢复删除快照失败', 'error')
          return false
        }
      },
    })
  }

  return (
    <div className="rounded-2xl border border-transparent bg-black/[0.04] p-4 dark:bg-white/[0.06] space-y-3">
      <h4 className="text-body font-bold text-gray-800 dark:text-gray-100">最近删除快照</h4>
      <p className="text-body-sm text-gray-500 dark:text-gray-400">
        删除任务、画布或项目前会自动保存完整 ZIP（含图片），最近保留 5 份。
      </p>
      {error ? (
        <p className="text-body-sm text-red-500 break-all">{error}</p>
      ) : files.length === 0 ? (
        <p className="text-body-sm text-gray-400">暂无删除快照</p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.name} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 text-body-sm dark:bg-black/20">
              <span className="min-w-0">
                <span className="block truncate font-mono text-gray-700 dark:text-gray-200">{file.name}</span>
                <span className="text-gray-400">{formatBytes(file.bytes)}</span>
              </span>
              <button
                type="button"
                onClick={() => restore(file)}
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
              >
                恢复
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
