# B04B 执行清单（1.0.3 底座与技能批）

- 日期：2026-11-10
- 总方案：`PLAN-B04B.md`
- 状态口径：`[ ]` 未做 / `[~]` 进行中 / `[x]` 已验证 / `[-]` 本批不做

## S1 双视图底座（A/B）

- [x] S1-1 任务选中统一到 `useStore.selectedTaskIds`；删除 `StudioShell` 本地 `selectedTaskIds`、`selectedCanvasTaskId`、`canvasSelectionCommand`。
- [x] S1-2 素材选中统一到 `useCanvasSelectionStore`：`selectedNodeIds` 与 `selectedAssetImageIds` 分集合；删除 `CanvasBoard` 本地第二事实源。
- [x] S1-3 `src/lib/selection.ts` 提供 `clearAllSelection()`，清任务 + 两个素材集合 + 递增 `selectionClearNonce`。
- [x] S1-4 替换切换画布/收藏/视图的 `clearSelection` 为 `clearAllSelection`；允许的 task-only 调用点：InputBar/SearchBar/TaskGrid + `store.ts` 内部任务路径（如 `setTaskFavoriteCollections`）。
- [x] S1-5 `CanvasBoard.imageMenu`、`ImageContextMenu.menuInfo` 订阅 `selectionClearNonce` 关闭。
- [x] S1-6 新建 `src/lib/taskActions.ts`：`downloadImageRefs`、`downloadTaskOutputs(current/original/partial/zip)`、`deleteSelection({taskIds,nodeIds})`、`retryTask`、`setTaskAsReference`、`reuseTaskConfig`、`editTaskOutputs`、`openTaskDetail`。
- [x] S1-7 `DetailModal`、`RightGeneratorDrawer`、`CanvasTaskNode`、`CardGridView`、`ImageContextMenu` 改用同一动作层；不允许第二套下载/删除/复用。
- [x] S1-8 `RightGeneratorDrawer.selectedArtboardId` 映射到任务选中；`ImageContextMenu` 无 task 映射时只做图片级动作，parity 标 N/A。
- [x] S1-9 parity matrix：画布/九宫格/右侧抽屉/DetailModal/ImageContextMenu × 动作，含 N/A 与任务解析规则。
- [x] S1-10 双视图 E2E：下载四种变体、删除任务+素材、重试、设为参考图、复用、编辑、详情、选中、清空。
- [x] S1-11 `grep` 证明没有第二套任务选中/下载/删除/复用；现有行为不回归。
- [x] S1-12 S1 验收：`gate:dev` + 双视图 E2E 绿。

## S2 技能库（B）

- [x] S2-1 新增 `Skill`/`SkillSlot`/`SkillSlotValue` 类型与 `useCapabilitySkillStore`（key `panpan-capability-skills-v1`）。
- [x] S2-2 `PromptSkill` 增加 `kind:'prompt'` 并进 `normalizePromptSkill` 白名单；旧数据不删、不破坏。
- [x] S2-3 live chip：`useStore.activeSkillId` + `skillSlotValues`；`useStore.prompt` 是唯一用户文字；`ProjectCanvas` 只加 `activeSkillId`、`skillSlotValues`。
- [x] S2-4 chip 接入 `normalizeCanvas`/`getPersistedWorkspace`/`mergeCanvasSnapshot`/`hasCanvasSnapshotChanged`/`saveActiveCanvasSnapshot`/`exportData`/`createDeleteSnapshot`/隐私快照。
- [x] S2-5 `TaskRecord.skillContext` 存 `{ id, name, basePrompt, slots, slotValues, userPrompt, version }`；`task.prompt` 保存合并后的最终文本。
- [x] S2-6 `clearInputAfterSubmit` 实现并改测试（提交后清 prompt + chip）；`persistInputOnRestart=false` 不持久化 chip。
- [x] S2-7 retry 用 `task.prompt` 不二次合并；`reuseTaskConfig` 恢复 `skillContext.userPrompt` + chip + images/mask/profile。
- [x] S2-8 技能库两 Tab：技能 / 提示词库；旧 PromptSkill 全部在提示词库。
- [x] S2-9 技能卡：封面纯色占位 + 手动替换；名称/一句话/适用模型/来源。
- [x] S2-10 封面 `coverColor` + `coverImageId`（IndexedDB）；重启/导出保留；`collectSkillCoverImageIds` 收集。
- [x] S2-11 底部栏「选用技能」弹窗：搜索/分类/卡片/应用。
- [x] S2-12 3–6 槽表单（含 image/multi-image，优先 2–3 宽字段）+ 预览最终提示词。
- [x] S2-13 输入框 chip：图标 + 技能名截断 + 用户文字；换/清；提交时合并。
- [x] S2-14 清空/切换画布/重启/隐私/提交后 chip 规则。
- [x] S2-15 合并顺序：技能基座 → 本次输入 → 用户补充；超长阻止提交，不截用户文字。
- [x] S2-16 导出 v4 兼容扩展 `capabilitySkills`（不升 version）；旧 v4 导入、去重、内置不覆盖我的；round-trip 测试。
- [x] S2-17 另存为技能：沉淀为 `Skill`，`source:'mine'`；不覆盖内置；用 `task.skillContext` 或当前 composer。
- [x] S2-18 `public/lovart-skill-kit` 重命名为 `public/skill-kit`，同步构建脚本；先移除或重定向旧 `LovartSkillLibraryView`/`lovartSkills` 的 fetch 路径，确保无 404；源码用户文案无 Lovart。
- [x] S2-19 E2E：picker→slots→chip→submit；换/清；旧 v4 导入；封面重启保留；重启开/关 chip；隐私进入/退出恢复；默认画布仅 chip 变化会写回。
- [x] S2-20 S2 验收：`gate:dev` + `e2e`；旧数据不丢。

## S3 可用性 Round 1（B/C）

- [x] S3-1 C1：缩放后“生成中”虚化不消失；低缩放 LOD 不误删虚化。
- [x] S3-2 C5：新节点不与参考图/上一张重叠；插入位置统计任务 + 素材节点。
- [x] S3-3 U1：左侧项目树隐藏行内按钮，改右键 + 悬停「…」。
- [x] S3-4 U2：画布框选自动多选；九宫格保留显式多选；选中语义一致。
- [x] S3-5 C1/C5 截图对比；U1/U2 双视图 E2E。
- [x] S3-6 S3 验收：`gate:dev` + `e2e`。

## S4 验收/安装（A）

- [x] S4-1 `npm run gate:dev` 通过。
- [x] S4-2 `npm run e2e` 通过。
- [x] S4-3 `cargo test --manifest-path src-tauri/Cargo.toml` 通过。
- [x] S4-4 版本升 1.0.3（package/lock/Cargo/lock/sw/RELEASE）。
- [x] S4-5 签名构建 1.0.3；记录 SHA256 + `.sig`。
- [x] S4-6 备份 data + app；`quick_check` + tasks/images 计数。
- [x] S4-7 静默安装；注册表 1.0.3。
- [x] S4-8 安装版验证：技能 chip、封面、旧数据、双视图动作、C1/C5/U1/U2、数据 pre/post。
- [x] S4-9 更新 `CHECKPOINT.md` / `GATES-B04B.json` / `REPORT-B04B.md`。
- [x] S4-10 失败注入：故意破坏 chip 持久化/选中清空，E2E 必须红；恢复后绿。

## 本批不做

- [-] M1–M4、S1 设置页重构、S2/S3/S5、E7、macOS、公开 Release。
- [-] 27 条技能的 8–10 个商业空间内容精修（B05）。
- [-] 技能市场/社区/作者体系。
