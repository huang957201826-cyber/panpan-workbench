// ===== 设置 =====

export type ApiMode = 'images' | 'responses'
export const REASONING_EFFORT_VALUES = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export type ReasoningEffort = typeof REASONING_EFFORT_VALUES[number]
export type AppMode = 'gallery' | 'agent'
export type AgentApiConfigMode = 'off' | 'native' | 'hybrid'
export const ZIP_DOWNLOAD_ROUTE_VALUES = [
  'task-selection',
  'favorite-collection-selection',
  'image-context-menu-all',
  'task-detail-all',
  'task-detail-partial',
  'agent-round-all',
] as const
export type ZipDownloadRoute = typeof ZIP_DOWNLOAD_ROUTE_VALUES[number]
export const DEFAULT_ZIP_DOWNLOAD_ROUTES: ZipDownloadRoute[] = ['task-selection', 'favorite-collection-selection']
export type BuiltInApiProvider = 'openai' | 'sb2api-async' | 'fal' | 'google'
export type ApiProvider = BuiltInApiProvider | string
export type CustomProviderTemplate = 'http-image'
export const DEFAULT_STREAM_PARTIAL_IMAGES = 1
export const DEFAULT_AGENT_MAX_TOOL_ROUNDS = 15
/** 接口允许的参考图数量上限 */
export const MAX_INPUT_IMAGES = 16

export type CustomProviderRequestMethod = 'GET' | 'POST'
export type CustomProviderContentType = 'json' | 'multipart'
export type CustomProviderFileSource = 'inputImages' | 'mask'

export interface CustomProviderFileMapping {
  field: string
  source: CustomProviderFileSource
  array?: boolean
}

export interface CustomProviderResultMapping {
  imageUrlPaths?: string[]
  b64JsonPaths?: string[]
}

export interface CustomProviderSubmitMapping {
  path: string
  method?: CustomProviderRequestMethod
  contentType?: CustomProviderContentType
  query?: Record<string, string>
  body?: Record<string, unknown>
  files?: CustomProviderFileMapping[]
  taskIdPath?: string
  result?: CustomProviderResultMapping
}

export interface CustomProviderPollMapping {
  path: string
  method?: CustomProviderRequestMethod
  query?: Record<string, string>
  intervalSeconds?: number
  statusPath: string
  successValues: string[]
  failureValues: string[]
  errorPath?: string
  result: CustomProviderResultMapping
}

export interface CustomProviderDefinition {
  id: string
  name: string
  template?: CustomProviderTemplate
  submit: CustomProviderSubmitMapping
  editSubmit?: CustomProviderSubmitMapping
  poll?: CustomProviderPollMapping
}

export interface ApiProfile {
  id: string
  /** 当前部署指定的默认预置配置。 */
  isDefault?: boolean
  name: string
  /** 预置配置的 Markdown 说明。 */
  description?: string
  provider: ApiProvider
  baseUrl: string
  apiKey: string
  /** 模型 ID 列表，多个模型以 `, ` 分隔 */
  model: string
  /** 首页选中的模型；不在列表中时回退到第一个 */
  selectedModel?: string
  imageGenerationModel?: string
  timeout: number
  apiMode: ApiMode
  reasoningEffort?: ReasoningEffort
  codexCli: boolean
  apiProxy: boolean
  responseFormatB64Json?: boolean
  streamImages?: boolean
  streamPartialImages?: number
  transparentBackgroundMethod: 'api' | 'local'
  providerDrafts?: Partial<Record<ApiProvider, Partial<Pick<ApiProfile, 'baseUrl' | 'model' | 'imageGenerationModel' | 'apiMode' | 'reasoningEffort' | 'codexCli' | 'apiProxy' | 'responseFormatB64Json' | 'streamImages' | 'streamPartialImages' | 'transparentBackgroundMethod'>>>>
}

export interface PresetAgentConfig {
  apiConfigMode?: AgentApiConfigMode
  textProfileId?: string
  imageProfileId?: string
}

export interface PresetConfig {
  customProviders: CustomProviderDefinition[]
  profiles: ApiProfile[]
  agent?: PresetAgentConfig
}

/** 参考图预览中“编辑图片”按钮的默认行为 */
export type ReferenceImageEditAction = 'ask' | 'sketch' | 'mask'

/** 仅客户端：下载和导出时每次询问保存位置，还是直接保存到默认保存地址 */
export type SaveLocationMode = 'ask' | 'default'

/** 重试任务时新建任务，还是覆盖原任务 */
export type RetryMode = 'new' | 'overwriteFailed' | 'overwriteAll'

/** 字体选择：default 表示使用部署默认（VITE_DEFAULT_UI_FONT / VITE_DEFAULT_MONO_FONT）；builtin 为随安装包分发的内置字体 */
export type FontMode = 'default' | 'builtin' | 'system' | 'custom'
export type ColorMode = 'system' | 'light' | 'dark'

/** 打开画板的请求：baseImageSrc 为空时是空白画板，replaceImageId 表示完成后替换该参考图 */
export interface SketchBoardRequest {
  baseImageSrc: string | null
  replaceImageId?: string
}

/** 正在进行的批量提交进度 */
export interface BatchProgress {
  total: number
  started: number
  finished: number
}

/** 批量提交模式：排队逐条执行，或按并发数同时执行 */
export type BatchPromptMode = 'queue' | 'concurrent'

export interface AppSettings {
  /** 旧版单配置字段：保留用于导入/查询参数兼容，实际请求以 active profile 为准 */
  baseUrl: string
  apiKey: string
  model: string
  timeout: number
  apiMode: ApiMode
  codexCli: boolean
  apiProxy: boolean
  streamImages?: boolean
  streamPartialImages?: number
  customProviders: CustomProviderDefinition[]
  providerOrder?: string[]
  clearInputAfterSubmit: boolean
  persistInputOnRestart: boolean
  reuseTaskApiProfileTemporarily: boolean
  alwaysShowRetryButton: boolean
  /** 在收藏夹页新建的任务自动加入当前收藏夹 */
  saveTasksToActiveFavoriteCollection: boolean
  retryMode: RetryMode
  allowPromptRewrite: boolean
  taskCompletionNotification: boolean
  /** 仅客户端：把警告和错误写入日志文件 */
  writeLogFile: boolean
  enterSubmit: boolean
  /** 切换隐私模式的快捷键，如 Ctrl+Shift+H；空字符串表示禁用 */
  privacyModeShortcut: string
  colorMode: ColorMode
  uiFont: FontMode
  /** uiFont 为 custom 时使用的本机字体名称 */
  uiFontName: string
  monoFont: FontMode
  /** monoFont 为 custom 时使用的本机字体名称 */
  monoFontName: string
  /** 偏好设置：是否在首页提供多提示词批量提交 */
  showBatchPrompt: boolean
  /** 多提示词批量提交，提示词之间空两行分隔 */
  batchPromptEnabled: boolean
  batchPromptMode: BatchPromptMode
  /** 并发模式下是否限制并发数（默认开启），关闭时全部同时提交 */
  batchPromptConcurrencyLimited: boolean
  batchPromptConcurrency: number
  referenceImageEditAction: ReferenceImageEditAction
  zipDownloadRoutes: ZipDownloadRoute[]
  /** 仅客户端：默认保存地址本身由 Rust 侧保存，不在设置中 */
  saveLocationMode: SaveLocationMode
  agentScrollToBottomAfterSubmit: boolean
  agentMaxToolRounds: number
  agentWebSearch: boolean
  agentMathFormattingPrompt: boolean
  agentApiConfigMode: AgentApiConfigMode
  agentTextProfileId?: string | null
  agentImageProfileId?: string | null
  /** 是否启用 Studio 壳子；关闭时回退旧布局 */
  studioShellEnabled?: boolean
  /** 界面缩放百分比：只缩放 UI 外壳，画布世界坐标不变 */
  uiScale?: UiScale
  profiles: ApiProfile[]
  activeProfileId: string
}

// ===== 任务参数 =====

export interface TaskParams {
  size: string
  quality: 'auto' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  output_format: 'png' | 'jpeg' | 'webp'
  output_compression: number | null
  moderation: 'auto' | 'low'
  n: number
  transparent_output: boolean
}

export const DEFAULT_PARAMS: TaskParams = {
  size: 'auto',
  quality: 'auto',
  output_format: 'png',
  output_compression: null,
  moderation: 'auto',
  n: 1,
  transparent_output: false,
}

// ===== 输入图片（UI 层面） =====

export interface InputImage {
  /** IndexedDB image store 的 id（SHA-256 hash） */
  id: string
  /** data URL，用于预览 */
  dataUrl: string
}

/** 参考图上的评论标注，x / y 为相对原图宽高的比例（0~1） */
export interface ImageComment {
  x: number
  y: number
  text: string
}

export interface MaskDraft {
  targetImageId: string
  maskDataUrl: string
  updatedAt: number
}

export interface AgentInputDraft {
  prompt: string
  inputImages: InputImage[]
  maskDraft: MaskDraft | null
  maskEditorImageId: string | null
  updatedAt?: number
}

// ===== 项目 / 画布 =====

export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  archived?: boolean
}

/** 画布上的图片素材节点：参考图与生成图都属于画布内容 */
export interface CanvasImageNode {
  id: string
  imageId: string
  x: number
  y: number
  w: number
  h: number
  z?: number
}

export interface ProjectCanvas {
  id: string
  projectId: string
  name: string
  order: number
  /** 每画布独立快照 */
  viewport?: ViewportTransform
  promptDraft?: string
  paramsDraft?: Partial<TaskParams>
  referenceImageIds?: string[]
  maskDraft?: MaskDraft | null
  maskEditorImageId?: string | null
  /** 画布素材/成品总库中的图片节点 */
  imageNodes?: CanvasImageNode[]
  /** 已从画布删除、但输入框仍保留选择的素材 */
  removedImageIds?: string[]
  /** 当前画布选用的能力技能与槽位值；与 promptDraft 同生命周期 */
  activeSkillId?: string | null
  skillSlotValues?: Record<string, SkillSlotValue>
  createdAt: number
  updatedAt: number
}

export type UiScale = 100 | 110 | 125 | 150

export const UI_SCALE_OPTIONS: UiScale[] = [100, 110, 125, 150]

/** 技能库 V1：只保存提示词与可选参数，不保存参考图/Key/路径 */
export interface PromptSkillParams {
  size?: string
  quality?: string
  model?: string
  n?: number
}

/** 技能里的参数槽：提示词用 {{key}} 占位，调用时替换成实际值 */
export interface SkillVariable {
  key: string
  label: string
  defaultValue: string
  options?: string[]
}

export interface PromptSkill {
  id: string
  title: string
  prompt: string
  tags: string[]
  category?: string
  params?: PromptSkillParams
  sourceTaskId?: string
  /** 置顶只影响排序，收藏是独立筛选轴 */
  pinned?: boolean
  favorite?: boolean
  /** 封面用本地图片 id（从任务保存时抓第一张输出图）；为空走确定性渐变兜底 */
  coverImageId?: string
  variables?: SkillVariable[]
  negativePrompt?: string
  usageCount?: number
  author?: string
  createdAt: number
  updatedAt: number
  /** 固定为 prompt；能力技能单独存放，不混入此数组 */
  kind?: 'prompt'
}

export type SkillSlotType = 'text' | 'enum' | 'multi' | 'number' | 'bool' | 'image' | 'multi-image'
export type SkillSlotValue = string | string[] | number | boolean

export interface SkillSlot {
  key: string
  label: string
  type: SkillSlotType
  placeholder?: string
  defaultValue?: SkillSlotValue
  options?: string[]
  required?: boolean
}

/** 图片槽与技能输入的绑定，min/max 为该槽允许的图片数 */
export interface SkillRequiredImages {
  slotKey: string
  min: number
  max: number
  roles?: string[]
}

export interface Skill {
  id: string
  name: string
  description: string
  category: string
  coverColor: string
  coverImageId?: string
  /** 主图之外的参考图/示例图，按顺序展示 */
  referenceImageIds?: string[]
  basePrompt: string
  slots: SkillSlot[]
  negativePrompt?: string
  params?: PromptSkillParams
  requiredImages?: SkillRequiredImages[]
  examples?: string[]
  source: 'builtin' | 'mine'
  /** 适用模型；空表示通用 */
  model?: string
  /** 收藏只影响筛选，不改变排序 */
  favorite?: boolean
  version: number
  createdAt: number
  updatedAt: number
}

export interface TaskSkillContext {
  id: string
  name: string
  basePrompt: string
  slots: SkillSlot[]
  slotValues: Record<string, SkillSlotValue>
  userPrompt: string
  version: number
}

export interface WorkspaceState {
  version: 1
  projects: Project[]
  canvases: ProjectCanvas[]
  activeProjectId: string
  activeCanvasId: string
  viewMode: 'grid' | 'canvas'
  inputDockPosition: 'right' | 'bottom'
}

// ===== 任务记录 =====

export type TaskStatus = 'running' | 'done' | 'error'

/** 画布视口：x/y 为屏幕平移量，k 为缩放 */
export interface ViewportTransform {
  x: number
  y: number
  k: number
}

/** 任务在画布上的世界坐标；缺省时按自动布局计算 */
export interface TaskCanvasMeta {
  x: number
  y: number
  w?: number
  h?: number
  /** 用户手动拖过右下角手柄；为真时保留自定义尺寸，否则按图片真实比例自动计算 */
  userSized?: boolean
}

export interface TaskRecord {
  id: string
  prompt: string
  /** 使用能力技能时的原始上下文；prompt 保存合并后的最终文本 */
  skillContext?: TaskSkillContext
  params: TaskParams
  /** 用户选择的本地导出格式；GIF/SVG 不发给 API，下载时本地转换 */
  localExportFormat?: 'gif' | 'svg'
  /** 生成时使用的 Provider 类型 */
  apiProvider?: ApiProvider
  /** 生成时使用的 API 配置 ID */
  apiProfileId?: string
  /** 生成时使用的 Provider 名称 */
  apiProfileName?: string
  /** 生成时使用的 API 模式 */
  apiMode?: ApiMode
  /** 生成时使用的模型 ID */
  apiModel?: string
  /** fal.ai 队列请求 ID，用于连接断开后的结果恢复 */
  falRequestId?: string
  /** fal.ai 队列 endpoint，用于连接断开后的状态和结果查询 */
  falEndpoint?: string
  /** fal.ai 任务连接断开后是否等待自动恢复 */
  falRecoverable?: boolean
  /** 自定义异步服务商任务 ID，用于重启后继续查询结果 */
  customTaskId?: string
  /** 自定义异步任务是否等待自动恢复 */
  customRecoverable?: boolean
  /** API 返回的实际生效参数，用于标记与请求值不一致的情况 */
  actualParams?: Partial<TaskParams>
  /** 输出图片对应的实际生效参数，key 为 outputImages 中的图片 id */
  actualParamsByImage?: Record<string, Partial<TaskParams>>
  /** 输出图片对应的 API 改写提示词，key 为 outputImages 中的图片 id */
  revisedPromptByImage?: Record<string, string>
  /** 是否启用透明背景后处理 */
  transparentOutput?: boolean
  /** 实际发送给 API 的透明背景辅助提示词 */
  transparentPrompt?: string
  /** 透明背景后处理前的原始输出图片 id，顺序对应 outputImages */
  transparentOriginalImages?: string[]
  /** 输入图片的 image store id 列表 */
  inputImageIds: string[]
  maskTargetImageId?: string | null
  maskImageId?: string | null
  /** 输出图片的 image store id 列表 */
  outputImages: string[]
  /** 并发多图中失败的输出槽位，requestIndex 为从 0 开始的请求序号 */
  outputErrors?: Array<{ requestIndex: number; error: string }>
  /** 流式生成的中间步骤图片 id 列表，仅失败时保留供排查/下载 */
  streamPartialImageIds?: string[]
  /** API 返回的原始图片 HTTP URL（非 base64 时记录） */
  rawImageUrls?: string[]
  /** 发生解析错误时的原始响应 JSON */
  rawResponsePayload?: string
  status: TaskStatus
  error: string | null
  createdAt: number
  /** 本次生成开始时间，重试时不改变原始创建时间 */
  startedAt?: number
  finishedAt: number | null
  /** 总耗时毫秒 */
  elapsed: number | null
  /** 是否收藏 */
  isFavorite?: boolean
  /** 所属收藏夹 ID 列表 */
  favoriteCollectionIds?: string[]
  /** 来源模式：画廊 / Agent */
  sourceMode?: AppMode
  /** Agent 对话 ID */
  agentConversationId?: string
  /** Agent 轮次 ID */
  agentRoundId?: string
  /** Agent 消息 ID */
  agentMessageId?: string
  /** Agent 图像工具调用 ID */
  agentToolCallId?: string
  /** Agent 批量图像工具调用 ID */
  agentBatchCallId?: string
  /** Agent 批量图像工具中的稳定条目 ID */
  agentBatchItemId?: string
  /** Agent 图像工具实际动作 */
  agentToolAction?: 'generate' | 'edit' | 'auto' | string
  /** 画布世界坐标；缺省表示尚未手动摆放 */
  canvas?: TaskCanvasMeta
  /** 所属项目；旧任务读取时归入默认项目 */
  projectId?: string
  /** 所属画布；旧任务读取时归入默认画布 */
  canvasId?: string
}

export interface FavoriteCollection {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

// ===== Agent 模式 =====

export type AgentMessageRole = 'user' | 'assistant'
export type AgentRoundStatus = 'running' | 'done' | 'error'

export interface AgentMessage {
  id: string
  role: AgentMessageRole
  content: string
  roundId: string
  inputImageIds?: string[]
  maskTargetImageId?: string | null
  maskImageId?: string | null
  outputTaskIds?: string[]
  createdAt: number
}

export interface AgentRound {
  id: string
  index: number
  parentRoundId?: string | null
  userMessageId: string
  assistantMessageId?: string
  prompt: string
  inputImageIds: string[]
  maskTargetImageId?: string | null
  maskImageId?: string | null
  outputTaskIds: string[]
  responseId?: string
  responseOutput?: ResponsesOutputItem[]
  status: AgentRoundStatus
  error: string | null
  createdAt: number
  finishedAt: number | null
}

export interface AgentConversation {
  id: string
  title: string
  activeRoundId?: string | null
  createdAt: number
  updatedAt: number
  rounds: AgentRound[]
  messages: AgentMessage[]
}

// ===== IndexedDB 存储的图片 =====

export interface StoredImage {
  id: string
  dataUrl: string
  /** 图片首次存储时间（ms） */
  createdAt?: number
  /** 图片来源：用户上传 / API 生成 / 遮罩 */
  source?: 'upload' | 'generated' | 'mask'
  /** 原图宽度 */
  width?: number
  /** 原图高度 */
  height?: number
}

export interface StoredImageThumbnail {
  id: string
  /** 列表缩略图，用于避免卡片页解码完整 4K 原图 */
  thumbnailDataUrl: string
  /** 原图宽度 */
  width?: number
  /** 原图高度 */
  height?: number
  /** 缩略图生成参数版本 */
  thumbnailVersion?: number
}

// ===== API 响应 =====

export interface ImageResponseItem {
  b64_json?: string
  url?: string
  revised_prompt?: string
  size?: string
  quality?: string
  output_format?: string
  output_compression?: number
  moderation?: string
}

export interface ImageApiResponse {
  data: ImageResponseItem[]
  size?: string
  quality?: string
  output_format?: string
  output_compression?: number
  moderation?: string
  n?: number
}

export interface ResponsesInputContentItem {
  type?: string
  text?: string
  image_url?: string
  file_id?: string
  file_url?: string
  file_data?: string
  filename?: string
  detail?: string
}

export interface ResponsesOutputItem {
  id?: string
  type?: string
  status?: string
  action?: string | Record<string, unknown>
  /** function_call: unique call id for sending back function_call_output */
  call_id?: string
  /** function_call: function name */
  name?: string
  /** function_call: JSON-encoded arguments string */
  arguments?: string
  /** function_call_output: JSON/text string or Responses input content */
  output?: string | ResponsesInputContentItem[]
  annotations?: Array<{
    type?: string
    start_index?: number
    end_index?: number
    url?: string
    title?: string
  }>
  content?: Array<{
    type?: string
    text?: string
    refusal?: string
    annotations?: Array<{
      type?: string
      start_index?: number
      end_index?: number
      url?: string
      title?: string
    }>
  }>
  result?: string | null | {
    b64_json?: string
    base64?: string
    image?: string
    data?: string
  }
  size?: string
  quality?: string
  output_format?: string
  output_compression?: number
  moderation?: string
  revised_prompt?: string
}

export interface ResponsesApiResponse {
  id?: string
  output?: ResponsesOutputItem[]
  tools?: Array<{
    type?: string
    size?: string
    quality?: string
    output_format?: string
    output_compression?: number
    moderation?: string
    n?: number
  }>
}

export interface FalImageFile {
  url?: string
  content_type?: string
  file_name?: string
  width?: number
  height?: number
  b64_json?: string
  base64?: string
  data?: string
}

export interface FalApiResponse {
  images?: FalImageFile[]
  image?: FalImageFile | string
  url?: string
  seed?: number
}

// ===== 导出数据 =====

/** ZIP manifest.json 格式 */
export interface ExportData {
  version: number
  exportedAt: string
  backupPart?: {
    id: string
    index: number
    total: number
  }
  settings?: Omit<AppSettings, 'customProviders'> & { customProviders?: CustomProviderDefinition[] }
  tasks?: TaskRecord[]
  favoriteCollections?: FavoriteCollection[]
  defaultFavoriteCollectionId?: string | null
  agentConversations?: AgentConversation[]
  /** 项目 / 画布结构；仅在导出任务时写入 */
  workspace?: WorkspaceState
  /** imageId → 图片信息 */
  imageFiles?: Record<string, {
    path: string
    createdAt?: number
    source?: 'upload' | 'generated' | 'mask'
    width?: number
    height?: number
    /** 通过链接添加时的原链接 */
    sourceUrl?: string
  }>
  /** imageId → 缩略图信息 */
  thumbnailFiles?: Record<string, {
    path: string
    width?: number
    height?: number
    thumbnailVersion?: number
  }>
  /** 技能库配方（P4）；可选字段，v4 旧备份无此字段时导入行为不变 */
  skills?: PromptSkill[]
  /** 能力技能（B04B）；保持 version 4，旧版忽略此字段 */
  capabilitySkills?: Skill[]
  /** 内置技能的收藏/封面/模型覆盖层；与 capabilitySkills 分开 */
  capabilityOverrides?: Record<string, { favorite?: boolean; coverImageId?: string; model?: string }>
}
