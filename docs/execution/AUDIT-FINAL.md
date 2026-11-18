# 全量筛查：四轮 UI 意见 + 已定决策的落地核对

- 日期：2026-11-07
- 方法：逐条对照 `FEEDBACK-UI-ROUND2/3/4/5`、`DECISIONS-RELEASE-V1`、`DECISIONS-B02-UI-FIX`、`SKILLS-V1-PLAN`，在源码中定位实现；能实机验证的补实机证据
- 结论：**四轮意见 26 条，24 条已落地，2 条未落地**（错误分类提示、技能库进 ZIP）；本轮新修 2 项（点阵特效接入、隐藏旧布局开关）、新发现并修 2 个问题（ResizeObserver 回刷日志、签名密码 BOM）

## 一、第二轮（生成状态 / 比例 / 光效 / @ 编号）

| 编号 | 要求 | 状态 | 证据 |
|---|---|---|---|
| R2-1 | 生成中模糊占位 + 计时 + 完成后 blur-up | ✅ | `CanvasTaskNode.tsx:304`（`blur-md`→`blur-0` 420ms）、`:354` 计时胶囊、共享 tick |
| R2-1 | 失败整图红遮罩 + 大 X + 错误摘要 + 重试 | ✅ | `CanvasTaskNode.tsx:320-348`（`bg-red-600/35`、×、复制错误、重试） |
| R2-2 | 节点按真实比例，`object-contain` 不裁切 | ✅ | `canvasNodes.ts:4-30`（MIN 180 / MAX 640）、`CanvasTaskNode.tsx:263,304` |
| R2-3 | 画布鼠标蓝色聚光 / 点阵跟随 | ✅ 本轮接入 | `InteractiveDotGrid.tsx` + `CanvasBoard.tsx` 渲染；减动效时回落 CSS 点阵 |
| R2-4 | `@图N` 蓝色高亮 + 排序改号 | ✅ | `PromptMentionOverlay`、`promptImageMentions.ts:108` `remapImageMentionsForOrder`、`store.ts:1016` |
| R2-5 | 生成中蓝边、状态色有图标/文字、计时共享 tick | ✅ | 蓝色状态胶囊 + `hasRunningTasks` 单一定时器（`CanvasBoard.tsx:61-66`） |

## 二、第三轮（下载 / 底部悬停 / 默认项删除 / 尺寸）

| 编号 | 要求 | 状态 | 证据 |
|---|---|---|---|
| R3-A | 选中即出现下载，不必进详情；多输出可选第几张 | ✅ | 任务节点 `CanvasTaskNode.tsx:357-391`（↓ + 菜单）、图片节点 `CanvasBoard.tsx:748`、卡片 `CardGridView.tsx:165` |
| R3-B/R4-1 | 节点底部黑色渐变改玻璃 + 蓝色柔光 | ✅ | `CanvasTaskNode.tsx:420`（`bg-[#0b1220]/78` + `border-blue-400/30` + `shadow-blue`） |
| R3-C | 默认项目/画布可删，删后切剩余或空状态 | ✅ | `workspaceState.ts:112`（不再补默认）、store 删除不拦截、空状态入口 |
| R3-D/R4-2 | 尺寸：自动 + 1K16:9 + 1K9:16 + 2K16:9，标签带像素 | ✅ | `studio/adapters.ts:8-10`、回退提示 `store.ts:2248` |

## 三、第四轮（底栏 / 尺寸 / 开关 / 切换位置 / 关于页）

| 编号 | 要求 | 状态 | 证据 |
|---|---|---|---|
| R4-1 | 底栏玻璃蓝光 | ✅ | 同上 `CanvasTaskNode.tsx:420` |
| R4-2 | 自动保留在顶部，只改下面三项 | ✅ | `adapters.ts` 第一项仍为“自动” |
| R4-3 | 删除设置里的“使用 Studio 工作台”开关 | ✅ 本轮 | 移除开关 UI（`GeneralSettingsTab.tsx`）；`App.tsx` 固定走工作台，旧布局代码保留待剥离 |
| R4-4 | 视图切换固定右上；九宫格纯色、画布点阵 | ✅ | 共享工具栏 `StudioShell.tsx:716`（`top-3` 右上）；`CardGridView.tsx:90` 纯色底 |
| R4-5 | 关于页只显示开发者盼盼盼2222，许可降级 | ✅ | `AboutSettingsTab.tsx:37` |

## 四、第五轮（共享工具栏 / 齿轮）

| 编号 | 要求 | 状态 | 证据 |
|---|---|---|---|
| R5-1 | 画布与九宫格同一套工具栏、位置一致 | ✅ | `StudioViewToolbar.tsx` 单点挂载 `StudioShell.tsx:717`，两模式共用 `filteredTasks` |
| R5-2 | 搜索/状态/只看收藏/多选/全选/批量收藏/下载/删除 | ✅ | `StudioViewToolbar.tsx:83-108` |
| R5-3 | 批量下载显示 done/total 并禁用重复点击 | ✅ | `StudioViewToolbar.tsx:105-106` |
| R5-4 | 切换视图不丢搜索条件 | ✅ | query/status/favorite 保存在 StudioShell 状态 |
| R5-5 | 左下角设置改齿轮、hover 蓝色、tooltip | ✅ | `AppSidebar.tsx:179-185` |

## 五、已定决策（DECISIONS-RELEASE-V1 §7 十条优化）

| 编号 | 要求 | 状态 | 证据 |
|---|---|---|---|
| O-1 | 删除后“查看快照/恢复”入口 + Toast | ✅ | `store.ts:5460` 快照 Toast；`StorageInfoSection` 内嵌 `DeleteBackupSection` |
| O-2 | 画布节点区分素材/成品 | ✅ | `CanvasTaskNode.tsx:353`（成品）、`CanvasBoard.tsx`（素材/图N） |
| O-3 | 下载体验：多输出菜单、批量进度、文件名清洗 | ✅ | `downloadImage.ts`、`exportFileName.ts` |
| O-4 | 工具栏加模型筛选 | ✅ | `StudioViewToolbar.tsx`（`models` 参数 + 搜索提示词/模型） |
| O-5 | 生成计时 + blur-up；失败大 X + 重试 | ✅ | 同 R2-1 |
| O-6 | 画布性能：视口渲染、低倍占位、缩略图、光效 rAF | ✅ | `CanvasBoard.tsx` `MAX_RENDER=500`、`lowZoom` 占位 canvas、`imageCache` 缩略图 |
| O-7 | 错误可复制 + 超时/无 Key/余额不足分开提示 | ⚠️ 部分 | 复制错误已做（`CanvasTaskNode.tsx:341`）；**分类提示未做**，仍只有 HTTP 状态分组（`imageApiShared.ts:162`） |
| O-8 | 设置页数据安全汇总（目录/备份/最近删除/磁盘） | ✅ | `StorageInfoSection` + `DeleteBackupSection` + `diskSpace.ts` |
| O-9 | 首次关闭到托盘提示 + 首次画布提示 | ✅ | `tauriStorage.ts:158`（`panpan-tray-hint-shown`）、`StudioShell.tsx:745`（`panpan-canvas-use-hint`） |
| O-10 | README 已知限制 | ✅ | `README.md:130` |

## 六、技能库 V1（第二批）

| 项 | 状态 | 证据 |
|---|---|---|
| 数据/持久化（Tauri kv `panpan-prompt-skills-v1`） | ✅ | `skillStore.ts:56` |
| 搜索/分类/标签/置顶/CRUD | ✅ | `SkillLibraryView.tsx`、`promptSkills.ts` |
| 输入台与任务节点“保存为技能” | ✅ | `BottomPromptBar.tsx:752`、`RightGeneratorDrawer.tsx:931` |
| 使用技能替换提示词与参数（需确认、不自动提交） | ✅ | `SkillEditorModal.tsx`、store 应用逻辑 |
| 进 ZIP 备份 | ❌ 未做 | 导出/导入不含技能，属 V1 已知边界 |

## 七、本轮发现并处理的问题

1. **点阵特效写了没接**：`InteractiveDotGrid` 只 import 未渲染（上一轮中断点）。本轮接入 `CanvasBoard`，并按仓库规范重写（无分号、函数组件、中文注释）。
2. **点阵组件引发 ResizeObserver 回刷**：原实现在 observer 回调里写 canvas 的 style 宽高，触发“loop completed with undelivered notifications”，一次启动刷 17 条 ERROR。改为只改位图尺寸 + 静止即停 rAF；全局日志同时过滤这条浏览器噪音。
3. **签名密码文件带 UTF-8 BOM**：`%TEMP%\panpan-updater.password` 首字节是 BOM，直接 `$(cat)` 会得到错误密码，`tauri build` 报 `incorrect updater private key password`。构建时需去 BOM；私钥三件套已备份到 `E:\02-RUANJIAN\67-生图工作台-backups\updater-key\`。
4. **更新地址仍指向不存在的仓库**：`tauri.conf.json` 的 endpoint 是 `github.com/panpan-workbench/panpan-workbench`，仓库按你的要求暂不创建，因此应用内“检查更新”目前必然失败（日志 `update endpoint did not respond`），属预期，等建仓库后一起改。

## 八、实机验证记录（2026-11-07 22:30–23:05）

### 覆盖安装

- 升级前：已安装 1.0.0（21:35 构建），运行中，数据目录指向 `E:\02-RUANJIAN\67-生图工作台-u2\panpan-b02-1b-migration-data`
- 备份：整目录复制到 `E:\02-RUANJIAN\67-生图工作台-backups\b03-pre-install-20261107\data`（152 MB，tasks 15 / images 20）
- 关闭 → 静默安装（`/S`，currentUser，退出码 0）→ 新 exe `2026-11-07 22:52:38`，SHA256 `695CFEE6…D06039`
- 候选包：`PanPan Workbench_1.0.0_x64-setup.exe`，30,211,348 B，SHA256 `B770BC5A…BFD9C68`，`.sig` 448 B，`latest.json` 同步
- `release-check --gates GATES-FINAL.json` 通过

### 数据

- 升级后启动同一数据目录：`tasks 15 / images 20`，与升级前一致；`kv` 键保留（`panpan-workspace-v1`、`panpan-prompt-skills-v1`）
- 未触发任何迁移或重建；`PRAGMA quick_check` = ok

### 运行时日志

- 新版本启动后 **0 条** `ResizeObserver` 报错（修复前一次启动 17 条）
- 仅有更新检查失败：`update endpoint did not respond`（仓库按计划未创建，属预期）
- 未出现 ErrorBoundary 白屏、未出现崩溃

### 界面

- 无头浏览器（Edge + playwright-core）跑同一份源码：画布点阵在光标处实心化并有蓝色光晕；共享工具栏在右上；多选展开“已选 0 / 全选 / 清除 / 收藏 / 下载 / 删除”；设置页无“使用 Studio 工作台”；技能库空状态正常；控制台 0 错误
- 桌面端实机：点阵、成品节点、右上工具栏、右下 `144% / − / + / 全览`、底部输入台、首次画布提示均正常
- 截图：`artifacts/04-dotgrid-hover.png`、`05-multiselect.png`、`06-settings.png`、`07-skills.png`、`12-app-top.png`、`13-canvas-crop.png`

### 环境备注

- 通过工具会话直接启动的应用进程会在命令结束时被回收（作业对象清理），与产品无关；改用 `explorer.exe` 启动后长时间驻留正常

