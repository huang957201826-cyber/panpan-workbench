# P2 项目 / 画布 · 阶段报告

- 阶段：P2（项目 / 画布）
- 分支：studio
- 日期：2026-11-05
- 依据：`盼盼工作台执行方案.md` v1.4、`docs/studio-p1-contracts.md`

---

## 1. 本阶段交付

### 1.1 项目 / 画布 CRUD

- `useWorkspaceStore` 新增：
  - `createProject` / `renameProject` / `removeProject`
  - `createCanvas` / `renameCanvas` / `removeCanvas`
- 新建项目自动创建「画布 1」并切换为 active。
- 新建画布自动按 order 追加并切换。
- 默认项目不可删除；删除项目/画布时 active 自动回退。
- 删除最后一个画布时自动补「画布 1」。

### 1.2 Studio 侧栏

- `AppSidebar` 新增：
  - 双击项目/画布行或铅笔图标改名；
  - 项目行删除、画布行删除；
  - 新建项目、新建画布真实生效；
  - 禁用入口仍保持（工作流/技能库 P5）。
- TitleBar 新建项目/画布也接真实 action。

### 1.3 切换快照

- `workspaceActions.ts` 新增：
  - `saveActiveCanvasSnapshot`：保存 prompt/params/参考图/遮罩/视口到当前画布；
  - `switchCanvas`：先保存当前，再恢复目标画布；
  - `switchProject`：切到项目第一个画布；
  - `restoreActiveCanvasSnapshot`：首次进入/删除后恢复。
- 参考图通过 `ensureImageCached` 从 image store 恢复。
- 切换时清空 `selectedTaskIds` / `selectedFavoriteCollectionIds` / 详情。
- CanvasBoard 视口每 300ms 写回 workspace；切换时恢复。

### 1.4 删除 / 迁移

- 新增 `DeleteWorkspaceDialog`：
  - 画布：移到当前项目默认画布 / 删除画布及其任务；
  - 项目：移到默认项目 / 删除项目及其任务。
- 删除前检测 running 任务：`ConfirmDialog`「停止并继续」/取消。
- 删除画布迁移：
  - 目标为当前项目第一个画布；
  - 源任务按目标包围盒右侧偏移 48px。
- 删除项目迁移：
  - 目标为默认项目/默认画布；
  - 按源画布分组，每组按目标下方 48px 递增偏移。
- `moveTasksToWorkspace` 批量更新 projectId/canvasId/canvas，写库失败返回失败 ID；有失败时保留画布/项目并提示，不静默删除。
- 删除任务统一走 `removeMultipleTasks`，图片按引用清理。

### 1.5 运行中任务

- 新增 `stopTask`：abort controller、移除执行令牌、任务状态 `error`、文案 `已停止生成。`、记录 finishedAt/elapsed。
- OpenAI-compatible 请求已接外部 AbortSignal；fal/custom 等不支持 abort 的路径仍会忽略结果（不写回），删除对话框明确先停止。
- 批量队列存在时先 `stopBatchPrompts`，再停止当前任务。

### 1.6 其他

- `CanvasBoard` 支持传入当前画布 tasks（P1 已加）。
- 关闭 Studio 壳前保存当前画布快照。
- 首屏只在画布已有快照时恢复，避免覆盖 P0/P1 的旧 gallery 草稿。

---

## 2. 验证

| 项 | 方式 | 结果 |
|---|---|---|
| 编译 | `npx tsc -b` | 通过 |
| 构建 | `npm run build` | 通过 |
| 单测 | `npm test` | 69 files / 932 tests passed |
| 手动创建 | Tauri dev | 新建画布/项目成功，active 正确 |
| 手动改名 | Tauri dev | 画布/项目双击或铅笔改名成功 |
| 迁移逻辑 | 单测 | 画布偏移 48px、项目分组下移 48px |
| 停止任务 | 单测 | running → error / `已停止生成。` |
| 快照切换 | 单测 | 提示词保存/恢复、参考图 ID 保存 |

测试使用 `backups/dev-data-before-p2-ui` 副本；验证后已恢复，真实数据未动。

---

## 3. 本阶段没做

- Rust 事务 `tasks_move_canvas`：当前逐条 `putTask` + 失败报告，P2 可接受。
- 项目树拖拽排序、右键菜单：P4/P5 polish。
- 底部输入台、九宫格搜索/批量、画布真实比例/LOD：P3/P4。
- 项目级单独导出：按决策后置。
- Tauri 端删除/迁移的专门自动化 UI 测试：P2 用单测 + 手动冒烟。

---

## 4. 已知边界

1. 删除项目迁移按源画布分组垂直排开，不保留跨画布绝对相对位置；符合“分组偏移”决策。
2. 迁移写库失败时任务在内存中已移动、DB 未移动；画布/项目保留，用户可重试；重启会回到旧位置，不会丢任务。
3. `stopTask` 对 OpenAI-compatible 会中断请求；fal/custom 依赖结果令牌忽略，网络请求可能继续到服务端。
4. 侧栏改名是双击/铅笔入口，未做右键菜单。

---

## 5. Gate 2 自检

- [x] 项目/画布新建、改名、切换。
- [x] 删除画布：默认画布迁移 / 一并删除。
- [x] 删除项目：默认项目迁移 / 确认删除。
- [x] 运行中任务先停止选项。
- [x] 切换清空选择。
- [x] 每画布 prompt/params/参考图/遮罩/视口快照。
- [x] 迁移失败不静默删除。
- [x] 旧备份/workspace ZIP 保持 P0 语义。
- [x] 929 tests / build 通过。
- [ ] 独立审查通过（待 Gate 2）。

---

## 6. Gate 2 复审修订

1. **默认画布保护**：`removeCanvas` 拒绝 `DEFAULT_CANVAS_ID`；`requestDeleteCanvas` toast 拒绝；AppSidebar 对默认画布隐藏删除按钮。补删除默认画布被拒绝的测试。
2. **快速切换串行化**：`switchCanvas` 改为串行队列，`restoreCanvasSnapshot` 在每次 `await` 后校验 active/generation，不是目标就放弃；补 A→B→C 快速切换测试。
3. **迁移失败一致性**：`moveTasksToWorkspace` 改为先写库，成功后再更新内存；失败任务保持源画布/项目，可重试。补“第二个任务写库失败”测试，断言失败任务仍在源画布。
4. **立即 GC**：新增 `cleanupUnreferencedImages()`；删除画布/项目后显式清理，不再等下次启动。补“只被已删画布草稿引用的图片立即删除”测试。

验证：`npm test` 69 files / 932 tests passed；`npx tsc -b`、`npm run build` 通过。旧数据副本启动复核：13 tasks / missingProject=0 / missingCanvas=0 / workspace 正常；验证后已恢复 dev-data。
