# 架构概览

- 前端：React 19 + Vite + TypeScript，UI 状态用 Zustand。
- 桌面端：Tauri 2（Rust），负责文件保存、HTTP、更新、MCP、深链。
- 数据：任务与图片存 SQLite/IndexedDB；设置与草稿存 localStorage / Tauri store。

## 目录边界

- `src/components/`：旧主页、任务卡、详情、画布组件。
- `src/studio/`：Studio 外壳、侧栏、底部输入台、九宫格、右侧抽屉。
- `src/lib/`：API、下载、存储、工作区、技能、画布数学等纯逻辑。
- `src/store.ts`：全局状态入口；新增纯函数优先放 `src/lib/`。
- `src-tauri/src/`：Rust 命令、数据库、HTTP、保存对话框、更新器。

## 关键数据流

1. 输入台或 Agent 组装 prompt/参考图/参数，交给 `submitTask`。
2. `submitTask` 创建 `TaskRecord`，写入 store 与 SQLite，调用 API。
3. 输出图写入图片库，任务状态回写；画布按 `task.canvas` 布局。
4. 导出走 `exportZip`，manifest version 4；技能与配置作为可选字段。

## 状态归属

- 任务选中：`useStore.selectedTaskIds`。
- 素材选中：`useCanvasSelectionStore`（节点 id / 素材 imageId 分集合）。
- 画布快照：`ProjectCanvas`（prompt/params/refs/mask/chip/viewport）。
- 技能：`useCapabilitySkillStore`（mine + builtinOverrides）；提示词配方在 `useSkillStore`。
- 下载：`downloadImageIds` / `downloadImageEntriesAsZip` 单一链路。

## 变更约束

- 只做一份总方案；阶段推进；不重建同号版本。
- 数据迁移必须向后兼容旧 ZIP/localStorage。
- 新增共享动作放 `src/lib/`，不再吹大 `store.ts`。
- 发布前必须通过 `gate:dev`、`e2e`、`cargo test`；发布需用户明确授权。
