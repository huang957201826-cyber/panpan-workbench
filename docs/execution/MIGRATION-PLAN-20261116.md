# 三模块迁移执行方案（AI Studio → 本地客户端）

- 日期：2026-11-16
- 目标：把 AI Studio（`aether-studio-canvas---ai-studio-edition (3)`）的工作流、技能库、设置栏搬进本地客户端，**后端一行不动**。
- 交付要求：**只交付最终安装版**，中间不汇报；每阶段自检 + 独立审查，仅阻塞时停。

## 已确认的决定

1. 归档目录 = 应用项目，不新造一套。
2. 不引入 `motion`，动效用 CSS 过渡。
3. 设置只换版式，保留 DPAPI/导入导出/MCP/更新/备份；特惠 API 网址与优惠内容按实写。
4. 画布节点按每条工作流的真实节点渲染，没有的分组不显示（不是空框）。

## 现状

- `src/studio/modules/workflow/` 已入库并编译通过：`WorkflowGalleryView.tsx`、`ComfyWorkflowView.tsx`、`InteractiveDotGrid.tsx`、`mockWorkflows.ts`、`types.ts`（提交 `dd11859`）。
- 尚未挂载；现有 `WorkflowView.tsx`（三节点画布 + 真实运行）仍在用，功能正常。
- 阻塞点：`mockWorkflows.ts` 的示例图指向 `src/assets/images/...`，仓库没有这些文件。

## 阶段

### P1 工作流大厅（Stage 1）

1. 复制原型 3 张示例图到 `public/workflow-demo/`，改 `mockWorkflows.ts` 的资产路径。
2. 新增 `src/studio/modules/workflow/adapter.ts`：
   - 把 `manifest.ts` 的 4 条工作流映射为 `WorkflowPreset`；
   - 分类映射：`su-render→model-to-render`、`retouch→inpaint`、`upscale→upscale`、`matte→cutout`；
   - 节点与连线复用同分类的 `MOCK_WORKFLOW_PRESETS`；
   - `WorkflowProject` 由 `projectWorkflows.ts` 的条目映射。
3. `WorkflowView.tsx` 增加 `stage: 'gallery' | 'canvas'`：
   - `gallery` 渲染 `WorkflowGalleryView`，`onSelectPreset` 切到 canvas；
   - `canvas` 先继续用现有三节点画布（保证可运行）。
4. 自检：build + 单测 + E2E，审查窗口，提交。

### P2 工作流画布（Stage 2）

1. 用 `ComfyWorkflowView` 替换三节点画布，`activePreset` 来自适配层。
2. 把 `handleRunBatteryWorkflow` 的 `setTimeout` 假跑换成 `comfyClient`：
   - 上传原图/蒙版 → `applyParamValues` → `enqueuePrompt` → `waitForPrompt` → `fetchOutputImage`；
   - 进度写进顶部工具栏与出图节点；
   - 结果写入 `projectWorkflows` 的 `results`（复用 `createInputImageFromFile`）。
3. 底栏历史胶囊读 `projectWorkflows`。
4. 自检 + 审查 + 提交。

### P3 技能库

1. 复制 `SkillHubView.tsx` 入库，改导入路径与 `import type`。
2. 数据：现有 27 条技能 + `mockSkills` 映射为 `SkillItem`；`{变量}` 解析沿用现有参数槽。
3. `onApplySkill(mode)` 接到现有输入台（append 用逗号拼接）。
4. 左侧分类计数与收藏实时联动（`AppSidebar` TAB CONTENT C）。
5. 自检 + 审查 + 提交。

### P4 设置栏版式

1. 复制 `SettingsModal.tsx` 的**版式与黑白控件**，不整块替换。
2. 保留现有能力：DPAPI、配置导入导出、MCP、更新、数据目录、备份恢复。
3. API 页按 1-2-3 步：名称与地址 → 密钥与测试（真实 `${baseUrl}/models`）→ 点选画图模型。
4. 推荐节点默认折叠，标「含返利」，网址与优惠按实写，永不写入个人配置。
5. 底部未保存拦截（放弃并关闭 / 保存并关闭）。
6. 自检 + 审查 + 提交。

### P5 侧栏

- `AppSidebar` TAB CONTENT B/C：工作流分类抽屉、技能分类抽屉，其余 tab 不动。

### P6 收口

1. `npm run gate:dev` + `npm run e2e` 全过。
2. `npm run tauri:build -- --config`（本地关闭 updater 产物），覆盖安装，启动验证。
3. 更新 `STATE.md` / `CHECKPOINT.md` / 新增 `STATUS-*.md`。
4. 本地提交，不 push、不发布。

## 冻结文件（禁止修改）

`src/store.ts`、`src/lib/db*.ts`、`src/lib/persistedState.ts`、`src-tauri/**`、`src/lib/comfyClient.ts`、`src/lib/comfyEngine.ts`、`src/lib/comfyPrompt.ts`、`src/studio/workflows/anchors.ts`、`e2e/**`、版本文件。

## 验收（最终版）

1. 工作流大厅是两列原图/成图对比卡，左侧分类 + 归档抽屉可用。
2. 点卡片进画布，分组按真实节点渲染，运行走真实 ComfyUI，出图进结果与历史。
3. 技能库纯文、无图、`{变量}` 高亮，复制/追加/替换可用。
4. 设置五栏版式，API 三步真实拉取模型，底部未保存拦截。
5. 1.2.1 已有功能无回归；`gate:dev` 与 62 条 E2E 全过。

---

## 方案预审修订（2026-11-16，PLAN_REVIEW=REJECT → 已改）

### 修订 1：P1 的节点与连线必须来自真实 API 图

原方案写“复用同分类的 mock 预设节点”，这会导致画出来的图与真跑的不是一套（放大/抠图没有采样器）。
**改为**：`adapter.ts` 从 `API_WORKFLOW_BY_ID` 生成 `WorkflowNode` / `NodeConnection`，mock 预设只用于视觉参考，不参与数据。

### 修订 2：P2 必须定义参数映射

- 画布节点属性 → `ProjectWorkflow.values` → `applyParamValues`；
- 锚点仍按 **classType** 定位（`anchors.ts` 已定），原型自定义 id 只用于界面；
- 原图/蒙版在 UI 里是 dataURL，提交前必须转 `File` 走 `uploadImage`，拿到引擎文件名再写入 `__IMAGE__` / `__MASK__`；
- 蒙版统一转成黑底白区的 PNG。
- 未定义清楚前不得进入 P2。

### 修订 3：E2E 与共享文件归属

- 本批次 **解冻 `e2e/**`**：允许更新“设置关闭即保存”的断言（P4 改成未保存拦截后必须改），允许新增大厅/画布/技能库 spec；
- 验收改为：原有 62 条**除被改断言外**全过 + 新增 spec 全过；
- 共享文件归属：`manifest.ts`、`apiWorkflows.ts`、`projectWorkflows.ts`、`adapter.ts` 归执行窗口所有，其他窗口只读。

### 非阻塞采纳

- 大厅的“新建/复制/改名/删除”在 P2 前只读，避免造出不可运行的 custom preset；
- 分类侧栏提前到 P1（否则大厅筛选点不动）；
- P4 拆三次提交：版式骨架 → API 三步与推荐隔离 → 未保存拦截。