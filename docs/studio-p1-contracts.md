# Studio 壳子 · P-1 契约

- 日期：2026-11-04
- 状态：P-1 Gate 复审（已按 FAIL 项收口）
- 依据：`盼盼工作台执行方案.md` v1.4

---

## 1. 冻结例外清单

壳子大布局/视觉冻结，只允许以下 6 类局部例外：

1. 九宫格复用现有 header 行，放搜索/筛选/多选/批量；不新增第二行；三列/16:9 不变。
2. 右侧“详细参数”Tab 承担全部参数；底部只做快捷。
3. 设置保留 6 个 Tab（通用/外观/技能/API/数据/关于），套 AI Studio 外框。
4. CanvasBoard 只换选中环、工具条、点阵、缩放胶囊的 DOM/CSS；布局/裁剪/拖动/缩略图/写库仍由 `CanvasBoard + canvasMath` 这一套实现，允许在其中扩展动态 rect、行高和 resize，不引入第二套 `InfiniteCanvas` 布局。
5. 响应式：<1100 右侧默认关、输入切底部；<900 左侧抽屉收起、九宫格 2 列；<700 1 列；<900 右栏/左抽屉以 overlay 覆盖 Stage，不挤压。
6. 底部“更多”删除审核字样；审核只在右侧详细参数。

## 2. CanvasBoard 分层契约

唯一实现：画布布局/裁剪/交互都留在 `CanvasBoard + canvasMath`，不引入第二套 `InfiniteCanvas` 布局。

保留：
- pan/zoom/fit
- 视口裁剪 + LOD + MAX_RENDER
- 异步缩略图、pointer capture、拖动松手写库

允许扩展（仍在同一套实现内）：
- `nodeRects`/`autoLayoutPositions`/`fitNodesViewport` 支持动态高度与行高
- 四角手柄的等比 resize 与 `canvas.w/h` 持久化

替换：
- 选中环、四角手柄外观、浮动工具条、点阵、缩放胶囊的 DOM/CSS

受控接口：
```ts
interface CanvasBoardProps {
  canvasId: string
  tasks: TaskRecord[] // 已按画布+隐私过滤
  viewport: ViewportTransform
  onViewportChange: (v: ViewportTransform) => void
}
```
- 内部 pan/zoom 只调用 `onViewportChange`。
- `useCanvasViewStore` 只保留 `size`、`bottomInset`。
- `StudioBottomBar` 必须设置 `[data-input-bar]` 与 `--input-bar-clearance`。

## 3. composer 契约

- `useStore.prompt / params / inputImages / maskDraft` 是唯一 live composer。
- `submitTask` 未传 `canvasId` 时优先当前 `activeCanvasId`；只有显式 `projectId` 与 active 项目不同，才取该项目第一个画布。
- `ProjectCanvas` 快照字段：
  `promptDraft`、`paramsDraft`、`referenceImageIds`、`maskDraft`、`maskEditorImageId`、`viewport`。
- `WorkspaceState` 额外持久化 `viewMode`（grid/canvas）与 `inputDockPosition`（right/bottom）；Dock 位置不受 `persistInputOnRestart` 影响。
- Studio 路径按 feature flag 停用 `galleryInputDraft`；旧布局回滚继续用它。
- 首次迁移把旧 `galleryInputDraft` 写入默认画布。
- `paramsDraft` 为空 = 继承当前全局 params。
- `persistInputOnRestart=false`：workspace persist 的 `partialize` 排除 composer 快照，只保留 dock/viewMode。
- GC 根加 `maskDraft.targetImageId`、`maskImageId`。

## 4. viewport 契约

- `CanvasBoard` 受控，见第 2 节。
- `StudioCanvas` 按 `activeCanvasId` 读写 workspace 视口。
- 旧 `panpan-view-mode` / `panpan-canvas-viewport` 启动时迁移到 workspace，然后删除。
- 视口写入 300ms 防抖；关闭前 flush。

## 5. 画布真实比例 / resize

- 初始宽 360；`h = clamp(360 * imageH / imageW, 180, 640)`。
- 自动布局按行，行高取该行最大高度；手动节点保持 x/y。
- 缩略图未加载：用 `params.size` 估算，`auto` 按 4:3。
- 裁剪、fit、框选使用同一动态 rect。
- 全局缩放 0.02–3.0。
- 四角手柄：等比角点 resize，写 `canvas.w/h`；resize 后覆盖初始宽度；不做旋转。

## 6. @图1 解析

- 保留 textarea，不换 contentEditable。
- 提交时：普通 `@图N` → `[image N]`，仅当参考图存在。
- 最长数字匹配（`@图10` 不拆成 `@图1`+0）；兼容全角数字。
- 旧隐藏标记优先；普通文本只转换未被标记覆盖的部分。
- 排序/删除参考图后，隐藏标记与普通 `@图N` 同时重映射。
- 测试：边界、全角、1/10、隐藏标记优先、排序/删除重映射。

## 7. stopTask

- 新增普通任务 `AbortController` 注册表 + `stopTask(taskId)`。
- `executeTask` 把 signal 传给 `callImageApi`。
- 删除/迁移 running 任务：弹窗“停止并继续”/“取消”。
- 批量队列中的任务：停止时同时标记该任务，不自动停止后续任务；由用户选择是否停止整批。
- `stopTask` 后任务状态：`error`，文案使用现有精确字符串 `'已停止生成。'`（`TaskCard.tsx` 依赖它显示“已停止”），记录 `finishedAt/elapsed`。
- 不支持 abort 的 provider：文案“请求可能继续到服务端完成，但结果不再写入”。
- 完成后从注册表清理。

## 8. 响应式

- `>=1100`：44 + 230 + Stage + 360（右栏可开）。
- `900–1100`：右侧默认关；手动打开 overlay。
- `<900`：左侧抽屉 overlay，只留 44 rail；九宫格 2 列。
- `<700`：九宫格 1 列。
- 800×600 默认：44 rail + 底部输入 + 2 列网格；右栏 overlay。

## 9. 设置 Tab 映射

现有 7 Tab 删除 Agent 后为 6：

| 现有 | 新壳 |
|---|---|
| 通用 | 通用 |
| 外观 | 外观 |
| 技能 | 技能（标“未开放”） |
| API | API |
| 数据 | 数据 |
| 关于 | 关于 |
| Agent | 删除 |

- General 里的 Agent 段删除。
- 不强制合并成 AI Studio 的 4 Tab。
- 设置项逐项清单在 P5 产出。

## 10. 备份 / ID 冲突

- `ExportData.version` 3 → 4。
- `projects`/`canvases` 只在 `exportTasks=true` 时写入第一卷。
- config-only 导入不碰 workspace。
- 导入顺序：remap 项目/画布 ID → normalize 任务 → 先写新任务（同 ID 跳过）→ 成功后再写 workspace；纯重复导入不生成空项目/空画布。
- 重复导入时即使没有新任务/新结构，只要默认画布快照有变化（prompt/params/参考图/遮罩/视口），也要写回。
- 任务批次写入失败时回滚本次新写入的任务，避免任务归属指向未写入的 workspace。
- 默认项目 `default-project` / 默认画布 `default-canvas` 是不可删除的固定节点；normalize 必须始终补回，active ID 无效时回退到默认。
- 导入默认画布的草稿：当前非空字段优先，导入值补齐空字段（prompt/params/参考图/遮罩/视口）。
- task ID 冲突：同 ID 已存在 → 跳过并报告；同 ID 同内容 → 跳过；不覆盖、不重映射 task ID。
- 项目/画布 ID 冲突 → 重映射并同步任务。
- 旧备份 → 默认项目/画布。
- 任务归属统一走 `resolveTaskOwnership`：画布所属项目优先，其次项目第一个画布，最后默认项目/画布。

## 11. P1 第一步：Tailwind 4 → 3 的样式桥接

`src/studio/index.css` 原本是 Tailwind 4 语法（`@import "tailwindcss"`、`@theme`、`@custom-variant`），当前应用是 Tailwind 3。P-1 已把它转成 `src/studio/studio.css`（CSS 变量 + 原生 CSS），并删除 `index.css`；`main.tsx` 已改为 import `studio.css`。

P1 仍需完成：

1. `@theme` 的 token 映射到 `tailwind.config` 的 `theme.extend`（颜色、圆角、间距、字体），让 `bg-surface` 等类真正生成。
2. `darkMode: 'class'` 与 `html.dark` 对齐。
3. 所有 Studio 样式限定在 `.studio-root` 下，避免污染旧布局。
4. P1 Gate 验收：真实 import 后 `npm run build` 通过，且产物 CSS 包含 Studio 颜色/圆角类。

## 12. P-1 验证证据

| 项 | 命令 | 结果 |
|---|---|---|
| TypeScript + Vite | `npm run build` | 通过 |
| 单测 | `npm test` | 67 files / 901 tests（P0 后） |
| 画布基线 | `npx vitest run src/lib/canvasMath.test.ts` | 3000 节点 layout+fit+cull 1.6ms，k=0.05，visible=3000 |
| Rust | `cargo test` | 87 passed / 0 failed（`src-tauri`，第二次干净运行 EXIT=0） |
| Tauri | `npm run tauri:dev` | 启动成功，窗口标题“盼盼工作台”，Vite 5173 + `target\\debug\\gpt-image-playground.exe`；验证后已关闭 |

- 3000 基线的结论：当前布局/裁剪计算本身很快（毫秒级），瓶颈在 DOM 挂载与缩略图；P1 保留 `MAX_RENDER`，P4 再放宽缩放下限到 0.02 并做真实比例压测。
- 这组数据只代表旧 `CanvasBoard`（固定 360×280），不代表 P4 的真实比例布局；P4 必须重新压测。

---

## P-1 可编译 spike 记录

- 已复制 AI Studio `src` 到 `src/studio`（20 个文件）。
- 所有 `../types.ts` 导入改 `import type`，适配 `verbatimModuleSyntax`。
- 新增 `lucide-react`。
- `npm run build` 通过（未接入 App，仅编译验证）。
- `npm test` 通过；新增普通 `@图N` 解析/重映射测试与 3000 画布基线测试。
- 未改任何产品界面/数据。
