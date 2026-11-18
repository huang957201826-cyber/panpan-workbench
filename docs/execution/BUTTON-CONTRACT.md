# BUTTON-CONTRACT — 按钮/入口契约（R7 / N38）

- 日期：2026-11-12
- 范围：R1–R6 新增与受影响入口；`src/**/*.tsx` 全量字面量 `<button>` 静态扫描；关键路径 E2E。
- 数字来源：`node scripts/audit-buttons.mjs` → `docs/execution/BUTTON-AUDIT.json`，以下统计以该脚本输出为准。
- 发布锁：`locked`。本文件只记录契约，不代表安装版验收。

## 1. 全量扫描口径

用 TypeScript AST 解析 `src/**/*.tsx`，逐个检查字面量 `<button>` 是否带有以下任一属性：

- `onClick`
- `onMouseDown`
- `onPointerDown`
- `type="submit"`
- JSX spread（`{...props}`，处理器可能来自调用方）

当前结果：

- 字面量 `<button>`：384 个
- 已绑定：383 个（`onClick` / `onMouseDown` / `onPointerDown` / `type="submit"` / JSX spread 任一）
- 未绑定：1 个
  - `src/studio/components/UpdateEntry.tsx:160`：下载更新包期间的“下载中…”按钮，`disabled` 由 `state.phase === 'downloading'` 驱动，属于状态按钮，不是死按钮。
- `src/components/canvas/CanvasWorkbench.tsx` 的“选择 / 评论 / 涂抹”三个无处理器按钮已在 R7 删除，保留“图像生成”按钮；旧界面仍未重构。

说明：

- 设计系统封装按钮 `<Button>`、`<TooltipButton>`、菜单项等不在字面量 `<button>` 统计内，已按调用点抽查 `onClick` 与禁用条件。
- `type="button"` 但依赖父级事件的按钮不在此口径内；关键路径用下表 E2E 覆盖。
- 禁用态不算死按钮：撤销无历史、批量无选择、发送无提示词且无技能、更新下载中，均有明确原因。

## 2. 关键按钮/入口契约

| 区域 | 按钮/入口 | 期望结果 | 验证方式 |
|---|---|---|---|
| 首页 | 立即生成 | 有提示词或有技能时创建任务并切到画布；两者都没有时禁用 | `e2e/home.e2e.ts`：首页直接生成、空提示词技能生成 |
| 首页 | 模型 / 尺寸 / 数量 / 格式 / 质量胶囊 | 写回同一 `GenerationParams` 并持久化；质量不再藏在“更多” | `e2e/home.e2e.ts` 首页参数；`e2e/params-dropdowns.e2e.ts` |
| 首页 | 技能入口 / 应用技能 / 应用并生成 | 打开现有选择器；应用后显示 chip；空提示词有技能也可生成 | `e2e/home.e2e.ts`；`e2e/skills.e2e.ts` |
| 侧栏 | 收起方案 / 展开方案 | 折叠后画布、卡片、首页都能展开方案；撤销按钮仍可点 | `e2e/workflow.e2e.ts` R1/N39 两个用例 |
| 侧栏 | 项目条目 | 点击项目恢复该项目上次画布，首次进入回落第一个画布 | `e2e/canvas-multi.e2e.ts` R2/N32 |
| 侧栏 | 新建项目 / 项目右键重命名 / 删除 | 新建入口在侧栏底部；右键菜单可重命名/删除；Escape 不提交 | `e2e/workflow.e2e.ts` U1、R2/N32 |
| 侧栏 | 设置 | 打开设置弹窗；保存提交、取消不提交 | 人工走查（设置字段由单测/构建覆盖）；无专用 E2E |
| 画布胶囊 | 切换画布 | 切换当前画布，任务/撤销栈按画布隔离 | `e2e/canvas-multi.e2e.ts` N50、R1 切换画布清空撤销栈 |
| 画布胶囊 | 新建画布 | 新画布直接进入命名态 | `e2e/canvas-multi.e2e.ts` N50 |
| 画布胶囊 | 双击改名 / Escape 取消 | 提交新名称；Escape 取消且不触发 blur 提交 | `e2e/canvas-multi.e2e.ts` N50 两个用例 |
| 画布胶囊 | 右键复制 / 删除 | 复制生成副本；删除当前画布切相邻；最后一个画布不可删 | `e2e/canvas-multi.e2e.ts` N50 |
| 画布胶囊 | 溢出横向滚动 | 超过 6 个画布全部渲染并可横向滚动，1440/1024 不溢出 | `e2e/canvas-multi.e2e.ts` N50 两个用例 |
| 画布 | 撤销 | 无历史时禁用；恢复移动、缩放、删除、整组拖动 | `e2e/canvas-multi.e2e.ts` R1/B06b；`e2e/workflow.e2e.ts` 收起侧栏后撤销 |
| 输入框 | 发送 | 有提示词或有技能可发送；缺参考图/生成中阻止 | `e2e/home.e2e.ts`；生成链路 `e2e/download.e2e.ts`、`e2e/task-export.e2e.ts` |
| 输入框 | 质量胶囊 | 独立选择并写回，刷新后保留 | `e2e/params-dropdowns.e2e.ts` 质量下拉 |
| 输入框 | 尺寸胶囊 | 选择尺寸并写回，支持 2K/4K 能力表 | `e2e/params-dropdowns.e2e.ts` 尺寸/2K/4K |
| 输入框 | 数量胶囊 | 选择 1/2/4 张并写回 | `e2e/params-dropdowns.e2e.ts` 数量下拉 |
| 输入框 | 更多格式 | WebP/JPEG/GIF/SVG 写回；“更多”不再含复制配置/图片链接/两侧停靠/遮罩；GIF 提示 2048px | `e2e/params-dropdowns.e2e.ts` N35；`e2e/download.e2e.ts`、`e2e/task-export.e2e.ts` |
| 输入框 | 遮罩编辑器 | 独立图标打开遮罩编辑器 | 人工走查；遮罩编辑由既有单测/组件覆盖 |
| 输入框 | 右侧停靠 | 独立图标切换右侧工作台；右侧抽屉不再有“链接”图片入口 | `e2e/workflow.e2e.ts` R2/N40；`e2e/task-export.e2e.ts` 右侧抽屉 |
| 输入框 | 技能入口 / chip 清除 | 打开选择器；应用后显示 chip；清除后保留输入文字 | `e2e/skills.e2e.ts` |
| 卡片视图 | 卡片下载 | 按任务 `localExportFormat` 下载 GIF/SVG；无本地格式保持原图 | `e2e/download.e2e.ts`、`e2e/task-export.e2e.ts`、`e2e/image-detail.e2e.ts` |
| 卡片视图 | 卡片详情 | Studio 内打开任务详情；无外部详情的卡片打开 `ImageDetailModal` | `e2e/task-export.e2e.ts` 详情；`e2e/image-detail.e2e.ts` |
| 卡片视图 | 多选 / 批量下载 | 选中任务后可批量下载；GIF 任务在 ZIP 内仍为 `.gif` | `e2e/task-export.e2e.ts` 批量 ZIP |
| 卡片视图 | 分辨率胶囊 | 默认隐藏，hover 卡片时显示 | `e2e/download.e2e.ts` 卡片右上角下载 |
| 设置 | 保存 | 保存当前设置并关闭/生效 | 人工走查（无专用 E2E） |
| 设置 | 取消 / 关闭 | 不写入草稿设置，关闭弹窗 | 人工走查（无专用 E2E） |

## 3. R1–R6 假按钮复核

逐项检查 R1–R6 新增按钮的处理器、禁用条件和可见结果：

- 首页生成：`onGenerate` 进入 `handleGenerate`，有技能时可空提示词提交；不是只改本地状态。
- 首页参数：模型/尺寸/数量/格式/质量均写回 `GenerationParams` 并持久化。
- 输入栏“更多”：透明背景、审核、批量、格式均写回参数或切换批量；删除项已从菜单移除。
- 遮罩/右侧停靠：独立图标调用 `onOpenMask` / `onDockRight`，不是空处理器。
- 技能选择器：“应用技能 / 应用并生成”只在选中技能后渲染，不存在未选技能时点击无效的假按钮；选中后调用 `onApply` / `onApplyAndGenerate`。
- 卡片视图：下载、详情、设为参考图、复用提示词、多选均有实际动作。
- 撤销：无历史时禁用，有历史时恢复画布内容。
- 设置：保存/取消为人工走查项，未发现空处理器。

未发现其他“有 handler 但实际 no-op / 永远 disabled / 只改无关状态”的新增按钮。
