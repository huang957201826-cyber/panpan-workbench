import { useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, Image as ImageIcon, Maximize2, PanelLeftClose, PanelLeftOpen, Paintbrush, Scissors } from 'lucide-react'
import { useViewportLayout } from '../../hooks/useViewportLayout'
import { useStore } from '../../store'
import { WORKFLOWS } from '../workflows/manifest'
import {
  addWorkflowResult,
  createWorkflow,
  initializeSavedWorkflows,
  listWorkflows,
  removeWorkflow,
  removeWorkflowResult,
  renameWorkflow,
  updateWorkflow,
} from '../workflows/projectWorkflows'
import { blobToDataUrl } from '../../lib/dataUrl'
import { deleteResultImages, getResultImage, putResultImage } from '../workflows/resultImageStore'
import { ComfyWorkflowView } from '../modules/workflow/ComfyWorkflowView'
import { MOCK_WORKFLOW_PRESETS } from '../modules/workflow/mockWorkflows'
import { EngineRow, LocalEngineCard, useEngineStatus } from './LocalEngineCard'
import { WorkflowProjectPicker } from './WorkflowProjectPicker'
import {
  SIDEBAR_BODY_CLASS,
  SIDEBAR_FOOTER_BUTTON_CLASS,
  SIDEBAR_FOOTER_CLASS,
  SIDEBAR_HEADER_CLASS,
  SIDEBAR_ICON_BUTTON_CLASS,
  SIDEBAR_ITEM_ACTIVE_CLASS,
  SIDEBAR_ITEM_CLASS,
  SIDEBAR_ITEM_IDLE_CLASS,
  SIDEBAR_PANEL_CLASS,
  SIDEBAR_TITLE_CLASS,
} from './sidebarStyles'
import type { WorkflowHistoryRecord, WorkflowProject, WorkflowPreset } from '../modules/workflow/types'

/** 四条流程：无损放大与抠图已真跑通，两条 qwen 流程可用但较慢 */
const FLOWS = [
  { key: 'upscale', label: '无损放大', manifestId: 'qwen-upscale' },
  { key: 'cutout', label: '抠图', manifestId: 'matte-cutout' },
  { key: 'inpaint', label: '局部重绘', manifestId: 'qwen-retouch' },
  { key: 'model-to-render', label: '截图转效果图', manifestId: 'qwen-su-render' },
]

const FLOW_ICONS = { upscale: Maximize2, cutout: Scissors, inpaint: Paintbrush, 'model-to-render': ImageIcon }
const SIDEBAR_KEY = 'panpan-workflow-sidebar-collapsed'
const DRAFT_PROJECT: WorkflowProject = { id: 'draft', name: '草稿（未保存）', updatedAt: '', records: [] }

function savedProjects(): Promise<WorkflowProject[]> {
  return Promise.all(
    listWorkflows().map(async (workflow) => {
      const records: WorkflowHistoryRecord[] = []
      for (const result of workflow.results ?? []) {
        if (!result.record) continue
        const outputUrl = await getResultImage(result.imageId) ?? ''
        const inputUrl = result.inputImageId ? (await getResultImage(result.inputImageId)) ?? '' : ''
        records.push({
          ...result.record,
          inputUrl,
          outputUrl,
          batchUrls: outputUrl ? [outputUrl] : [],
          missingImageIds: result.missingImageIds,
        })
      }
      return {
        id: workflow.id,
        name: workflow.name,
        updatedAt: new Date(workflow.updatedAt).toISOString(),
        records,
      }
    }),
  )
}

/** 工作流画布：页面内左栏（引擎 / 流程）+ 底部「保存的工作流」弹层 */
export function WorkflowHub() {
  const showToast = useStore((state) => state.showToast)
  const viewportLayout = useViewportLayout()
  const engine = useEngineStatus()
  const [flowKey, setFlowKey] = useState('upscale')
  const [projects, setProjects] = useState<WorkflowProject[]>([DRAFT_PROJECT])
  const [activeProjectId, setActiveProjectId] = useState('draft')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [enginePanelOpen, setEnginePanelOpen] = useState(false)
  const [saveProjectOpen, setSaveProjectOpen] = useState(false)
  const [saveProjectName, setSaveProjectName] = useState('')
  const pendingValuesRef = useRef<Record<string, string | number | boolean>>({})
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_KEY)
      if (saved === '1') return true
      if (saved === '0') return window.innerWidth < 680
      return window.innerWidth < 1080
    } catch {
      return window.innerWidth < 1080
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
    } catch {
      // 侧栏偏好写失败不影响使用
    }
  }, [collapsed])

  const reloadProjects = () => {
    void savedProjects().then((saved) => {
      setProjects((current) => {
        const draft = current.find((project) => project.id === 'draft') ?? DRAFT_PROJECT
        return [draft, ...saved]
      })
    })
  }

  useEffect(() => {
    void initializeSavedWorkflows().then(reloadProjects).catch((err) => {
      showToast(`读取工作流失败：${err instanceof Error ? err.message : String(err)}`, 'error')
    })
  }, [])

  const activeFlow = FLOWS.find((item) => item.key === flowKey) ?? FLOWS[0]
  const activeProject = projects.find((project) => project.id === activeProjectId && project.id !== 'draft')

  const activePreset = useMemo<WorkflowPreset>(() => {
    const manifest = WORKFLOWS.find((item) => item.id === activeFlow.manifestId)
    const demo =
      MOCK_WORKFLOW_PRESETS.find((preset) => preset.category === activeFlow.key) ?? MOCK_WORKFLOW_PRESETS[0]
    return {
      ...demo,
      id: manifest?.id ?? demo.id,
      name: manifest?.name ?? demo.name,
      description: manifest?.description ?? demo.description,
    }
  }, [activeFlow])

  const persistRecord = async (workflowId: string, record: WorkflowHistoryRecord) => {
    try {
      if (!record.outputUrl) return
      const response = await fetch(record.outputUrl)
      const blob = await response.blob()
      const imageId = await putResultImage(await blobToDataUrl(blob, 'image/png'))
      const inputImageId = record.inputUrl?.startsWith('data:')
        ? await putResultImage(record.inputUrl)
        : undefined
      await addWorkflowResult(workflowId, {
        imageId,
        inputImageId,
        record: {
          id: record.id,
          presetId: record.presetId,
          presetName: record.presetName,
          toolId: record.toolId,
          toolLabel: record.toolLabel,
          title: record.title,
          createdAt: record.createdAt,
          duration: record.duration,
          resolution: record.resolution,
          summary: record.summary,
          paramsSnapshot: record.paramsSnapshot,
        },
        createdAt: Date.now(),
      })
    } catch (err) {
      console.warn('保存工作流记录失败：', err)
    }
  }

  const persistRecords = async (workflowId: string, records: WorkflowHistoryRecord[]) => {
    // 记录按新到旧排列，先写旧的后，最终最新一条仍在最上面
    for (const record of [...records].reverse()) {
      await persistRecord(workflowId, record)
    }
  }

  /** 保存当前画布为工作流；已绑定时改名并写回存储 */
  const saveCurrentAs = async (name: string) => {
    const value = name.trim()
    if (!value) return
    if (activeProject) {
      await renameWorkflow(activeProject.id, value)
      setProjects((list) =>
        list.map((project) =>
          project.id === activeProject.id
            ? { ...project, name: value, updatedAt: new Date().toISOString() }
            : project,
        ),
      )
      showToast(`已重命名为「${value}」`, 'success')
      return
    }
    const draftRecords = projects.find((project) => project.id === 'draft')?.records ?? []
    const created = await createWorkflow({
      workspaceProjectId: null,
      presetId: activeFlow.manifestId,
      name: value,
      values: { flow: activeFlow.key },
    })
    setProjects((list) => [
      ...list,
      { id: created.id, name: value, updatedAt: new Date().toISOString(), records: draftRecords },
    ])
    setActiveProjectId(created.id)
    showToast(`已保存工作流「${value}」`, 'success')
    void persistRecords(created.id, draftRecords).then(reloadProjects)
  }

  const requestSaveProject = async (values: Record<string, string | number | boolean>) => {
    if (activeProject) {
      await updateWorkflow(activeProject.id, {
        presetId: activeFlow.manifestId,
        values,
        lastRunAt: Date.now(),
      })
      setProjects((list) =>
        list.map((project) =>
          project.id === activeProject.id ? { ...project, updatedAt: new Date().toISOString() } : project,
        ),
      )
      showToast(`已保存工作流「${activeProject.name}」`, 'success')
      return
    }
    pendingValuesRef.current = values
    setSaveProjectName(`${activeFlow.label}工作流`)
    setSaveProjectOpen(true)
  }

  const confirmSaveProject = async () => {
    const name = saveProjectName.trim()
    if (!name) return
    const draftRecords = projects.find((project) => project.id === 'draft')?.records ?? []
    const created = await createWorkflow({
      workspaceProjectId: null,
      presetId: activeFlow.manifestId,
      name,
      values: pendingValuesRef.current,
    })
    setProjects((list) => [
      ...list,
      { id: created.id, name, updatedAt: new Date().toISOString(), records: draftRecords },
    ])
    setActiveProjectId(created.id)
    setSaveProjectOpen(false)
    showToast(`已保存工作流「${name}」`, 'success')
    void persistRecords(created.id, draftRecords).then(reloadProjects)
  }

  return (
    <div className="flex h-full w-full flex-col min-[680px]:flex-row bg-[#f3f4f8] dark:bg-[#0c0e14]">
      {viewportLayout.isPhone && (
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-black/[0.05] bg-[#fbfcfd] px-3 py-2 dark:border-white/[0.06] dark:bg-[#12141c]">
        <button
          type="button"
          onClick={() => setEnginePanelOpen((open) => !open)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1 text-caption font-medium text-slate-700 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-200"
          title={engine.probe?.ok ? '算力引擎已连接，点击配置地址' : '算力引擎未连接，点击配置地址'}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${engine.probe?.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          {engine.probe?.ok ? '引擎在线' : '连接引擎'}
        </button>
        {FLOWS.map((flow) => (
          <button
            key={flow.key}
            type="button"
            onClick={() => setFlowKey(flow.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-caption font-medium transition ${
              flowKey === flow.key
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'bg-black/[0.04] text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'
            }`}
          >
            {flow.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="ml-auto shrink-0 rounded-full border border-black/10 px-2.5 py-1 text-caption text-slate-600 dark:border-white/15 dark:text-slate-300"
        >
          已保存
        </button>
      </div>
      )}
      <aside
        data-workflow-rail
        className={`hidden min-[680px]:flex ${collapsed ? 'h-full w-12 shrink-0 flex-col border-r border-black/[0.05] bg-[#fbfcfd] dark:border-white/[0.06] dark:bg-[#12141c]' : SIDEBAR_PANEL_CLASS} transition-[width] duration-150`}
      >
        <div className={`${SIDEBAR_HEADER_CLASS} ${collapsed ? 'items-center justify-center px-2' : ''}`}>
          {!collapsed && (
            <h2 className={`${SIDEBAR_TITLE_CLASS} truncate`}>工作流</h2>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? '展开左栏' : '收起左栏'}
            className={SIDEBAR_ICON_BUTTON_CLASS}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {collapsed ? (
          <div className="flex flex-col items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEnginePanelOpen((open) => !open)}
              title={engine.probe?.ok ? '本地引擎运行中（点击配置地址）' : '本地引擎未运行（点击配置地址）'}
              aria-label="配置算力引擎"
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08] cursor-pointer"
            >
              <span className={`h-2 w-2 rounded-full ${engine.probe?.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </button>
            {FLOWS.map((flow) => {
              const Icon = FLOW_ICONS[flow.key as keyof typeof FLOW_ICONS] ?? Maximize2
              return (
                <button
                  key={flow.key}
                  type="button"
                  onClick={() => setFlowKey(flow.key)}
                  title={flow.label}
                  aria-label={flow.label}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                    flowKey === flow.key
                      ? 'bg-black text-white dark:bg-white dark:text-black'
                      : 'text-slate-500 hover:bg-black/[0.05] dark:text-slate-400 dark:hover:bg-white/[0.08]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              )
            })}
          </div>
        ) : (
          <div className={`${SIDEBAR_BODY_CLASS} space-y-4`}>
            <section className="space-y-2">
              <div className="px-1 text-micro font-semibold tracking-wide text-slate-400">本地引擎</div>
              <EngineRow engine={engine} onConfigure={() => setEnginePanelOpen((open) => !open)} />
            </section>

            <section className="space-y-1.5">
              <div className="px-1 text-micro font-semibold tracking-wide text-slate-400">流程</div>
              {FLOWS.map((flow) => (
                <button
                  key={flow.key}
                  type="button"
                  onClick={() => setFlowKey(flow.key)}
                  className={`${SIDEBAR_ITEM_CLASS} text-left ${flowKey === flow.key ? `${SIDEBAR_ITEM_ACTIVE_CLASS} font-semibold` : SIDEBAR_ITEM_IDLE_CLASS}`}
                >
                  {flow.label}
                </button>
              ))}
            </section>
          </div>
        )}

        {!collapsed && (
          <div className={SIDEBAR_FOOTER_CLASS}>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={SIDEBAR_FOOTER_BUTTON_CLASS}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              保存的工作流
            </button>
          </div>
        )}
      </aside>

      <div className="relative flex-1 min-w-0 h-full">
        <ComfyWorkflowView
          activePreset={activePreset}
          workflowProjects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={setActiveProjectId}
          onCreateProject={saveCurrentAs}
          onSaveProject={requestSaveProject}
          onSavePreset={saveCurrentAs}
          onAddHistoryRecord={(projectId, record) => {
            setProjects((list) =>
              list.map((project) =>
                project.id === projectId ? { ...project, records: [record, ...project.records] } : project,
              ),
            )
            if (projectId !== 'draft') void persistRecord(projectId, record)
          }}
          onDeleteHistoryRecord={async (projectId, recordId) => {
            setProjects((list) =>
              list.map((project) =>
                project.id === projectId
                  ? { ...project, records: project.records.filter((record) => record.id !== recordId) }
                  : project,
              ),
            )
            if (projectId !== 'draft') {
              const removed = await removeWorkflowResult(projectId, recordId)
              if (removed) await deleteResultImages([removed.imageId, removed.inputImageId])
            }
          }}
          onQueueComplete={(message) => showToast(message, 'info')}
        />

        <LocalEngineCard
          engine={engine}
          forceOpen={enginePanelOpen}
          onClose={() => setEnginePanelOpen(false)}
        />

        {/* 当前工作流 / 草稿状态（手机端底部栏已展示，隐藏顶部悬浮以免遮挡工具栏） */}
        <div className="hidden min-[680px]:block absolute top-3.5 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div
            className={`h-8 px-3 rounded-full backdrop-blur-md border flex items-center gap-1.5 text-caption ${
              activeProject
                ? 'bg-white/95 dark:bg-[#141620]/95 border-black/[0.06] dark:border-white/[0.08] text-slate-700 dark:text-slate-200'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            {activeProject ? activeProject.name : '草稿（未保存）'}
          </div>
        </div>
      </div>

      <WorkflowProjectPicker
        open={pickerOpen}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelect={setActiveProjectId}
        onCreate={saveCurrentAs}
        onRename={(id, name) => {
          void renameWorkflow(id, name)
          setProjects((list) =>
            list.map((project) =>
              project.id === id ? { ...project, name, updatedAt: new Date().toISOString() } : project,
            ),
          )
        }}
        onDelete={async (id) => {
          const entry = listWorkflows().find((item) => item.id === id)
          if (entry) await deleteResultImages((entry.results ?? []).flatMap((result) => [result.imageId, result.inputImageId]))
          await removeWorkflow(id)
          if (activeProjectId === id) setActiveProjectId('draft')
          reloadProjects()
        }}
        onClose={() => setPickerOpen(false)}
      />

      {saveProjectOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#161822] border border-black/[0.08] dark:border-white/[0.1] shadow-xl p-5 space-y-4">
            <div className="text-body font-bold text-slate-900 dark:text-white">保存工作流</div>
            <label className="block space-y-1.5">
              <span className="text-caption text-slate-500 dark:text-slate-400">工作流名称</span>
              <input
                autoFocus
                value={saveProjectName}
                onChange={(event) => setSaveProjectName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') confirmSaveProject()
                  if (event.key === 'Escape') setSaveProjectOpen(false)
                }}
                className="w-full h-9 rounded-xl border border-black/[0.1] dark:border-white/[0.12] bg-transparent px-3 text-caption text-slate-800 dark:text-slate-100 outline-none focus:border-black/30 dark:focus:border-white/30"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaveProjectOpen(false)}
                className="h-9 px-3.5 rounded-full text-caption text-slate-600 dark:text-slate-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmSaveProject}
                className="h-9 px-4 rounded-full bg-black text-white dark:bg-white dark:text-black text-caption font-semibold cursor-pointer"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
