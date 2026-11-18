import { useEffect, useMemo, useState } from 'react'
import { Check, FolderOpen, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import type { WorkflowProject } from '../modules/workflow/types'

interface WorkflowProjectPickerProps {
  open: boolean
  projects: WorkflowProject[]
  activeProjectId: string
  onSelect: (projectId: string) => void
  onCreate: (name: string) => void
  onRename: (projectId: string, name: string) => void
  onDelete: (projectId: string) => void
  onClose: () => void
}

/** 保存的工作流弹层：支持新建、切换、重命名、删除 */
export function WorkflowProjectPicker({
  open,
  projects,
  activeProjectId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onClose,
}: WorkflowProjectPickerProps) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    if (open) return
    setQuery('')
    setCreating(false)
    setName('')
    setRenamingId(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const saved = useMemo(() => projects.filter((project) => project.id !== 'draft'), [projects])
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return saved
    return saved.filter((project) => project.name.toLowerCase().includes(keyword))
  }, [saved, query])

  if (!open) return null

  const submit = () => {
    const value = name.trim()
    if (!value) return
    onCreate(value)
    setCreating(false)
    setName('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-[560px] h-[480px] rounded-2xl bg-white dark:bg-[#161822] border border-black/[0.08] dark:border-white/[0.08] shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <h3 className="text-[14px] font-bold">保存的工作流</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] cursor-pointer"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 flex items-center gap-2">
          <div className="flex-1 h-9 px-3 rounded-full bg-[#f3f4f8] dark:bg-white/[0.06] flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索工作流名称"
              className="bg-transparent outline-none border-none w-full text-[12px] placeholder-slate-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="h-9 px-3.5 rounded-full bg-black text-white dark:bg-white dark:text-black text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            新建工作流
          </button>
        </div>

        {creating && (
          <div className="px-5 pb-2 flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
              }}
              placeholder="新工作流名称"
              className="flex-1 h-9 px-3 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#f8f9fc] dark:bg-[#10121a] outline-none text-[12px]"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!name.trim()}
              className="h-9 px-3 rounded-xl bg-black text-white dark:bg-white dark:text-black text-[12px] font-semibold disabled:opacity-40 cursor-pointer"
            >
              创建
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
              <FolderOpen className="w-6 h-6" />
              <div className="text-[12.5px]">还没有保存的工作流</div>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="h-8 px-3.5 rounded-full bg-black text-white dark:bg-white dark:text-black text-[11.5px] font-semibold cursor-pointer"
              >
                新建工作流
              </button>
            </div>
          ) : (
            filtered.map((project) => {
              const active = project.id === activeProjectId
              const renaming = renamingId === project.id
              return (
                <div key={project.id}>
                  {renaming ? (
                    <div className="flex items-center gap-2 px-1 py-1.5">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return
                          if (renameValue.trim()) onRename(project.id, renameValue.trim())
                          setRenamingId(null)
                        }}
                        className="flex-1 h-8 px-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#f8f9fc] dark:bg-[#10121a] outline-none text-[12px]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (renameValue.trim()) onRename(project.id, renameValue.trim())
                          setRenamingId(null)
                        }}
                        className="h-8 px-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black text-[11.5px] font-semibold cursor-pointer"
                      >
                        保存
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`group w-full rounded-xl px-3 py-2.5 flex items-center justify-between gap-3 transition ${
                        active ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(project.id)
                          onClose()
                        }}
                        className="flex-1 min-w-0 text-left cursor-pointer"
                      >
                        <div className="text-[12.5px] font-medium truncate">{project.name}</div>
                        <div className={`text-[10.5px] ${active ? 'opacity-70' : 'text-slate-400'}`}>
                          {project.updatedAt ? new Date(project.updatedAt).toLocaleString() : '—'}
                        </div>
                        {project.records.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1">
                            {project.records.slice(0, 4).map((record) => (
                              <img
                                key={record.id}
                                src={record.outputUrl}
                                alt=""
                                className="w-6 h-6 rounded-md object-cover shrink-0"
                              />
                            ))}
                            <span className={`text-[10.5px] ${active ? 'opacity-70' : 'text-slate-400'}`}>
                              {project.records.length} 条记录
                            </span>
                          </div>
                        )}
                      </button>
                      {active && <Check className="w-4 h-4 shrink-0" />}
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(project.id)
                          setRenameValue(project.name)
                        }}
                        title="重命名"
                        className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer ${
                          active ? 'hover:bg-white/20' : 'text-slate-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.1]'
                        }`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`删除工作流「${project.name}」？`)) onDelete(project.id)
                        }}
                        title="删除"
                        className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer ${
                          active ? 'hover:bg-white/20' : 'text-slate-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.1]'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
