import React from 'react'
import { AlertTriangle } from 'lucide-react'

interface DeleteWorkspaceDialogProps {
  title: string
  message: string
  moveLabel: string
  deleteLabel: string
  onCancel: () => void
  onMove: () => void
  onDelete: () => void
}

export const DeleteWorkspaceDialog: React.FC<DeleteWorkspaceDialogProps> = ({
  title,
  message,
  moveLabel,
  deleteLabel,
  onCancel,
  onMove,
  onDelete,
}) => (
  <div className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-[420px] max-w-[94vw] rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#161822] shadow-2xl p-5 text-slate-800 dark:text-slate-100"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4" strokeWidth={1.6} />
        </div>
        <div className="min-w-0">
          <div className="text-body font-semibold">{title}</div>
          <div className="mt-1 text-body-sm leading-relaxed text-slate-500 dark:text-slate-400">{message}</div>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-1.5">
        <button
          onClick={onMove}
          className="w-full h-8 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.09] dark:hover:bg-white/[0.12] text-body-sm font-medium transition cursor-pointer"
        >
          {moveLabel}
        </button>
        <button
          onClick={onDelete}
          className="w-full h-8 rounded-lg bg-red-500/10 hover:bg-red-500/15 text-red-600 dark:text-red-400 text-body-sm font-medium transition cursor-pointer"
        >
          {deleteLabel}
        </button>
        <button
          onClick={onCancel}
          className="w-full h-8 rounded-lg text-slate-500 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-body-sm transition cursor-pointer"
        >
          取消
        </button>
      </div>
    </div>
  </div>
)
