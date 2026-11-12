import { useRef, useState } from 'react'
import type { AppSettings } from '../../types'
import { parsePpConfig, type ParsedPpConfig } from '../../lib/ppConfig'
import { ChevronDownIcon, ImportIcon } from '../icons'

const MAX_PP_CONFIG_BYTES = 256 * 1024

interface PpConfigImportPanelProps {
  draft: AppSettings
  onImport: (config: ParsedPpConfig) => void
}

export default function PpConfigImportPanel({ draft, onImport }: PpConfigImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<ParsedPpConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setFileName('')
    setPreview(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setFileName(file.name)
    setPreview(null)
    setError(null)
    try {
      if (file.size > MAX_PP_CONFIG_BYTES) throw new Error('配置码文件过大（上限 256 KB）')
      setPreview(parsePpConfig(await file.text(), draft))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const confirmImport = () => {
    if (!preview) return
    try {
      onImport(preview)
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-body font-medium text-gray-700 dark:text-gray-200">导入配置码</div>
          <div className="mt-0.5 text-body-sm text-gray-500 dark:text-gray-400">选择 .ppconfig 文件，预览后再写入；文件不含 API Key。</div>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-black/[0.06] px-2.5 py-1.5 text-body-sm text-gray-700 transition hover:bg-black/[0.1] dark:bg-white/[0.08] dark:text-gray-200 dark:hover:bg-white/[0.14]"
        >
          <ImportIcon className="h-3.5 w-3.5" />
          选择文件
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".ppconfig,application/json"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {error && (
        <div className="mt-2 rounded-lg bg-red-500/[0.08] px-2.5 py-2 text-body-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {preview && (
        <div className="mt-3 rounded-xl border border-black/[0.06] bg-white/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 truncate text-body-sm font-medium text-gray-700 dark:text-gray-200" title={fileName}>
              {fileName}
            </div>
            <span className="shrink-0 text-caption text-gray-400">v1</span>
          </div>
          {preview.preview.providers.length > 0 && (
            <div className="mt-2 text-body-sm text-gray-500 dark:text-gray-400">
              服务商：{preview.preview.providers.map((provider) => `${provider.name}${provider.existing ? '（更新）' : ''}`).join('、')}
            </div>
          )}
          <div className="mt-1.5 space-y-1">
            {preview.preview.profiles.map((profile) => (
              <div key={`${profile.name}-${profile.model}`} className="flex items-center justify-between gap-2 text-body-sm">
                <span className="min-w-0 truncate text-gray-700 dark:text-gray-200">{profile.name}</span>
                <span className="shrink-0 text-caption text-gray-400">
                  {profile.provider} · {profile.model} · {profile.existing ? '更新已有配置并保留 Key' : '新增'}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg px-2.5 py-1.5 text-body-sm text-gray-500 transition hover:bg-black/[0.05] dark:text-gray-400 dark:hover:bg-white/[0.08]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={confirmImport}
              className="rounded-lg bg-blue-500 px-2.5 py-1.5 text-body-sm font-medium text-white transition hover:bg-blue-600"
            >
              确认导入
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center gap-1 text-caption text-gray-400 dark:text-gray-500">
        <ChevronDownIcon className="h-3 w-3" />
        格式：{'{'}version: 1, providers: [], profiles: []{'}'}；未知字段或坏版本会被拒绝。
      </div>
    </div>
  )
}
