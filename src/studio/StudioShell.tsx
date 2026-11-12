import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { stopBatchPrompts, submitTask, updateTaskInStore, useStore, withInputPending } from '../store'
import { deleteTask, deleteTasks, retryTaskAction, reuseTaskConfig } from '../lib/taskActions'
import { useCanvasTasks } from '../hooks/useCanvasTasks'
import { isTauri } from '../lib/platform'
import { getActiveApiProfile, resolveApiProfileModel, splitModelList } from '../lib/apiProfiles'
import { ensureImageCached } from '../lib/imageCache'
import { addImageFileToCanvas } from '../lib/canvasImageInput'
import { getDownloadErrorMessage, withSaveLocation } from '../lib/downloadImages'
import { downloadTasksImages } from '../lib/taskExport'
import { pickSaveDir, type SaveDir } from '../lib/saveFile'
import { pickSelectedTasks } from '../lib/taskSelection'
import { useCanvasViewStore } from '../lib/canvasViewStore'
import { removedInputImageIds } from '../lib/canvasImageNodes'
import { filterStudioTasks } from '../lib/studioGrid'
import { deleteCanvas, deleteProject, enqueueWorkspaceAction, getCanvasTasks, getProjectTasks, getRunningTasks, restoreActiveCanvasSnapshot, saveActiveCanvasSnapshot, stopTasks, switchCanvas } from '../lib/workspaceActions'
import { clearAllSelection } from '../lib/selection'
import { clearCanvasUndo, retainCanvasUndo } from '../lib/canvasUndo'
import { composeSkillPrompt, loadBuiltinSkills, skillCoverColor } from '../lib/capabilitySkills'
import { migratePromptSkills } from '../lib/migratePromptSkills'
import { useSkillStore } from '../lib/skillStore'
import { useCapabilitySkillStore } from '../lib/capabilitySkillStore'
import { MAX_PROMPT_LENGTH } from '../lib/promptLimits'
import { useWorkspaceStore } from '../lib/workspaceStore'
import CanvasBoard from '../components/CanvasBoard'
import DragUploadOverlay from '../components/input/dragUploadOverlay'
import { MAX_INPUT_IMAGES } from '../types'
import type { Skill, TaskSkillContext } from '../types'
import type { ActiveActivity } from './types'
import type { ProjectFolder, ProjectScheme } from './types'
import { AppSidebar } from './components/AppSidebar'
import { BottomPromptBar } from './components/BottomPromptBar'
import { CardGridView } from './components/CardGridView'
import { DeleteWorkspaceDialog } from './components/DeleteWorkspaceDialog'
import { RightGeneratorDrawer } from './components/RightGeneratorDrawer'
import { TitleBar } from './components/TitleBar'
import { StudioHeader } from './components/StudioHeader'
import { createFavoritesEntries, FAVORITES_CANVAS_ID, isFavoritesCanvas, isFavoritesProject } from '../lib/favorites'
import { StudioViewToolbar, selectAllTaskIds, type StudioStatusFilter } from './components/StudioViewToolbar'
import { CanvasCapsuleBar } from './components/CanvasCapsuleBar'
import type { SidebarProject } from './components/AppSidebar'
import { CapabilitySkillLibrary } from './components/CapabilitySkillLibrary'
import { HomeHubView } from './components/HomeHubView'
import { WorkflowView } from './components/WorkflowView'

import { getStudioSizeOptions, getGenerationParams, toReferenceImages, toTaskParams, useArtboards } from './adapters'
import './studio.css'

export default function StudioShell() {
  const settings = useStore((s) => s.settings)
  const prompt = useStore((s) => s.prompt)
  const params = useStore((s) => s.params)
  const inputImages = useStore((s) => s.inputImages)
  const setPrompt = useStore((s) => s.setPrompt)
  const setParams = useStore((s) => s.setParams)
  const setSettings = useStore((s) => s.setSettings)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const showToast = useStore((s) => s.showToast)
  const addInputImage = useStore((s) => s.addInputImage)
  const clearInputImages = useStore((s) => s.clearInputImages)


  const workspace = useWorkspaceStore()
  const favoritesEntries = useMemo(() => createFavoritesEntries(), [])
  const activeProject = isFavoritesProject(workspace.activeProjectId)
    ? favoritesEntries.project
    : workspace.projects.find((project) => project.id === workspace.activeProjectId) ?? workspace.projects[0]
  const activeCanvas = isFavoritesCanvas(workspace.activeCanvasId)
    ? favoritesEntries.canvas
    : workspace.canvases.find((canvas) => canvas.id === workspace.activeCanvasId && canvas.projectId === activeProject?.id)
  const tasks = useCanvasTasks(activeCanvas?.id ?? '')
  const runningCount = tasks.filter((task) => task.status === 'running').length
  const batchProgress = useStore((s) => s.batchProgress)
  const maskDraft = useStore((s) => s.maskDraft)

  const [activeActivity, setActiveActivity] = useState<ActiveActivity>(() =>
    localStorage.getItem('panpan-start-activity') === 'projects' ? 'projects' : 'home',
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 900)
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1100)
  const [selectedArtboardId, setSelectedArtboardId] = useState<string | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'canvas' | 'project'; id: string; name: string; taskCount: number } | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StudioStatusFilter>('all')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [modelFilter, setModelFilter] = useState('')
  const [cardSort, setCardSort] = useState<'newest' | 'oldest' | 'prompt'>('newest')
  const [selectionMode, setSelectionMode] = useState(false)
  const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null)
  const [localExportFormat, setLocalExportFormat] = useState<'gif' | 'svg' | null>(() => {
    const saved = localStorage.getItem('panpan-local-export-format')
    return saved === 'gif' || saved === 'svg' ? saved : null
  })
  const lastCanvasByProjectRef = useRef<Map<string, string>>(new Map())
  const lastUndoCanvasRef = useRef('')
  useEffect(() => {
    if (localExportFormat) localStorage.setItem('panpan-local-export-format', localExportFormat)
    else localStorage.removeItem('panpan-local-export-format')
  }, [localExportFormat])
  const selectedTaskIdsState = useStore((s) => s.selectedTaskIds)
  const setSelectedTaskIdsState = useStore((s) => s.setSelectedTaskIds)
  const selectedTaskIds = useMemo(() => new Set(selectedTaskIdsState), [selectedTaskIdsState])
  const setSelectedTaskIds = (updater: Set<string> | ((previous: Set<string>) => Set<string>)) => {
    setSelectedTaskIdsState((previous) => {
      const previousSet = new Set(previous)
      const next = typeof updater === 'function' ? updater(previousSet) : updater
      return next === previousSet ? previous : [...next]
    })
  }
  const selectedCanvasTaskId = selectedTaskIdsState[0] ?? null
  const [canvasPickMode, setCanvasPickMode] = useState(false)
  const [batchDownloadProgress, setBatchDownloadProgress] = useState<{ done: number; total: number } | null>(null)
  const clearSkillChip = useStore((s) => s.clearSkillChip)
  const mineCapabilitySkills = useCapabilitySkillStore((s) => s.mine)
  const legacyPromptSkills = useSkillStore((s) => s.skills)
  const [builtinCapabilitySkills, setBuiltinCapabilitySkills] = useState<Skill[]>([])

  useEffect(() => {
    let cancelled = false
    void loadBuiltinSkills()
      .then((skills) => { if (!cancelled) setBuiltinCapabilitySkills(skills) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const count = migratePromptSkills()
    if (count > 0) showToast(`已把 ${count} 个旧提示词迁移到技能库`, 'success')
  }, [legacyPromptSkills.length, showToast])
  const filteredTasks = useMemo(() => {
    const list = filterStudioTasks(tasks, { query, status: statusFilter, favoriteOnly, model: modelFilter || undefined })
    if (cardSort === 'oldest') return [...list].sort((a, b) => a.createdAt - b.createdAt)
    if (cardSort === 'prompt') return [...list].sort((a, b) => a.prompt.localeCompare(b.prompt, 'zh-CN'))
    return [...list].sort((a, b) => b.createdAt - a.createdAt)
  }, [tasks, query, statusFilter, favoriteOnly, modelFilter, cardSort])
  // 画布视图不再常驻搜索/筛选，避免过滤条件把画布节点藏起来；卡片视图继续使用筛选结果
  const tasksInView = workspace.viewMode === 'grid' ? filteredTasks : tasks
  const taskModelOptions = useMemo(() => {
    const models = new Set<string>()
    for (const task of tasks) {
      if (task.apiModel) models.add(task.apiModel)
    }
    for (const profile of settings.profiles) {
      for (const item of splitModelList(profile.model)) {
        if (item) models.add(item)
      }
    }
    if (modelFilter) models.add(modelFilter)
    return [...models].sort((a, b) => a.localeCompare(b, 'en'))
  }, [tasks, settings.profiles, modelFilter])
  const activeCanvasNodes = useMemo(
    () => workspace.canvases.find((canvas) => canvas.id === workspace.activeCanvasId)?.imageNodes ?? [],
    [workspace.canvases, workspace.activeCanvasId],
  )
  // 参考图素材也要在九宫格里可见，不再只存在于画布与输入台
  const artboards = useArtboards(filteredTasks, activeCanvasNodes)
  // 抽屉的「历史流」只统计生成结果，素材不混进去
  const resultArtboards = useMemo(() => artboards.filter((item) => !item.isAsset), [artboards])
  const missingInputIds = useMemo(
    () => removedInputImageIds(inputImages.map((image) => image.id), activeCanvas?.removedImageIds ?? []),
    [inputImages, activeCanvas?.removedImageIds],
  )
  const canvasViewport = useCanvasViewStore((s) => s.viewport)
  const bottomBarRef = useRef<HTMLDivElement>(null)
  const pendingInputs = useStore((s) => s.pendingInputs)
  const dragCounterRef = useRef(0)
  const dragResetTimerRef = useRef<number | null>(null)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)

  useEffect(() => {
    if (workspace.inputDockPosition !== 'bottom') {
      document.documentElement.style.removeProperty('--input-bar-clearance')
      useCanvasViewStore.getState().setBottomInset(0)
      return
    }
    const el = bottomBarRef.current
    if (!el) return
    const update = () => {
      // 输入台固定在画布底部上方 64px，避让区要把这段空白一起算入
      const clearance = el.offsetHeight + 64
      document.documentElement.style.setProperty('--input-bar-clearance', `${clearance}px`)
      useCanvasViewStore.getState().setBottomInset(clearance)
    }
    const observer = new ResizeObserver(update)
    observer.observe(el)
    update()
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--input-bar-clearance')
      useCanvasViewStore.getState().setBottomInset(0)
    }
  }, [workspace.inputDockPosition])

  useEffect(() => {
    if (!activeCanvas?.id) return
    const timer = setTimeout(() => useWorkspaceStore.getState().setCanvasViewport(activeCanvas.id, canvasViewport), 300)
    return () => clearTimeout(timer)
  }, [activeCanvas?.id, canvasViewport])

  // 项目上次画布只放内存：重启回到项目第一张画布
  useEffect(() => {
    const canvas = workspace.canvases.find((item) => item.id === workspace.activeCanvasId)
    if (canvas) lastCanvasByProjectRef.current.set(canvas.projectId, canvas.id)
  }, [workspace.activeCanvasId, workspace.canvases])

  // 切换画布清掉原画布撤销栈；画布被删除后也清掉对应栈
  useEffect(() => {
    const canvasId = activeCanvas?.id ?? ''
    const previous = lastUndoCanvasRef.current
    if (previous && previous !== canvasId) clearCanvasUndo(previous)
    lastUndoCanvasRef.current = canvasId
  }, [activeCanvas?.id])

  useEffect(() => {
    retainCanvasUndo(workspace.canvases.map((canvas) => canvas.id))
  }, [workspace.canvases])

  useEffect(() => {
    clearAllSelection()
    setSelectionMode(false)
  }, [activeCanvas?.id])

  useEffect(() => {
    const visible = new Set(tasksInView.map((task) => task.id))
    setSelectedTaskIds((previous) => {
      let changed = false
      const next = new Set<string>()
      for (const id of previous) {
        if (visible.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : previous
    })
  }, [tasksInView])

  useEffect(() => () => saveActiveCanvasSnapshot(), [])

  useEffect(() => {
    const workspaceState = useWorkspaceStore.getState()
    const canvas = workspaceState.canvases.find((item) => item.id === workspaceState.activeCanvasId)
    if (canvas && (canvas.promptDraft != null || canvas.paramsDraft || canvas.referenceImageIds?.length || canvas.maskDraft)) {
      void enqueueWorkspaceAction(() => restoreActiveCanvasSnapshot())
    }
  }, [])

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1100)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))
      if (!files.length) return
      event.preventDefault()
      void withInputPending(async () => {
        for (const file of files) {
          await addImageFileToCanvas(useWorkspaceStore.getState().activeCanvasId, file)
        }
      })
    }
    const clearTimer = () => {
      if (dragResetTimerRef.current !== null) {
        window.clearTimeout(dragResetTimerRef.current)
        dragResetTimerRef.current = null
      }
    }
    const reset = () => {
      clearTimer()
      dragCounterRef.current = 0
      setIsDraggingFiles(false)
    }
    const armTimer = () => {
      clearTimer()
      dragResetTimerRef.current = window.setTimeout(reset, 1500)
    }
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
      armTimer()
    }
    const onDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      dragCounterRef.current++
      setIsDraggingFiles(true)
      armTimer()
    }
    const onDragLeave = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
      if (dragCounterRef.current === 0) reset()
      else armTimer()
    }
    // 文件入库只由 CanvasBoard 处理；这里仅复位遮罩
    const onDrop = () => reset()
    const onDragEnd = () => reset()
    const onBlur = () => reset()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') reset()
    }
    const onReset = () => reset()
    document.addEventListener('paste', onPaste)
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    window.addEventListener('dragend', onDragEnd)
    window.addEventListener('blur', onBlur)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('studio-drag-reset', onReset)
    return () => {
      clearTimer()
      document.removeEventListener('paste', onPaste)
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('dragend', onDragEnd)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('studio-drag-reset', onReset)
    }
  }, [])

  useEffect(() => {
    if (!isTauri) return
    void getCurrentWindow().isMaximized().then(setIsMaximized).catch(() => {})
  }, [])

  const activeProfile = getActiveApiProfile(settings)
  const model = resolveApiProfileModel(activeProfile).model
  const modelOptions = useMemo(
    () => splitModelList(settings.profiles.find((profile) => profile.id === activeProfile.id)?.model ?? activeProfile.model)
      .map((item) => ({ id: item, label: item })),
    [activeProfile.id, activeProfile.model, settings.profiles],
  )
  const generationParams = useMemo(() => {
    const base = getGenerationParams(params, model)
    return localExportFormat
      ? { ...base, format: localExportFormat === 'gif' ? 'GIF' as const : 'SVG' as const }
      : base
  }, [params, model, localExportFormat])
  const sizeOptions = useMemo(() => {
    const options = getStudioSizeOptions(model)
    return options.some((option) => option.res === params.size)
      ? options
      // 自定义尺寸直接显示数值，别用「当前」这种看不出结果的占位文案（BUG-05）
      : [{ label: params.size || '自定义尺寸', res: params.size }, ...options]
  }, [model, params.size])

  const folders = useMemo<ProjectFolder[]>(() => {
    const favoriteScheme: ProjectScheme = {
      id: favoritesEntries.canvas.id,
      title: favoritesEntries.canvas.name,
      prompt: '',
      updatedAt: '',
      params: generationParams,
      artboards: [],
    }
    const list: ProjectFolder[] = workspace.projects.map((project) => ({
    id: project.id,
    name: project.name,
    isExpanded: true,
    schemes: workspace.canvases
      .filter((canvas) => canvas.projectId === project.id)
      .map<ProjectScheme>((canvas) => ({
        id: canvas.id,
        title: canvas.name,
        prompt: canvas.promptDraft ?? '',
        updatedAt: new Date(canvas.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        params: getGenerationParams(canvas.paramsDraft ? { ...params, ...canvas.paramsDraft } : params, model),
        artboards: [],
      })),
    }))
    return [{
      id: favoritesEntries.project.id,
      name: favoritesEntries.project.name,
      isExpanded: true,
      schemes: [favoriteScheme],
    }, ...list]
  }, [workspace.projects, workspace.canvases, params, model, generationParams, favoritesEntries])

  const sidebarProjects = useMemo<SidebarProject[]>(() => [{
    id: favoritesEntries.project.id,
    name: favoritesEntries.project.name,
    canvasCount: 1,
    isFavorites: true,
  }, ...workspace.projects.map((project) => ({
    id: project.id,
    name: project.name,
    canvasCount: workspace.canvases.filter((canvas) => canvas.projectId === project.id).length,
  }))], [workspace.projects, workspace.canvases, favoritesEntries])

  const currentScheme = useMemo<ProjectScheme>(() => ({
    id: activeCanvas?.id ?? '',
    title: activeCanvas?.name ?? '画布 1',
    prompt,
    updatedAt: '',
    params: generationParams,
    artboards: [],
  }), [activeCanvas?.id, activeCanvas?.name, prompt, generationParams])

  const selectScheme = (folderId: string, scheme: ProjectScheme) => {
    if (folderId) lastCanvasByProjectRef.current.set(folderId, scheme.id)
    void switchCanvas(scheme.id)
    setSelectedArtboardId(null)
  }

  const selectProject = (projectId: string) => {
    if (isFavoritesProject(projectId)) {
      setActiveActivity('projects')
      void switchCanvas(FAVORITES_CANVAS_ID)
      return
    }
    const canvases = useWorkspaceStore.getState().canvases.filter((canvas) => canvas.projectId === projectId)
    if (!canvases.length) {
      showToast('这个项目还没有画布', 'info')
      return
    }
    const remembered = lastCanvasByProjectRef.current.get(projectId)
    const target = canvases.find((canvas) => canvas.id === remembered) ?? canvases[0]
    setActiveActivity('projects')
    void switchCanvas(target.id)
  }

  const handleParamsChange = (next: typeof generationParams) => {
    setLocalExportFormat(next.format === 'GIF' ? 'gif' : next.format === 'SVG' ? 'svg' : null)
    if (next.model !== model) {
      setSettings({
        profiles: settings.profiles.map((profile) => profile.id === activeProfile.id ? { ...profile, selectedModel: next.model } : profile),
      })
    }
    setParams(toTaskParams(next))
  }

  const savePromptAsSkill = () => {
    if (!prompt.trim()) {
      showToast('提示词为空，无法保存为技能', 'info')
      return
    }
    const now = Date.now()
    const id = `mine:${crypto.randomUUID()}`
    useCapabilitySkillStore.getState().addMine({
      id,
      name: prompt.trim().split(/\r?\n/)[0]?.slice(0, 40) || '未命名技能',
      description: '从当前提示词保存',
      category: '我的',
      coverColor: skillCoverColor(id),
      basePrompt: prompt.trim(),
      slots: [],
      params: { size: params.size, quality: params.quality, model, n: params.n },
      source: 'mine',
      favorite: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    showToast('已保存为技能', 'success')
  }

  const handleGenerate = async (promptText: string, nextParams: typeof generationParams) => {
    if (isFavoritesCanvas(activeCanvas?.id)) {
      showToast('收藏是跨项目汇总视图，请到具体项目里生成', 'info')
      return
    }
    if (submitting) return
    if (pendingInputs > 0) {
      showToast('参考图正在加入，请稍候再提交。', 'info')
      return
    }
    const liveState = useStore.getState()
    const liveSkill = [...mineCapabilitySkills, ...builtinCapabilitySkills].find((item) => item.id === liveState.activeSkillId) ?? null
    const liveSlotValues = liveState.skillSlotValues
    if (!promptText.trim() && !liveSkill) {
      showToast('请输入提示词或先选用技能', 'error')
      return
    }
    setPrompt(promptText)
    handleParamsChange(nextParams)
    const skill = liveSkill
    let finalPrompt = promptText
    let skillContext: TaskSkillContext | undefined
    if (skill) {
      if (/\n\s*\n/.test(promptText)) {
        showToast('技能暂不支持批量提交，请先关闭批量或只保留一条提示词', 'info')
        return
      }
      finalPrompt = composeSkillPrompt(skill, liveSlotValues, promptText)
      if (finalPrompt.length > MAX_PROMPT_LENGTH) {
        showToast(`技能与输入合并后超过 ${MAX_PROMPT_LENGTH} 字上限，请精简后再试`, 'error')
        return
      }
      skillContext = {
        id: skill.id,
        name: skill.name,
        basePrompt: skill.basePrompt,
        slots: skill.slots,
        slotValues: liveSlotValues,
        userPrompt: promptText,
        version: skill.version,
      }
    }
    setSubmitting(true)
    try {
      const canvas = workspace.canvases.find((item) => item.id === activeCanvas?.id)
      const pending = submitTask({
        projectId: activeProject?.id,
        canvasId: activeCanvas?.id,
        viewport: canvas?.viewport,
        anchorTaskId: selectedCanvasTaskId ?? undefined,
        promptOverride: finalPrompt,
        skillContext,
        localExportFormat: nextParams.format === 'GIF' ? 'gif' : nextParams.format === 'SVG' ? 'svg' : undefined,
      })
      const taskIds = await pending
      if (taskIds.length && useStore.getState().settings.clearInputAfterSubmit) {
        setPrompt('')
        clearSkillChip()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const findTask = (taskId?: string) => tasks.find((task) => task.id === taskId)
  const selectedTasks = pickSelectedTasks(filteredTasks, selectedTaskIds)

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const batchFavorite = () => {
    for (const task of selectedTasks) updateTaskInStore(task.id, { isFavorite: true })
    showToast(`已收藏 ${selectedTasks.length} 个任务`, 'success')
  }

  const batchDownload = async () => {
    if (batchDownloadProgress || !selectedTasks.length) return
    const total = selectedTasks.reduce((sum, task) => sum + task.outputImages.length, 0)
    if (!total) return
    let dir: SaveDir | null = null
    if (isTauri) {
      try {
        dir = await pickSaveDir()
      } catch (err) {
        showToast(getDownloadErrorMessage(err), 'error')
        return
      }
      if (!dir) return
    }
    setBatchDownloadProgress({ done: 0, total })
    const useZip = useStore.getState().settings.zipDownloadRoutes.includes('task-selection')
    let failed = 0
    let done = 0
    let location: string | undefined
    let error: string | undefined
    try {
      const result = await downloadTasksImages(selectedTasks, {
        zip: useZip,
        zipFileNameBase: `batch-${Date.now()}`,
        dir,
        onProgress: (nextDone) => setBatchDownloadProgress({ done: nextDone, total }),
      })
      if (result.canceled) return
      done = total
      failed = result.failCount
      location = result.location
      error = result.error
      setBatchDownloadProgress({ done, total })
    } finally {
      setBatchDownloadProgress(null)
    }
    if (failed) showToast(`有 ${failed} 张图片下载失败${error ? `：${error}` : ''}`, 'error')
    else if (location) showToast(withSaveLocation('下载完成', location), 'success')
  }

  const batchDelete = () => {
    if (!selectedTasks.length) return
    useStore.getState().setConfirmDialog({
      title: '删除所选任务',
      message: `将删除 ${selectedTasks.length} 个任务及其输出图，删除后无法恢复。`,
      confirmText: '删除',
      cancelText: '取消',
      tone: 'danger',
      action: () => {
        void deleteTasks(selectedTasks.map((task) => task.id)).then(() => clearAllSelection())
      },
    })
  }

  const selectAllTasks = () => {
    setSelectedTaskIds(selectAllTaskIds(filteredTasks))
  }

  const clearTaskSelection = () => {
    clearAllSelection()
  }

  const addArtboardImage = async (artboard: { taskId?: string; imageId?: string }) => {
    if (!artboard.imageId) return
    if (useStore.getState().inputImages.some((image) => image.id === artboard.imageId)) return
    await withInputPending(async () => {
      const dataUrl = await ensureImageCached(artboard.imageId!)
      if (dataUrl) useStore.getState().addInputImage({ id: artboard.imageId!, dataUrl })
    })
  }

  const openMask = () => {
    const target = useStore.getState().maskDraft?.targetImageId ?? inputImages[0]?.id
    if (!target) {
      showToast('请先添加参考图再使用遮罩', 'error')
      return
    }
    useStore.getState().setMaskEditorImageId(target)
  }

  const focusTask = (taskId: string) => {
    const task = useStore.getState().tasks.find((item) => item.id === taskId)
    if (!task) return
    useWorkspaceStore.getState().setViewMode('canvas')
    const apply = () => {
      const meta = task.canvas
      if (!meta) return
      const view = useCanvasViewStore.getState()
      const k = Math.max(0.6, Math.min(1, view.viewport.k))
      const width = meta.w ?? 360
      const height = meta.h ?? 280
      view.setViewport({
        k,
        x: view.size.width / 2 - (meta.x + width / 2) * k,
        y: Math.max(1, view.size.height - view.bottomInset) / 2 - (meta.y + height / 2) * k,
      })
    }
    if (task.canvasId && task.canvasId !== activeCanvas?.id) {
      void switchCanvas(task.canvasId).then(apply)
    } else {
      apply()
    }
  }

  const confirmDeleteArtboard = (artboardId: string) => {
    const task = findTask(artboardId.split(':')[0])
    if (!task) return
    useStore.getState().setConfirmDialog({
      title: '删除任务',
      message: `将删除整条任务及其 ${task.outputImages.length} 张输出图，删除后无法恢复。`,
      confirmText: '删除任务',
      cancelText: '取消',
      tone: 'danger',
      action: () => { void deleteTask(task) },
    })
  }

  const createStudioProject = () => {
    setActiveActivity('projects')
    void enqueueWorkspaceAction(async () => {
      saveActiveCanvasSnapshot()
      const project = useWorkspaceStore.getState().createProject()
      lastCanvasByProjectRef.current.set(project.projectId, project.canvasId)
      await restoreActiveCanvasSnapshot()
    })
  }

  const createStudioCanvas = (projectId: string) => {
    if (!projectId && !useWorkspaceStore.getState().projects.length) {
      createStudioProject()
      return
    }
    void enqueueWorkspaceAction(async () => {
      saveActiveCanvasSnapshot()
      const targetProjectId = projectId || useWorkspaceStore.getState().activeProjectId
      const canvasId = useWorkspaceStore.getState().createCanvas(targetProjectId)
      lastCanvasByProjectRef.current.set(targetProjectId, canvasId)
      setEditingCanvasId(canvasId)
      await restoreActiveCanvasSnapshot()
    })
  }

  const duplicateStudioCanvas = (canvasId: string) => {
    void enqueueWorkspaceAction(async () => {
      saveActiveCanvasSnapshot()
      const copyId = useWorkspaceStore.getState().duplicateCanvas(canvasId)
      if (!copyId) return
      const canvas = useWorkspaceStore.getState().canvases.find((item) => item.id === copyId)
      if (canvas) lastCanvasByProjectRef.current.set(canvas.projectId, canvas.id)
      await restoreActiveCanvasSnapshot()
      showToast('已复制画布（含布局、参考图、草稿、参数与技能上下文；任务不复制）', 'success')
    })
  }

  const requestDeleteCanvas = (canvasId: string) => {
    const workspaceState = useWorkspaceStore.getState()
    const target = workspaceState.canvases.find((canvas) => canvas.id === canvasId)
    if (!target) return
    if (workspaceState.canvases.filter((canvas) => canvas.projectId === target.projectId).length <= 1) {
      showToast('至少保留一个画布，最后一个画布不能删除', 'info')
      return
    }
    if (editingCanvasId === canvasId) setEditingCanvasId(null)
    const tasks = getCanvasTasks(canvasId)
    const running = getRunningTasks(tasks)
    const openDialog = () => setDeleteTarget({ kind: 'canvas', id: canvasId, name: target.name, taskCount: tasks.length })
    if (!running.length) {
      openDialog()
      return
    }
    useStore.getState().setConfirmDialog({
      title: '先停止运行中的任务',
      message: `画布「${target.name}」还有 ${running.length} 个任务正在生成。继续会先停止这些任务，再选择迁移或删除。`,
      confirmText: '停止并继续',
      cancelText: '取消',
      tone: 'warning',
      action: () => {
        stopTasks(tasks)
        openDialog()
      },
    })
  }

  const requestDeleteProject = (projectId: string) => {
    const target = useWorkspaceStore.getState().projects.find((project) => project.id === projectId)
    if (!target) return
    const tasks = getProjectTasks(projectId)
    const running = getRunningTasks(tasks)
    const openDialog = () => setDeleteTarget({ kind: 'project', id: projectId, name: target.name, taskCount: tasks.length })
    if (!running.length) {
      openDialog()
      return
    }
    useStore.getState().setConfirmDialog({
      title: '先停止运行中的任务',
      message: `项目「${target.name}」还有 ${running.length} 个任务正在生成。继续会先停止这些任务，再选择迁移或删除。`,
      confirmText: '停止并继续',
      cancelText: '取消',
      tone: 'warning',
      action: () => {
        stopTasks(tasks)
        openDialog()
      },
    })
  }

  return (
    <div className="studio-root">
      <TitleBar
        currentProjectTitle={activeProject?.name ?? '盼盼工作台'}
        folders={folders}
        activeFolderId={activeProject?.id ?? ''}
        activeSchemeId={activeCanvas?.id ?? ''}
        onSelectScheme={selectScheme}
        onNewScheme={() => {
          if (activeProject) createStudioCanvas(activeProject.id)
        }}
        onNewFolder={createStudioProject}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        onClearPrompt={() => setPrompt('')}
        onCopyConfig={() => {
          void navigator.clipboard.writeText(JSON.stringify({ prompt, params }, null, 2))
          showToast('已复制当前方案配置', 'success')
        }}
        isMaximized={isMaximized}
        onToggleMaximize={() => {
          if (!isTauri) return
          const win = getCurrentWindow()
          void win.toggleMaximize().then(() => win.isMaximized()).then(setIsMaximized).catch(() => {})
        }}
        onMinimize={() => {
          if (isTauri) void getCurrentWindow().minimize()
        }}
        onClose={() => {
          if (isTauri) void getCurrentWindow().close()
        }}
        onOpenSettings={() => setShowSettings(true)}
        isSidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
        canManageProjects={true}
        showWindowControls={isTauri}
      />

      <div className="relative flex-1 w-full flex overflow-hidden">
        {canvasPickMode && (
          <div className="absolute left-1/2 top-2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-black/10 bg-white/95 px-3 py-1 text-caption text-slate-600 shadow-lg backdrop-blur dark:border-white/10 dark:bg-[#161822]/95 dark:text-slate-300">
            <span>点选画布中的一张图片加入参考图 · Esc 取消</span>
            <button onClick={() => setCanvasPickMode(false)} className="rounded-full bg-black/[0.06] px-2 py-0.5 dark:bg-white/[0.1]">取消</button>
          </div>
        )}
        {maskDraft && (
          <div className="absolute left-2 top-2 z-40 flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-50/95 px-3 py-1 text-caption text-amber-700 shadow-lg backdrop-blur dark:bg-amber-950/80 dark:text-amber-200">
            <span>遮罩已启用 · 目标图 {Math.max(1, inputImages.findIndex((image) => image.id === maskDraft.targetImageId) + 1)}</span>
            <button onClick={() => useStore.getState().clearMaskDraft()} className="rounded-full bg-amber-500/15 px-2 py-0.5">清除</button>
          </div>
        )}
        {batchProgress && (
          <div className="absolute left-1/2 top-2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-black/10 bg-white/95 px-3 py-1 text-caption shadow-lg backdrop-blur dark:border-white/10 dark:bg-[#161822]/95">
            <span className="text-slate-600 dark:text-slate-300">批量 {batchProgress.finished}/{batchProgress.total}</span>
            <span className="h-1 w-24 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <span className="block h-full bg-black dark:bg-white" style={{ width: `${Math.round((batchProgress.finished / Math.max(1, batchProgress.total)) * 100)}%` }} />
            </span>
            <button onClick={() => stopBatchPrompts()} className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-500">停止</button>
          </div>
        )}
        <AppSidebar
          projects={sidebarProjects}
          activeProjectId={activeProject?.id ?? ''}
          onSelectProject={selectProject}
          onNewProject={createStudioProject}
          onRenameProject={(projectId, name) => useWorkspaceStore.getState().renameProject(projectId, name)}
          onDeleteProject={requestDeleteProject}
          onCollapse={() => setSidebarCollapsed(true)}
          activeActivity={activeActivity}
          onSelectActivity={setActiveActivity}
          onOpenSettings={() => setShowSettings(true)}
          isCollapsed={sidebarCollapsed || activeActivity === 'home' || activeActivity === 'skills' || activeActivity === 'workflow'}
          enabledActivities={['home', 'projects', 'workflow', 'skills']}
          canManageProjects={true}
        />

        <div className="relative flex flex-1 overflow-hidden">
          <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {sidebarCollapsed && (
            <div className="absolute left-4 top-14 z-40">
              <button
                type="button"
                onClick={() => {
                  setSidebarCollapsed(false)
                  if (activeActivity !== 'projects') setActiveActivity('projects')
                }}
                className="flex h-[34px] items-center gap-1.5 rounded-full border border-black/[0.04] bg-white/90 px-3 text-[11.5px] font-medium text-slate-700 shadow-[0_10px_30px_-4px_rgba(15,23,42,0.05)] backdrop-blur-xl transition hover:text-black dark:border-white/[0.06] dark:bg-[#141620]/90 dark:text-slate-200 dark:hover:text-white"
                title="展开方案抽屉"
              >
                <span className="text-[13px]">▤</span>
                <span>展开方案</span>
              </button>
            </div>
          )}
          {activeActivity === 'projects' && activeCanvas && workspace.viewMode === 'grid' && (
            <StudioHeader
              title={activeCanvas.name}
              projectName={activeProject?.name}
              count={artboards.length}
              runningCount={runningCount}
            >
              <StudioViewToolbar
                query={query}
                status={statusFilter}
                favoriteOnly={favoriteOnly}
                model={modelFilter}
                models={taskModelOptions}
                selectionMode={selectionMode}
                selectedCount={selectedTaskIds.size}
                sort={cardSort}
                onQueryChange={setQuery}
                onStatusChange={setStatusFilter}
                onModelChange={setModelFilter}
                onToggleFavorite={() => setFavoriteOnly((value) => !value)}
                onToggleSelectionMode={() => {
                  setSelectionMode((value) => !value)
                  clearTaskSelection()
                }}
                onSelectAll={selectAllTasks}
                onClearSelection={clearTaskSelection}
                onBatchFavorite={batchFavorite}
                onBatchDownload={() => void batchDownload()}
                batchDownloadProgress={batchDownloadProgress}
                onBatchDelete={batchDelete}
                onSortChange={setCardSort}
              />
            </StudioHeader>
          )}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {activeActivity === 'home' ? (
              <HomeHubView
                modelOptions={modelOptions}
                params={generationParams}
                sizeOptions={sizeOptions}
                countOptions={[1, 2, 4]}
                onParamsChange={handleParamsChange}
                onGenerate={(text, nextParams) => {
                  if (!activeCanvas) {
                    showToast('请先新建项目和画布', 'info')
                    return
                  }
                  setActiveActivity('projects')
                  void handleGenerate(text, nextParams)
                }}
                isGenerating={submitting || pendingInputs > 0}
              />
            ) : activeActivity === 'projects' ? (
              !workspace.projects.length ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#fbfcfd] text-center dark:bg-[#0c0e14]">
                  <div>
                    <p className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">还没有项目</p>
                    <p className="mt-1 text-body text-slate-500 dark:text-slate-400">新建项目后即可开始创作。</p>
                  </div>
                  <button type="button" onClick={createStudioProject} className="rounded-full bg-black px-5 py-2 text-body text-white dark:bg-white dark:text-black">
                    新建项目
                  </button>
                </div>
              ) : !activeCanvas ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#fbfcfd] text-center dark:bg-[#0c0e14]">
                  <div>
                    <p className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">这个项目还没有画布</p>
                    <p className="mt-1 text-body text-slate-500 dark:text-slate-400">新建画布后即可开始创作。</p>
                  </div>
                  <button type="button" onClick={() => createStudioCanvas(activeProject?.id ?? '')} className="rounded-full bg-black px-5 py-2 text-body text-white dark:bg-white dark:text-black">
                    新建画布
                  </button>
                </div>
              ) : (
                <>
                  {!isFavoritesCanvas(activeCanvas?.id) && (
                    <CanvasCapsuleBar
                      canvases={workspace.canvases.filter((canvas) => canvas.projectId === activeProject?.id && !isFavoritesCanvas(canvas.id))}
                      activeCanvasId={activeCanvas?.id ?? ''}
                      editingCanvasId={editingCanvasId}
                      onEditingChange={setEditingCanvasId}
                      onSwitch={(canvasId) => void switchCanvas(canvasId)}
                      onCreate={() => { if (activeProject) createStudioCanvas(activeProject.id) }}
                      onRename={(canvasId, name) => useWorkspaceStore.getState().renameCanvas(canvasId, name)}
                      onDuplicate={duplicateStudioCanvas}
                      onDelete={requestDeleteCanvas}
                    />
                  )}
                  {workspace.viewMode === 'grid' ? (
                    <CardGridView
                      artboards={artboards}
                      currentScheme={currentScheme}
                      onSendToCanvas={(artboard) => {
                        if (artboard.taskId) focusTask(artboard.taskId)
                      }}
                      onSetAsReference={(artboard) => void addArtboardImage(artboard)}
                      onRecallPrompt={(artboard) => {
                        const task = findTask(artboard.taskId)
                        if (task) void reuseTaskConfig(task)
                      }}
                      onDeleteArtboard={confirmDeleteArtboard}
                      onToggleStar={(id) => {
                        const task = findTask(id.split(':')[0])
                        if (task) updateTaskInStore(task.id, { isFavorite: !task.isFavorite })
                      }}
                      onInspectArtboard={(artboard) => useStore.getState().setDetailTaskId(artboard.taskId ?? null)}
                      onRetryTask={(taskId) => {
                        const task = findTask(taskId)
                        if (task) void retryTaskAction(task)
                      }}
                      isGenerating={runningCount > 0}
                      emptyTitle={isFavoritesCanvas(activeCanvas?.id) ? '还没有收藏' : undefined}
                      emptyDescription={isFavoritesCanvas(activeCanvas?.id) ? '在任意图片上点星标，收藏的内容会汇总到这里。' : undefined}
                      runningCount={runningCount}
                      selectionMode={selectionMode}
                      selectedTaskIds={selectedTaskIds}
                      onToggleTaskSelection={toggleTaskSelection}
                    />
                  ) : (
                    <div className="relative w-full h-full overflow-hidden">
                      <div className="absolute inset-0 stitch-dot-canvas opacity-50 dark:opacity-35 pointer-events-none" />
                      <CanvasBoard
                        tasks={tasksInView}
                        allTaskCount={tasks.length}
                        canvasId={activeCanvas?.id ?? ''}
                        rightInset={narrow && workspace.inputDockPosition === 'right' ? 360 : 0}
                        pickMode={canvasPickMode}
                        onCancelPick={() => setCanvasPickMode(false)}
                        onPickImage={(imageId) => {
                          void withInputPending(async () => {
                            const dataUrl = await ensureImageCached(imageId)
                            if (!dataUrl) {
                              showToast('读取画布图片失败，未加入参考图。', 'error')
                              return
                            }
                            addInputImage({ id: imageId, dataUrl })
                            const added = useStore.getState().inputImages.some((image) => image.id === imageId)
                            if (!added) return
                            setCanvasPickMode(false)
                            showToast('已加入参考图')
                          })
                        }}
                      />
                    </div>
                  )}
                </>
              )
            ) : activeActivity === 'skills' ? (
              <CapabilitySkillLibrary onUsed={() => setActiveActivity('projects')} />
            ) : activeActivity === 'workflow' ? (
              <WorkflowView onBack={() => setActiveActivity('projects')} />
            ) : null}
          </div>

          {workspace.inputDockPosition === 'bottom' && activeActivity === 'projects' && activeCanvas && (
            <div
              ref={bottomBarRef}
              data-input-bar
              className="ui-scale-chrome absolute bottom-16 left-0 right-0 z-30 pointer-events-none flex justify-center"
            >
              <BottomPromptBar
                prompt={prompt}
                onPromptChange={setPrompt}
                onGenerate={(text, nextParams) => void handleGenerate(text, nextParams)}
                isGenerating={submitting || pendingInputs > 0}
                referenceImages={toReferenceImages(inputImages, missingInputIds)}
                onAddReferenceImage={(image) => addInputImage({ id: image.id, dataUrl: image.url })}
                onAddReferenceFile={(file) => void addImageFileToCanvas(activeCanvas?.id ?? '', file)}
                onRemoveReferenceImage={(id) => {
                  const index = inputImages.findIndex((image) => image.id === id)
                  if (index >= 0) useStore.getState().removeInputImage(index)
                }}
                onClearReferenceImages={clearInputImages}
                onReorderReferenceImages={(next) => {
                  useStore.getState().reorderInputImages(next.map((ref) => ref.id))
                }}
                params={generationParams}
                onParamsChange={handleParamsChange}
                onDockRight={() => useWorkspaceStore.getState().setInputDockPosition('right')}
                modelOptions={modelOptions}
                aspectRatios={sizeOptions}
                countOptions={[1, 2, 4]}
                onOpenMask={openMask}
                batchEnabled={settings.batchPromptEnabled}
                onToggleBatch={() => setSettings({ showBatchPrompt: true, batchPromptEnabled: !settings.batchPromptEnabled })}
                onStartCanvasPick={() => setCanvasPickMode((value) => !value)}
                canvasPickActive={canvasPickMode}
                onSaveAsSkill={savePromptAsSkill}
                onManageModels={() => setShowSettings(true, 'api')}
                viewMode={workspace.viewMode}
                onViewModeChange={(mode) => useWorkspaceStore.getState().setViewMode(mode)}
              />
            </div>
          )}

          </div>

          {workspace.inputDockPosition === 'right' && activeActivity === 'projects' && activeCanvas && (
            <div data-right-drawer className={`ui-scale-chrome h-full ${narrow ? 'absolute right-0 top-0 bottom-0 z-30 shadow-2xl' : ''}`}>
              <RightGeneratorDrawer
                prompt={prompt}
                onPromptChange={setPrompt}
                onGenerate={(text, nextParams) => void handleGenerate(text, nextParams)}
                isGenerating={submitting || pendingInputs > 0}
                referenceImages={toReferenceImages(inputImages, missingInputIds)}
                onAddReferenceImage={(image) => addInputImage({ id: image.id, dataUrl: image.url })}
                onAddReferenceFile={(file) => void addImageFileToCanvas(activeCanvas?.id ?? '', file)}
                onRemoveReferenceImage={(id) => {
                  const index = inputImages.findIndex((image) => image.id === id)
                  if (index >= 0) useStore.getState().removeInputImage(index)
                }}
                onClearReferenceImages={clearInputImages}
                onReorderReferenceImages={(next) => {
                  useStore.getState().reorderInputImages(next.map((ref) => ref.id))
                }}
                params={generationParams}
                onParamsChange={handleParamsChange}
                canvasId={activeCanvas?.id}
                artboards={resultArtboards}
                selectedArtboardId={selectedArtboardId}
                onSelectArtboard={setSelectedArtboardId}
                onFocusArtboard={(artboardId) => {
                  focusTask(artboardId.split(':')[0])
                }}
                onSetAsReference={(artboard) => void addArtboardImage(artboard)}
                onRecallPrompt={(artboard) => {
                  const task = findTask(artboard.taskId)
                  if (task) void reuseTaskConfig(task)
                }}
                onCloseOrDockBottom={() => useWorkspaceStore.getState().setInputDockPosition('bottom')}
                modelOptions={modelOptions}
                aspectRatios={sizeOptions}
                countOptions={[1, 2, 4]}
                showDockToggle={true}
                apiProfiles={settings.profiles.map((profile) => ({ id: profile.id, name: profile.name }))}
                activeProfileId={settings.activeProfileId}
                onSelectProfile={(id) => setSettings({ activeProfileId: id })}
                batchEnabled={settings.batchPromptEnabled}
                onToggleBatch={() => setSettings({ showBatchPrompt: true, batchPromptEnabled: !settings.batchPromptEnabled })}
                onOpenMask={openMask}
                onStartCanvasPick={() => setCanvasPickMode((value) => !value)}
                canvasPickActive={canvasPickMode}
                onSaveAsSkill={savePromptAsSkill}
                onManageModels={() => setShowSettings(true, 'api')}
                viewMode={workspace.viewMode}
                onViewModeChange={(mode) => useWorkspaceStore.getState().setViewMode(mode)}
              />
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <DeleteWorkspaceDialog
          title={deleteTarget.kind === 'canvas' ? `删除画布「${deleteTarget.name}」` : `删除项目「${deleteTarget.name}」`}
          message={deleteTarget.kind === 'canvas'
            ? `该画布有 ${deleteTarget.taskCount} 个任务。可以移到当前项目的默认画布，或连同任务一起删除。`
            : `该项目有 ${deleteTarget.taskCount} 个任务。可以移到默认项目，或连同任务一起删除。`}
          moveLabel={deleteTarget.kind === 'canvas' ? '移到当前项目的默认画布' : '移到默认项目'}
          deleteLabel={deleteTarget.kind === 'canvas' ? '删除画布及其任务' : '删除项目及其任务'}
          onCancel={() => setDeleteTarget(null)}
          onMove={() => {
            const target = deleteTarget
            setDeleteTarget(null)
            if (target.kind === 'canvas') void deleteCanvas(target.id, 'move')
            else void deleteProject(target.id, 'move')
          }}
          onDelete={() => {
            const target = deleteTarget
            setDeleteTarget(null)
            if (target.kind === 'canvas') void deleteCanvas(target.id, 'delete')
            else void deleteProject(target.id, 'delete')
          }}
        />
      )}

      <DragUploadOverlay visible={isDraggingFiles} atImageLimit={inputImages.length >= MAX_INPUT_IMAGES} maxImages={MAX_INPUT_IMAGES} />
    </div>
  )
}
