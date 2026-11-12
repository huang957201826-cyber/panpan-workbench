import { useEffect, useRef, useState } from 'react'
import { addImageFromFile, submitTask, useStore } from '../../store'
import { getActiveApiProfile, splitModelList } from '../../lib/apiProfiles'
import { MAX_INPUT_IMAGES } from '../../types'
import { ensureImageThumbnailCached } from '../../lib/imageCache'
import Select from '../Select'

function HistoryItem({ taskId }: { taskId: string }) {
  const task = useStore((s) => s.tasks.find((item) => item.id === taskId))
  const setDetailTaskId = useStore((s) => s.setDetailTaskId)
  const [thumb, setThumb] = useState('')

  useEffect(() => {
    const imageId = task?.outputImages[0]
    if (!imageId) return
    let alive = true
    void ensureImageThumbnailCached(imageId).then((item) => {
      if (alive && item) setThumb(item.src)
    }).catch(() => {})
    return () => { alive = false }
  }, [task?.outputImages])

  if (!task) return null
  return (
    <button
      type="button"
      onClick={() => setDetailTaskId(task.id)}
      className="flex w-full gap-2 rounded-lg p-2 text-left transition-colors hover:bg-white/[0.05]"
    >
      {thumb ? (
        <img src={thumb} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white/[0.06] text-caption text-gray-500">无图</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-body-sm leading-relaxed text-gray-300">{task.prompt || '未命名任务'}</span>
        <span className="mt-1 block text-caption text-gray-500">
          {task.status === 'running' ? '生成中' : task.status === 'error' ? '失败' : task.params.size}
        </span>
      </span>
    </button>
  )
}

export default function CanvasSidebar() {
  const prompt = useStore((s) => s.prompt)
  const setPrompt = useStore((s) => s.setPrompt)
  const inputImages = useStore((s) => s.inputImages)
  const removeInputImage = useStore((s) => s.removeInputImage)
  const params = useStore((s) => s.params)
  const setParams = useStore((s) => s.setParams)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const tasks = useStore((s) => s.tasks)
  const showToast = useStore((s) => s.showToast)
  const fileRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)

  const activeProfile = getActiveApiProfile(settings)
  const models = splitModelList(activeProfile.model)
  const selectedModel = models.includes(activeProfile.selectedModel ?? '') ? activeProfile.selectedModel! : models[0] ?? activeProfile.model
  const recent = [...tasks].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8)

  const updateModel = (model: string) => {
    setSettings({
      profiles: settings.profiles.map((profile) => profile.id === activeProfile.id ? { ...profile, selectedModel: model } : profile),
    })
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const remaining = MAX_INPUT_IMAGES - inputImages.length
    if (remaining <= 0) {
      showToast(`参考图数量已达上限（${MAX_INPUT_IMAGES} 张）`, 'error')
      return
    }
    for (const file of Array.from(files).filter((item) => item.type.startsWith('image/')).slice(0, remaining)) {
      await addImageFromFile(file)
    }
  }

  const handleSubmit = async () => {
    if (!prompt.trim() || submitting) return
    setSubmitting(true)
    try {
      await submitTask()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <aside className="flex w-[350px] shrink-0 flex-col border-r border-[#2c2c2c] bg-[#141414] max-lg:w-[310px]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#242424] px-3 text-body-sm text-gray-400">
        <span>对话</span>
        <span className="text-base leading-none text-gray-500">＋</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {recent.length ? recent.map((task) => <HistoryItem key={task.id} taskId={task.id} />) : (
          <p className="px-2 py-6 text-center text-body-sm text-gray-600">还没有任务</p>
        )}
      </div>

      <div className="shrink-0 border-t border-[#2c2c2c] bg-[#171717] p-3">
        {inputImages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {inputImages.map((image, index) => (
              <div key={image.id} className="group relative">
                <img src={image.dataUrl} alt="" className="h-10 w-10 rounded-md border border-[#3a3a3a] object-cover" />
                <button
                  type="button"
                  aria-label="移除参考图"
                  onClick={() => removeInputImage(index)}
                  className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-black/80 text-caption text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-[#343434] bg-[#202020] p-2.5">
          <textarea
            id="panpan-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void handleSubmit()
              }
            }}
            placeholder="描述你想生成的图片，或输入 @ 指定参考图…"
            className="h-[64px] w-full resize-none bg-transparent text-body-sm leading-relaxed text-gray-100 outline-none placeholder:text-gray-600"
          />

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Select
              value={selectedModel}
              onChange={(value) => updateModel(String(value))}
              options={models.map((model) => ({ label: model, value: model }))}
              className="max-w-[150px] !rounded-md !border-[#3a3a3a] !bg-[#2a2a2a] !px-2 !py-1 !text-caption !text-gray-300"
            />
            <Select
              value={params.size}
              onChange={(value) => setParams({ size: String(value) })}
              options={[
                { label: 'auto', value: 'auto' },
                { label: '1024×1024', value: '1024x1024' },
                { label: '1536×1024', value: '1536x1024' },
                { label: '1024×1536', value: '1024x1536' },
                { label: '2560×1440', value: '2560x1440' },
                { label: '1440×2560', value: '1440x2560' },
              ]}
              className="!rounded-md !border-[#3a3a3a] !bg-[#2a2a2a] !px-2 !py-1 !text-caption !text-gray-300"
            />
            <Select
              value={params.quality}
              onChange={(value) => setParams({ quality: String(value) as typeof params.quality })}
              options={['auto', 'low', 'medium', 'high'].map((quality) => ({ label: quality, value: quality }))}
              className="!rounded-md !border-[#3a3a3a] !bg-[#2a2a2a] !px-2 !py-1 !text-caption !text-gray-300"
            />
            <select
              value={params.n}
              onChange={(event) => setParams({ n: Number(event.target.value) })}
              className="rounded-md border border-[#3a3a3a] bg-[#2a2a2a] px-1.5 py-1 text-caption text-gray-300 outline-none"
            >
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} 张</option>)}
            </select>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!prompt.trim() || submitting}
              className="ml-auto grid h-7 w-7 place-items-center rounded-md bg-blue-500 text-body text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↑
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3 text-body-sm text-gray-500">
          <button type="button" onClick={() => fileRef.current?.click()} className="hover:text-gray-300">上传图片</button>
          <span className="cursor-default">我的素材</span>
          <span className="cursor-default">从画布选择</span>
          <span className="ml-auto text-caption text-gray-600">{inputImages.length}/{MAX_INPUT_IMAGES}</span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => { void handleFiles(event.target.files); event.target.value = '' }}
        />
      </div>
    </aside>
  )
}
