# P0 数据层 · 阶段报告

- 阶段：P0（数据层）
- 分支：studio
- 日期：2026-11-05
- 依据：`盼盼工作台执行方案.md` v1.4、`docs/studio-p1-contracts.md`

---

## 1. 本阶段交付

### 1.1 项目 / 画布模型

- `src/types.ts` 新增 `Project`、`ProjectCanvas`、`WorkspaceState`。
- `TaskRecord` 新增可选 `projectId`、`canvasId`；保留现有 `canvas` 字段，不改名。
- `ExportData` 新增可选 `workspace`。

### 1.2 纯数据函数

新增 `src/lib/workspaceState.ts`：

- 默认项目 `default-project` / 默认画布 `default-canvas`。
- `normalizeWorkspace`：补项目/画布、去重、修正归属、校正 active ID、清洗快照与视口。
- `migrateTasksToWorkspace`：旧任务补归属、跟随画布项目、清除非法 `canvas`。
- `collectWorkspaceDraftImageIds`：收集所有画布草稿引用图片。
- `mergeImportedWorkspace`：导入时默认项目/画布并入当前，非默认 ID 冲突重映射并同步任务。
- `splitNewTasks`：导入任务同 ID 跳过，不覆盖。
- `getProjectCanvases` / `getProjectDefaultCanvas`。

### 1.3 Workspace store

新增 `src/lib/workspaceStore.ts`：

- `useWorkspaceStore`，key `panpan-workspace-v1`。
- Tauri 用 `tauriStorage`，Web 用 localStorage。
- 提供 `setActiveProject`、`setActiveCanvas`、`updateCanvas`、`setCanvasViewport`、`resetWorkspace`。
- persist `merge` 走 `normalizeWorkspace`。

### 1.4 接入现有 store

`src/store.ts`：

- `initStore` 启动时迁移旧任务归属；首次运行把默认 workspace 落盘。
- 图片 GC 根加入 workspace 草稿引用（`isImageReferencedByState` + 启动清理）。
- `submitTask` 新增可选 `projectId` / `canvasId` / `viewport`；未传时使用当前 active 画布，旧布局仍用实时 `useCanvasViewStore` 视口。
- 新任务写入 `projectId` / `canvasId`。
- `clearData(clearTasks)` 同时重置 workspace。
- 导出写入 workspace；导入合并 workspace、重映射项目/画布、跳过同 ID 任务并报告数量。

### 1.5 备份

`src/lib/exportZip.ts`：

- `ExportData.version` 3 → 4。
- `workspace` 只在 `exportTasks=true` 且 base manifest 中写入，分卷后续卷不写。
- 备份体积估算包含 workspace。

---

## 2. 验证

| 项 | 命令 | 结果 |
|---|---|---|
| TypeScript + Vite | `npm run build` | 通过 |
| 单测 | `npm test` | 68 files / 913 tests passed |
| Rust 回归 | `cargo test` | 87 passed / 0 failed |
| 旧数据启动 | `npm run tauri:dev` + 备份副本 | 窗口启动成功 |
| 旧数据迁移 | SQLite 读取 `dev-data` 副本 | 13 tasks，missingProject=0，missingCanvas=0 |
| workspace 落盘 | SQLite `kv.panpan-workspace-v1` | 默认项目/画布，active ID 正确 |

旧数据验证使用备份副本 `backups/official-data-pre-studio` 复制到 `src-tauri/dev-data`，验证后已恢复原 `dev-data`；真实数据目录未修改。

---

## 3. 新增测试

- `src/lib/workspaceState.test.ts`：默认值、清洗、迁移、导入合并/重映射、GC、导入跳过。
- `src/lib/exportZip.test.ts`：version 4、workspace 只进 base manifest。
- `src/store.test.ts`：新任务按显式画布归属、默认画布回退。
- `src/lib/promptImageMentions.test.ts`：普通 `@图N`、全角、隐藏标记优先、评论正文不误转。
- `src/lib/canvasMath.test.ts`：3000 节点基线。

---

## 4. 本阶段没做

- 项目/画布 CRUD 与左侧树：P2。
- 画布切换时保存/恢复 live composer：P2/P3。
- CanvasBoard 受控视口与缩略图恢复：P1/P4。
- `stopTask`：P2。
- 设置壳与 Agent 下线：P5。

---

## 5. 风险与注意

1. **旧布局仍按实时视口摆放任务**：`submitTask` 未传 `canvasId/viewport` 时沿用旧行为，避免 P0 破坏现有画布；Studio 路径在 P1 显式传上下文。
2. **导入同 ID 任务跳过**：重复导入同一备份时任务不会重复，项目/画布仍按契约重映射，可能出现同名项目副本。
3. **首次 workspace 落盘**：靠 `initStore` 检查存储 key；Web/Tauri 都已覆盖，测试环境无 `window` 时跳过。
4. **3000 基线只测计算**：DOM/缩略图性能留到 P4 真实比例压测。

---

## 6. Gate 0 自检

- [x] Workspace schema / 默认项目/画布。
- [x] 旧任务迁移，真实旧数据可启动。
- [x] GC 根包含 workspace 草稿。
- [x] `submitTask` 画布上下文。
- [x] 备份 version 4、workspace 进 base 卷。
- [x] 导入重映射 / 同 ID 跳过。
- [x] 单测、build、cargo test 通过。
- [ ] 独立审查通过（待 Gate 0）。

---

## 7. Gate 0 复审修订

针对 G0-1～G0-7：

1. **默认项目/画布 invariant**：`normalizeWorkspace` 始终补 `default-project` 和 `default-canvas`；默认画布 ID 被其他项目占用时收回；active ID 无效回退默认。新增对应测试。
2. **retry 归属**：`retryTask` 通过 `resolveTaskOwnership` 继承源任务画布；补测试。
3. **composer 持久化**：workspace `partialize` 按 `persistInputOnRestart` 裁剪；关闭时立即重写存储，剔除 prompt/params/参考图/遮罩快照；补纯函数测试。
4. **导入归属统一**：新增 `resolveTaskOwnership`，启动迁移、导入、重试共用；项目已知/画布缺失走该项目第一个画布，画布与项目冲突以画布项目为准。
5. **导入顺序与默认画布快照**：先算新任务/跳过，再写任务，成功后才写 workspace；纯重复导入不生成空项目；默认画布草稿按“当前非空优先、导入补齐”合并。
6. **批量上下文**：`submitTask` 在批量开始前固定 project/canvas/viewport/size，中途切换画布不拆批。
7. **GC 显式根**：`deleteUnreferencedImageIds` 直接加入 workspace 草稿 ID；测试增加“非当前画布草稿/遮罩图片在删除任务后仍存在”。

第二次 Gate 0 复审追加：

8. **submitTask 默认画布**：未传 `canvasId` 时先取 `activeCanvasId`，只有显式 `projectId` 与 active 项目不同才取该项目第一个画布；补 p1/c1/c2、active=c2 的测试。
9. **重复导入快照**：即使没有新任务/新结构，只要默认画布快照变化也写回 workspace；补 importData 集成测试。
10. **导入回滚**：任务批次写入失败时回滚本次新写入的任务，并报告失败，避免半成功。
11. **workspaceStore 持久化测试**：新增 jsdom 集成测试，验证关闭 composer 后存储不含快照、resetWorkspace 恢复默认、损坏存储可修复。

验证：`npm test` 68 files / 913 tests passed；`npx tsc -b` 通过。再次用备份副本启动：13 tasks、missingProject=0、missingCanvas=0、workspace 正常落盘；验证后已恢复 `dev-data`。
