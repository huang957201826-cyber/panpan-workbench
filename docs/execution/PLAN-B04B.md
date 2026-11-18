# PLAN-B04B — 1.0.3 底座与技能批

- 版本：v1.0.3（候选）
- 日期：2026-11-10
- 目标：在 B04A（1.0.2 纠偏）安装稳定后，统一双视图动作/选中态，重做技能库交互，并补 Round 1 可用性。
- 依据：`OPINIONS-SUMMARY-20261110.md`、backlog K1/U3/C1/C5/U1/U2、架构预审意见。
- 原则：先定架构决策，再写代码；先双视图底座，再技能；不做子方案、不做技能市场。

## 1. 范围

### 做

- **S1 双视图底座**：TaskAction / Selection 唯一归属；parity matrix 含画布、九宫格、右侧抽屉、DetailModal、ImageContextMenu。
- **S2 技能库**：Skill/SkillSlot、PromptSkill 迁移、两 Tab、封面（纯色占位 + 手动替换）、底部「选用技能」、3–6 槽、chip + 合并、另存为技能。
- **S3 可用性 Round 1**：C1 缩放虚化、C5 节点重叠、U1 项目树右键化、U2 画布框选多选。
- **S4 验收/安装 1.0.3**。

### 不做

- M1–M4、S1 设置页重构、S2/S3/S5、E7、macOS、公开 Release。
- 技能市场/社区/作者体系；27 条技能的 8–10 个商业空间内容精修（B05）。
- 任何 B04A 已修的下载/U6/W1 回退。

## 2. 冻结架构决策（DoR 核心）

### 2.1 选中态归属

- **任务选中**：复用 `useStore.selectedTaskIds`（task id）+ `setSelectedTaskIds` / `toggleTaskSelection` / `clearSelection`。
- **素材选中**：新建 `useCanvasSelectionStore`（ephemeral，不持久化）分两个集合：`selectedNodeIds`（画布节点 id）与 `selectedAssetImageIds`（九宫格素材 imageId）；同一集合不混用两种身份。
- **删除本地重复**：删除 `StudioShell` 本地 `selectedTaskIds`、`selectedCanvasTaskId`、`canvasSelectionCommand`；删除 `CanvasBoard` 本地 `selectedIds`（任务）与 `selectedImageIds`（素材）作为“第二事实源”，改为消费上面两处。
- **统一清空**：`clearAllSelection()` 放独立 `src/lib/selection.ts`，清任务 + 两个素材集合 + 递增 `selectionClearNonce`；`CanvasBoard.imageMenu`、`ImageContextMenu.menuInfo` 订阅 nonce 关闭；空白点击、Esc、切换视图/画布都走它。
- `clearSelection` 保留为任务-only 兼容；允许的调用点：InputBar/SearchBar/TaskGrid，以及 `store.ts` 内部只操作任务的路径（如 `setTaskFavoriteCollections`）。切换画布/收藏/视图必须用 `clearAllSelection`；grep 验收只检查这些路径，不把 store 内部 task-only 调用算遗漏。
- `RightGeneratorDrawer.selectedArtboardId` 映射到任务选中；`ImageContextMenu` 无 task 映射时只做图片级动作，parity 标 N/A。

### 2.2 TaskAction 归属

- 新文件 `src/lib/taskActions.ts`：只做业务副作用，不含 React、Toast、菜单文案、确认框。
- 动作（以 §9.5 为准）：`downloadImageRefs`、`downloadTaskOutputs`、`deleteSelection`、`retryTask`、`setTaskAsReference`、`reuseTaskConfig`、`editTaskOutputs`、`openTaskDetail`；收藏沿用 collection-based，不在任务层硬造。
- UI 菜单、确认框、Toast 留在视图；动作层接受已确认的 ids/参数。
- `DetailModal`、`RightGeneratorDrawer`、`CanvasTaskNode`、`CardGridView`、`ImageContextMenu` 全部改为调用同一层；不允许第二套删除/下载/复用实现。

### 2.3 技能 chip 状态

- live 状态：`useStore.activeSkillId` + `skillSlotValues: Record<string, SkillSlotValue>`；`useStore.prompt` 是唯一用户文字。
- `ProjectCanvas` 快照：`activeSkillId`、`skillSlotValues` + 现有 `promptDraft`；不存 `skillUserPrompt`。
- `task.prompt` = **合并后的最终提示词**（与现有任务兼容，显示/导出不变）。
- `task.skillContext?: { id, name, basePrompt, slots, slotValues, userPrompt, version }`：`slots` 是槽定义，`slotValues` 是用户值；用于重试、复用、另存为技能；旧任务无此字段，行为不变。
- 清空规则：
  - 清空输入 → 清 prompt + chip；
  - 删除 chip → 保留用户文字，移除技能；
  - 换技能 → 保留用户文字，替换技能；弹“替换当前技能？”；
  - 切画布 → 随 `ProjectCanvas` 保存/恢复；
  - 重启 → 受 `persistInputOnRestart` 控制；关闭则不恢复 chip；
  - 隐私模式 → chip 随 prompt 快照隐藏/恢复，不带到新任务；
  - 提交后 → 受 `clearInputAfterSubmit` 控制。
- 合并顺序：`skill.basePrompt` → `【本次输入】` 槽位 → `【用户补充】` 用户文字；用户文字最后，不被覆盖。
- 超长：合并后超过 `MAX_PROMPT_LENGTH` 时阻止提交并提示；不静默截断用户文字。

### 2.4 Skill 存储与迁移

- 新建 `useCapabilitySkillStore`，storage key `panpan-capability-skills-v1`；不把 `Skill` 塞进 `PromptSkill` 数组。
- `PromptSkill` 存储保持 `panpan-prompt-skills-v1`，增加 `kind:'prompt'`；旧数据不删、不破坏。
- `Skill` 字段：`id/name/description/category/coverColor/coverImageId/basePrompt/slots/negativePrompt/params/requiredImages/examples/source/version/createdAt/updatedAt`。
- `SkillSlot`：`key/label/type(text|enum|multi|number|bool|image|multi-image)/placeholder/defaultValue/options/required`；`SkillSlotValue = string | string[]`；每个技能 3–6 槽。
- `Skill.requiredImages` 为 `{ slotKey, min, max, roles? }[]`，与图片槽绑定；内置 `skill.json` 的 `image`/`images` 输入映射到图片槽。
- 封面：`coverColor` + `coverImageId`（IndexedDB `storeImage`）；手动替换；重启/导出保留；不在 localStorage 存大 data URL。
- `skillSlotValues` 只持久化 imageId；data URL 仅运行时预览缓存并限制大小，不进入 ProjectCanvas/导出。
- 内置来源：`public/skill-kit`（从 `public/lovart-skill-kit` 重命名，构建脚本同步）映射为 `source:'builtin'`；用户另存为 `source:'mine'`；界面不出现 Lovart。
- 导出/导入：
  - v4 manifest 的 `skills` 继续表示 PromptSkill，保证旧包可读；
  - manifest 保持 version 4；新增可选 `capabilitySkills` 字段；1.0.2 忽略，1.0.3 读取；
  - `capabilitySkills` 独立 normalize/merge；同 ID 以“我的”优先，内置不覆盖我的；
  - 旧 v4 导入不产生 capability skills，只迁 PromptSkill；
  - 封面图随 capabilitySkills 导出（imageId 走图片文件；超限则提示，不静默丢）。
- 另存为技能：从 `task.skillContext` 或当前 composer 生成 `Skill`，`source:'mine'`，不覆盖内置。

## 3. 影响分级

| 级别 | 内容 | 预审 |
|---|---|---|
| A | 任务/素材选中迁移、TaskAction 抽取、数据兼容 | 架构预审 + 执行预审 |
| B | Skill/SkillSlot、chip、双视图 parity | 架构预审 + 执行预审 |
| C | C1/C5/U1/U2、封面占位、局部 UI | 执行预审 |
| D | 文档/证据 | 只审范围 |

## 4. 阶段与验收

### S1 双视图底座（A/B）

- 按 §2.1/§2.2 落地；删除本地重复选中；TaskAction 统一。
- parity matrix：画布/九宫格/右侧抽屉/DetailModal/ImageContextMenu × 下载/删除/重试/设为参考图/复用参数/编辑输出/收藏/详情/选中/清空。
- 验收：`grep` 证明没有第二套任务选中/下载/删除（按 §2.1 允许的 task-only 调用点解释结果）；双视图 E2E 每个动作一遍；现有行为不回归。

### S2 技能库（B）

- 按 §2.3/§2.4 落地。
- 技能库两 Tab；旧 PromptSkill 全部在提示词库；技能卡封面纯色占位 + 手动替换。
- 底部栏「选用技能」弹窗；3–6 槽；chip + 合并；另存为技能。
- 验收：旧 v4 备份可导入；无 prompt 的 Skill 不被丢弃；封面覆盖重启后仍在；chip 切画布/重启/隐私进入退出/默认画布仅 chip 变化/清空规则正确；E2E picker→slots→chip→submit。

### S3 可用性 Round 1（B/C）

- C1 缩放虚化、C5 节点重叠、U1 项目树右键化、U2 画布框选多选。
- 验收：C1/C5 截图对比；U1/U2 双视图 E2E；parity matrix 更新。

### S4 验收/安装（A）

- `gate:dev`、`e2e`、`cargo test`；版本 1.0.3；签名构建；备份 data + app；安装；安装版验证。
- 产出 `GATES-B04B.json`、`REPORT-B04B.md`、`CHECKPOINT` 更新。

## 5. 架构预审输入（DoR）

- 现状 vs 目标：三套选中、四套动作、PromptSkill 单库、无 chip；
- 改动边界：store/StudioShell/CanvasBoard/CardGridView/DetailModal/RightDrawer/ImageContextMenu/SkillLibrary/BottomPromptBar/saveFile；
- 数据模型：Skill/SkillSlot、ProjectCanvas chip 字段、TaskRecord.skillContext、v4 + capabilitySkills 导出；
- 接口契约：TaskAction、Selection、capabilitySkillStore、download；
- parity matrix；
- 失败模式：迁移失败、导出超限、chip 残留、合并超长、切画布混用；
- 测试策略：单测/E2E/安装版/失败注入；
- 替代方案：为什么不继续各视图各写、为什么不把 Skill 塞进 PromptSkill。

## 6. 阻塞定义

- 丢数据/旧备份不可读；
- 泄漏 Key/token/敏感路径；
- 构建/安装/启动/MCP 不可用；
- 双视图再次分裂、chip 跨画布混用、技能迁移丢数据。

## 7. 已知限制

- 27 条技能的内容/封面精修在 B05；本批先交互、占位、迁移。
- 内置技能分类可能仍含电商/UI，B05 收敛到 8–10 个商业空间。
- macOS 不在本批。
- 公开仓仍未发 1.0.3。

## 8. 回滚

- 代码：本批提交；安装前记录 HEAD。
- 数据：`b04b-pre-install-<date>` 备份 data + app；旧 1.0.2 安装包 + `.sig` 保留。
- 技能：迁移前导出 PromptSkill ZIP + capabilitySkills ZIP；失败回退旧存储 key。
- 版本：1.0.3 失败回 1.0.2；不重建同号。

## 9. 架构预审修订记录（v2，2026-11-10）

> 本节是预审修订记录；最终规范以 §2 为准，两处冲突视为文档缺陷，必须回改 §2。

第一轮架构预审结论：`ARCH_REVIEW=CONDITIONAL` / `PLAN_REVIEW=REJECT`。已按以下方式修订，第二轮只做定向验证。

### 9.1 chip live owner 冻结

- **用户文字唯一 owner = `useStore.prompt`**；不再新增 `skillUserPrompt` 作为 live 字段。
- `useStore` 新增 live：`activeSkillId: string | null`、`skillSlotValues: Record<string, SkillSlotValue>`；`prompt` 仍是用户文字。
- `ProjectCanvas` 快照：`activeSkillId`、`skillSlotValues` + 现有 `promptDraft`；不存 `skillUserPrompt`。
- 必须接入：`normalizeCanvas`、`getPersistedWorkspace`、`mergeCanvasSnapshot`、`hasCanvasSnapshotChanged`、`saveActiveCanvasSnapshot`、`exportData`、`createDeleteSnapshot`、隐私输入快照。
- `persistInputOnRestart=false` 时不持久化 chip；`clearInputAfterSubmit=true` 时提交后清 prompt + chip；隐私模式 chip 随 prompt 快照隐藏/恢复。
- `TaskRecord.skillContext` 存 `{ id, name, basePrompt, slots, slotValues, userPrompt, version }`；`task.prompt` 存合并后的最终文本。
- 重试：直接用 `task.prompt`（已合并）生成，不二次展开；复用：用 `skillContext.userPrompt` + chip 恢复；另存为技能：用 `skillContext`。

### 9.2 选中身份与清空 API 冻结

- 任务选中：`useStore.selectedTaskIds`（task id）。
- 素材选中：`useCanvasSelectionStore` 分两个集合：
  - `selectedNodeIds: Set<string>`（画布节点 id）；
  - `selectedAssetImageIds: Set<string>`（九宫格素材 imageId）。
- 同一 Set 不能混用 node id 和 imageId；需要映射时由视图显式映射。
- `clearAllSelection()` 清任务 + 两个素材集合 + 递增 `selectionClearNonce`；`CanvasBoard.imageMenu`、`ImageContextMenu.menuInfo` 订阅 nonce 关闭。
- `clearSelection` 保留为任务-only 兼容；所有“切换画布/收藏/视图”的调用改为 `clearAllSelection`；不允许第二套清空路径。
- `RightGeneratorDrawer.selectedArtboardId` 映射到任务选中；`ImageContextMenu` 无 task 映射时标记 N/A，只做图片级动作。
- `clearAllSelection` 放独立 `src/lib/selection.ts`；canvas selection store 只持有集合，不反向 import store；允许 `clearSelection` 的调用点仅 InputBar/SearchBar/TaskGrid 的 task-only。

### 9.3 SkillSlot 与图片槽

- `SkillSlot.type` 增加 `image` / `multi-image`；`SkillSlotValue = string | string[]`。
- `Skill.requiredImages` 改为 `{ slotKey, min, max, roles? }`，与槽绑定；内置 `skill.json` 的 `image`/`images` 输入映射到图片槽。
- `skillSlotValues` 存 imageId（或 imageId 数组）；data URL 仅运行时预览缓存，不写入 ProjectCanvas/导出；chip 表单负责选图/移除；`skillContext` 存槽定义 + 值。
- 无法映射的内置技能标记 `degraded` 并给出提示，不静默丢字段。
- `skillSlotValues` 只持久化 imageId；data URL 仅运行时预览缓存并限制大小，不进入 ProjectCanvas/导出。

### 9.4 v4 兼容扩展，不升 v5

- **manifest 仍保持 version 4**，新增可选 `capabilitySkills` 字段；1.0.2 忽略未知字段，1.0.3 读取。
- 不修改 `version > 4` 的导入门禁；避免 1.0.3 的备份在 1.0.2 回滚时完全不可读。
- `ExportData`、`getBaseManifestEstimatedBytes`、`assertExportZipFiles`、`exportZip` 测试同步；补 v4 + capabilitySkills 的 round-trip。
- `PromptSkill.kind:'prompt'` 必须加入 `normalizePromptSkill` 白名单，否则重载丢字段。
- 封面：`coverColor` + `coverImageId`（IndexedDB `storeImage`），不在 localStorage 存大 data URL；导出包含封面图。
- `collectSkillCoverImageIds` 增加 capability skill 的 `coverImageId`；导出/删除快照收集封面。
- 1.0.2 导入 v4+capabilitySkills 后再导出会丢 capabilitySkills；回滚前用独立备份，禁止旧版回导后再导出。

### 9.5 TaskAction 变体

- `downloadImageRefs(refs, base, dir?)`：imageId/data/http 统一。
- `downloadTaskOutputs(task, variant: 'current'|'original'|'partial'|'zip')`：覆盖 DetailModal 四种下载。
- `deleteSelection({ taskIds, nodeIds })`：覆盖画布同时删任务 + 素材节点。
- `reuseTaskConfig(task)`：恢复 `skillContext.userPrompt` + chip + images/mask/profile；不把 `task.prompt`（已合并）写回输入框；合并只在提交时发生。
- 收藏：沿用 collection-based `favoriteCollectionIds` 派生；`toggleTaskFavorite` 不在任务层硬造第二套。
- `ImageContextMenu` 无 task 映射时只做图片级动作，parity 标 N/A。

### 9.6 clearInputAfterSubmit 与 retry

- `clearInputAfterSubmit` 当前只有设置字段、没有提交路径读取；本批必须实现并改现有测试（提交后清 prompt + chip），不降级为 known-limit。
- retry 非覆盖模式复制 `skillContext`；`task.prompt` 已合并，重试不二次合并。
- 复用配置时恢复 chip + `skillContext.userPrompt`；不把合并全文再当用户文字。
