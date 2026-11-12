import { useRef, useState } from 'react'
import { ArrowUpDown, Check, Filter, Search, Star } from 'lucide-react'
import type { TaskRecord } from '../../types'
import { Button, IconButton, Menu, MenuItem, TextField, Tooltip } from '../../ui'

export type StudioStatusFilter = 'all' | 'done' | 'error' | 'running'
export type StudioCardSort = 'newest' | 'oldest' | 'prompt'

const STATUS_OPTIONS: Array<{ value: StudioStatusFilter; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'running', label: '生成中' },
  { value: 'done', label: '完成' },
  { value: 'error', label: '失败' },
]

const SORT_OPTIONS: Array<{ value: StudioCardSort; label: string }> = [
  { value: 'newest', label: '最新优先' },
  { value: 'oldest', label: '最早优先' },
  { value: 'prompt', label: '按提示词' },
]

interface Props {
  query: string
  status: StudioStatusFilter
  favoriteOnly: boolean
  model: string
  models: string[]
  selectionMode: boolean
  selectedCount: number
  sort: StudioCardSort
  onQueryChange: (value: string) => void
  onStatusChange: (value: StudioStatusFilter) => void
  onModelChange: (value: string) => void
  onToggleFavorite: () => void
  onToggleSelectionMode: () => void
  onSelectAll: () => void
  onClearSelection: () => void
  onBatchFavorite: () => void
  onBatchDownload: () => void
  batchDownloadProgress?: { done: number; total: number } | null
  onBatchDelete: () => void
  onSortChange: (value: StudioCardSort) => void
}

/** 卡片视图头部：搜索 + 筛选 + 排序 + 多选；画布顶部不再常驻这些控件 */
export function StudioViewToolbar({
  query,
  status,
  favoriteOnly,
  model,
  models,
  selectionMode,
  selectedCount,
  sort,
  onQueryChange,
  onStatusChange,
  onModelChange,
  onToggleFavorite,
  onToggleSelectionMode,
  onSelectAll,
  onClearSelection,
  onBatchFavorite,
  onBatchDownload,
  batchDownloadProgress,
  onBatchDelete,
  onSortChange,
}: Props) {
  const filterRef = useRef<HTMLButtonElement>(null)
  const sortRef = useRef<HTMLButtonElement>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const activeFilters = (status === 'all' ? 0 : 1) + (model ? 1 : 0) + (favoriteOnly ? 1 : 0)

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <TextField
        icon={<Search size={13} />}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onClear={() => onQueryChange('')}
        placeholder="搜索提示词 / 模型"
        aria-label="搜索任务"
        className="min-w-[88px] max-w-[180px] flex-1"
      />

      <Tooltip label="筛选状态、模型与收藏">
        <button
          ref={filterRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen((value) => !value)}
          className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-control border px-2.5 text-body-sm transition-colors duration-fast ${
            activeFilters
              ? 'border-brand/30 bg-brand-soft text-brand'
              : 'border-line bg-surface-2 text-ink-1 hover:bg-surface-3'
          }`}
        >
          <Filter size={14} />
          筛选
          {activeFilters > 0 && <span className="font-mono text-caption">{activeFilters}</span>}
        </button>
      </Tooltip>

      <Menu open={filterOpen} anchorRef={filterRef} width={196} onClose={() => setFilterOpen(false)}>
        <div className="px-2 pb-1 pt-0.5 text-caption text-ink-3">状态</div>
        {STATUS_OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            active={status === option.value}
            icon={status === option.value ? <Check size={13} /> : null}
            onClick={() => onStatusChange(option.value)}
          >
            {option.label}
          </MenuItem>
        ))}
        <div className="mt-1 border-t border-line px-2 pb-1 pt-1.5 text-caption text-ink-3">模型</div>
        <MenuItem active={!model} icon={!model ? <Check size={13} /> : null} onClick={() => onModelChange('')}>
          全部模型
        </MenuItem>
        {models.map((item) => (
          <MenuItem key={item} active={model === item} icon={model === item ? <Check size={13} /> : null} onClick={() => onModelChange(item)}>
            {item}
          </MenuItem>
        ))}
        <div className="mt-1 border-t border-line pt-1">
          <MenuItem active={favoriteOnly} icon={favoriteOnly ? <Check size={13} /> : null} onClick={onToggleFavorite}>
            只看收藏
          </MenuItem>
        </div>
      </Menu>

      <Tooltip label="排序">
        <button
          ref={sortRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={sortOpen}
          onClick={() => setSortOpen((value) => !value)}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-control border border-line bg-surface-2 px-2.5 text-body-sm text-ink-1 transition-colors duration-fast hover:bg-surface-3"
        >
          <ArrowUpDown size={14} />
          {SORT_OPTIONS.find((option) => option.value === sort)?.label ?? '排序'}
        </button>
      </Tooltip>

      <Menu open={sortOpen} anchorRef={sortRef} width={140} onClose={() => setSortOpen(false)}>
        {SORT_OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            active={sort === option.value}
            icon={sort === option.value ? <Check size={13} /> : null}
            onClick={() => {
              onSortChange(option.value)
              setSortOpen(false)
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>

      <Tooltip label={favoriteOnly ? '取消只看收藏' : '只看收藏'}>
        <IconButton
          label="只看收藏"
          aria-pressed={favoriteOnly}
          onClick={onToggleFavorite}
          className={favoriteOnly ? 'bg-brand-soft text-brand hover:bg-brand-soft' : ''}
        >
          <Star size={16} fill={favoriteOnly ? 'currentColor' : 'none'} />
        </IconButton>
      </Tooltip>

      <Button
        variant={selectionMode ? 'primary' : 'ghost'}
        size="sm"
        onClick={onToggleSelectionMode}
        aria-pressed={selectionMode}
      >
        多选
      </Button>

      {selectionMode && (
        <>
          <span className="shrink-0 px-1 font-mono text-caption text-ink-3">已选 {selectedCount}</span>
          <Button size="sm" variant="ghost" onClick={onSelectAll}>全选</Button>
          <Button size="sm" variant="ghost" onClick={onClearSelection}>清除</Button>
          <Button size="sm" variant="ghost" onClick={onBatchFavorite} disabled={!selectedCount}>收藏</Button>
          <Button size="sm" variant="ghost" onClick={onBatchDownload} disabled={!selectedCount || Boolean(batchDownloadProgress)}>
            {batchDownloadProgress ? `${batchDownloadProgress.done}/${batchDownloadProgress.total}` : '下载'}
          </Button>
          <Button size="sm" variant="danger" onClick={onBatchDelete} disabled={!selectedCount}>删除</Button>
        </>
      )}
    </div>
  )
}

export function selectAllTaskIds(tasks: TaskRecord[]) {
  return new Set(tasks.map((task) => task.id))
}
