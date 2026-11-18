# P1 垂直切片 · 阶段报告

- 阶段：P1（垂直切片）
- 分支：studio
- 日期：2026-11-05
- 依据：`盼盼工作台执行方案.md` v1.4、`docs/studio-p1-contracts.md`

---

## 1. 本阶段交付

### 1.1 Studio 壳子真实入口

- 新增 `src/studio/StudioShell.tsx`，不直接挂 AI Studio 的 demo `App.tsx`。
- `App.tsx` 按 `settings.studioShellEnabled` 切换：默认 Studio，关闭回退旧布局。
- 旧布局的 `Header/TaskGrid/InputBar` 在 Studio 路径不渲染；全局弹层（详情、设置、灯箱、确认框、遮罩、画板、Toast）继续复用。
- `src/studio/studio.css` 的全局尺寸/滚动条/背景限定在 `.studio-root`，不再污染旧布局。
- `studioShellEnabled` 默认 true，在「设置 → 通用」新增开关，可运行时回退。

### 1.2 真实数据接入

- 左侧项目树：`workspace.projects` → 文件夹，`workspace.canvases` → 方案；切换真实 active 项目/画布。
- 九宫格：`useCanvasTasks(canvasId)` 过滤当前画布 + 隐私模式 + 排除旧 Agent 任务；`useArtboards` 读取真实输出图。
- 画布：复用现有 `CanvasBoard`，只传当前画布任务；保持旧 pan/zoom/拖动实现。
- 右侧生成台：
  - 模型列表来自当前 API 配置 `splitModelList`；
  - 尺寸来自 `STUDIO_SIZE_OPTIONS`（auto/1:1/3:2/2:3）；
  - 画质、格式、数量、透明背景写真实 `TaskParams`；
  - 参考图对接 `useStore.inputImages`；
  - 历史流对接当前画布输出图；
  - 设为垫图 → `editOutputs`；复用 → `reuseConfig`；下载真实 data URL；切换画布真实生效。
- 生成按钮 → `submitTask({ projectId, canvasId, viewport })`，任务真实落库并出现在当前画布/九宫格。

### 1.3 状态持久化

- `WorkspaceState` 新增 `viewMode`、`inputDockPosition`，随 workspace 持久化。
- 默认右侧输入台；关闭再打开保持上次位置。
- 画布/九宫格切换持久化。
- 侧栏宽度/折叠为本地 UI 状态；窄屏 `<900` 默认收起，`<1100` 右侧生成台以 overlay 覆盖 Stage。

### 1.4 去掉假入口

- TitleBar 新建方案/工作区在 P1 禁用（P2 开放）。
- Sidebar 新建文件夹/创作方案禁用。
- 工作流/技能库入口禁用（P5 开放）。
- 右侧停靠回底部按钮隐藏（P3 开放）。
- 删除 AI Studio 的假 Steps/CFG、假显存/进度文案；改为真实画质/格式/数量/透明控件与“生成中”提示。

---

## 2. 验证

| 项 | 方式 | 结果 |
|---|---|---|
| 编译 | `npx tsc -b` | 通过 |
| 构建 | `npm run build` | 通过 |
| 单测 | `npm test` | 69 files / 921 tests passed |
| 壳子启动 | `npm run tauri:dev` | 窗口“盼盼工作台”启动，Studio 布局显示 |
| 真实生成 | 本地 mock API（`MOCK_IMAGE_API_MODE=b64`） | 提交“测试生成一只猫”，任务 done，1 张输出图 |
| 任务归属 | SQLite 读取 | `projectId=default-project`、`canvasId=default-canvas` |
| 重启保留 | 关闭再启动 | 任务仍在；`viewMode=canvas`、`inputDockPosition=right` 持久化 |
| 画布/九宫格 | 界面点击 | 双向切换正常，不丢任务 |

截图：`C:\Users\95720\生图软件二开\screenshots\p1-shell.png`（壳子真实运行）。

生成验证使用 `backups/dev-data-before-p1-mock` 的副本，验证后已恢复 `src-tauri/dev-data`，真实数据未动；mock 服务已停止。

---

## 3. 本阶段没做

- 项目/画布 CRUD、删除/迁移弹窗：P2。
- 底部输入台、双 Dock 切换、全部参数、批量/遮罩：P3。
- 九宫格搜索/筛选/多选/批量、卡片工具栏：P4。
- 画布真实比例、四角 resize、LOD/3000 压测、AI Studio 画布节点换肤：P4。
- 设置 6 Tab 壳、Agent 下线、技能/工作流占位页：P5。
- 右侧审核（moderation）控件：P3 补；当前保留在底层参数，不在 P1 参数面板。

---

## 4. 已知视觉/交互边界

1. 画布节点仍是现有 `CanvasTaskNode` 视觉，P4 换 AI Studio 选中环/工具条/点阵。
2. 九宫格顶部仍是 AI Studio 原始 header，没有搜索/筛选/多选；P4 加。
3. 800×600 下右侧生成台为 overlay，底部输入台尚未实现；P3/P5 收口。
4. `ImageDetailModal` 对 1×1 mock 图会显示大白块，真实图片正常；P4 换成项目现有详情弹层时一并处理。
5. 旧布局回退开关在设置通用页，默认开启 Studio。

---

## 5. Gate 1 自检

- [x] Studio 壳子真实挂载，不是 AI Studio demo App。
- [x] 默认右侧真实输入台。
- [x] 真实生成链路（mock 验证）与任务落库。
- [x] 任务按 canvasId 显示在九宫格/画布。
- [x] 画布/九宫格切换。
- [x] 重启保留任务、视图模式、Dock 位置。
- [x] 无新建项目/工作流/技能库假按钮。
- [x] `studio.css` scoped。
- [x] 旧布局可运行时回退。
- [ ] 独立审查通过（待 Gate 1）。

---

## 6. Gate 1 复审修订

1. **参考图上传真实 ID**：右侧“添加参考图”改传 `File`，由 `addImageFromFile` → `createInputImageFromFile` → `storeImage` 生成真实 hash；不再把 `ref-*` 写进 `inputImageIds`。补测试：上传后任务 `inputImageIds` 指向 image store 中存在的图片。
2. **设为垫图只加当前图**：`addArtboardImage(artboard)` 按 `artboard.imageId` 单独 `ensureImageCached` + `addInputImage`，不再调用 `editOutputs(task)` 加入全部输出。
3. **删除确认**：九宫格/详情删除改为 `ConfirmDialog`，明确“删除整条任务及其 N 张输出图”，确认后才 `removeTask`。
4. **详情复用现有弹层**：CardGridView 卡片点击/全屏按钮改为 `setDetailTaskId(taskId)`，使用项目现有 `DetailModal`；AI Studio 原生 `ImageDetailModal` 仅保留给 demo 回退，不再暴露“编辑输出”假动作。
5. **旧 Agent 任务**：`useCanvasTasks` 去掉 `sourceMode !== 'agent'` 过滤，旧 Agent 任务按画布显示。
6. **参考图删除/排序**：删除改用 `removeInputImage`；排序新增 `reorderInputImages(nextIds)` action，完整顺序驱动 `updateInputDraftImages`，保留遮罩主图置顶与 `@图N` 重映射。补 4 条测试（a 下移、c 置顶、mask 主图、mention 重映射）。

验证：`npm test` 69 files / 921 tests passed；`npx tsc -b`、`npm run build` 通过。
