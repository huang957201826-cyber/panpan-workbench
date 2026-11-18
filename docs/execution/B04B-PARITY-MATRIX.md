# B04B 双视图 Parity Matrix

- 日期：2026-11-10
- 范围：Studio 画布、九宫格、右侧抽屉、DetailModal、ImageContextMenu
- 说明：`N/A` 表示该视图不提供此动作，或没有任务映射，只做图片级动作。

| 动作 | 画布任务节点 | 九宫格 | 右侧抽屉 | DetailModal | ImageContextMenu |
|---|---|---|---|---|---|
| 下载 | `downloadImage` | `downloadImage` | `downloadImage` | `downloadTaskOutputs` | `downloadImageRefs` / zip |
| 删除任务 | `deleteTask` / `deleteSelection` | `deleteTasks` | N/A | `deleteTask` | N/A（图片级） |
| 删除画布素材 | `deleteSelection({nodeIds})` | N/A（素材卡只读） | N/A | N/A | N/A |
| 重试 | `retryTaskAction` | `retryTaskAction` | N/A | `retryTaskAction` | N/A |
| 设为参考图 | `addTaskAsReference` | StudioShell `addArtboardImage` | 抽屉内参考图按钮 | 详情内操作 | N/A（图片级） |
| 复用配置 | `reuseTaskConfig` | `reuseTaskConfig` | N/A | `reuseTaskConfig` | N/A |
| 编辑输出 | `editTaskOutputs` | N/A | N/A | `editTaskOutputs` | N/A |
| 收藏 | N/A（走 collection） | StudioShell `updateTaskInStore` | N/A | collection picker | N/A |
| 详情 | `openTaskDetail` | StudioShell `setDetailTaskId` | 抽屉即详情 | 自身 | N/A |
| 选中 | `useStore.selectedTaskIds` | `useStore.selectedTaskIds` | `selectedArtboardId` → 任务选中 | 单任务 | 图片菜单，无任务选中 |
| 清空选中 | `clearAllSelection` | `clearAllSelection` | `clearAllSelection` | 关闭即清 | `selectionClearNonce` |
| 素材选中 | `selectedNodeIds` | N/A（素材卡只读） | N/A | N/A | N/A |

## 边界

- 旧主页 `InputBar`、Agent 对话、历史弹窗仍直接调用 `removeMultipleTasks`；它们不在 Studio 双视图范围，B04B 不改。
- 九宫格素材卡（`artboard.isAsset`）当前只读，不参与任务选中；素材选中在画布内完成。
- `ImageContextMenu` 没有任务映射，删除/重试/复用标 N/A，只保留图片下载与图片级动作。
