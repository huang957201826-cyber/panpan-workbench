# 独立审查包（第 3 轮）：1.8.0 方案与架构预审

你是本项目的独立审查窗口，只读，不修改任何文件。请以第三方工程审查角色判断冻结方案是否站得住，不要顺着作者观点找理由，也不要扩张用户未要求的功能。

## 审查对象

- 仓库：`C:\Users\95720\生图软件二开\gpt_image_playground-main`
- 总方案：`docs/execution/PLAN-1.8.0-LAUNCH-20261117.md`
- 执行清单：`docs/execution/CHECKLIST-1.8.0-LAUNCH-20261117.md`
- 需求总账：`docs/execution/ISSUE-LEDGER-20261117.md`
- 架构复审：`docs/execution/ARCH-REVIEW-20261117.md`
- 执行规则：`docs/execution/WORKING-RULES.md`
- 方案 SHA256：`902C36F49F832961F2F58D5021B6006061DFE502CF6E2DF81F31755B9D21AB0F`
- 清单 SHA256：`533E1D548789BDBB9E45CC47E13227D430FC2F3AECF3CB0A768E0EC3422CD9FD`

先读总方案与清单，再按需读取下列代码路径。不要依赖聊天记录，不要主动改代码。

## 第 2 轮审查阻塞的处理

1. **S1/S3 顺序冲突**
   - 工作流 metadata 迁入 SQLite 前置为 `S1-00`，必须先于恢复实现。
   - S1 的业务可见提交点只包含 SQLite；IDB 图片使用不可变暂存 ID，不参与 SQLite 事务。
   - S3 改为只做语义改名、旧 key 只读兼容、最终清理和行为验证，不再迁移业务存储。
2. **恢复锁失败与排空语义**
   - 已冻结完整序列：acquire → 阻止新操作 → bump epoch/取消任务 → 排空任务写 → flush 并清 dirty → 快照 → staging → commit → 刷新缓存 → cleanup/unlock。
   - flush 失败、排空超时、快照失败、磁盘满或 staging 失败都在现有数据变更前中止。
   - commit 后旧 epoch 迟到回调必须被拒绝；journal recovery 在 store hydration 前执行。
3. **避免过度设计**
   - 不再要求提示词技能实现通用 `execute`。
   - MCP 不新建跨前端/Rust 通用领域框架，只复用稳定只读查询。

## 第 1 轮审查阻塞的处理

1. **恢复提交与冲突口径**
   - 已新增 AD-08：解析、校验、冲突预览、staging、SQLite 单事务可见提交点、cleanup、journal recovery。
   - 合并恢复同 ID 跳过；替换恢复二次确认后同 ID 用备份。
   - 已补五阶段失败注入、崩溃恢复和恢复写锁验收。
2. **MCP schema 与敏感路径**
   - 已新增 7.3：五个工具的请求/响应字段、分页上限 200、稳定错误码。
   - `diagnostics.get` 仅返回版本、布尔状态、计数和脱敏摘要。
   - `backup.verify` 仅返回类别、计数和错误代码，不返回路径。
3. **SAST 与发布私钥边界**
   - 演示 Key 已清空；实际执行 `npm run sast` 已通过。
   - Tag 桌面 Release 改为验证/门禁，不读取私钥 Secret、不自动上传桌面包。
   - 最终 `.sig`、安装包、`latest.json`、SHA256 和 URL 由本机人工核验后，经授权上传。

本轮请重点确认上述 3 项是否闭合，以及修订是否引入新的 P0/P1 阻塞。

## 已冻结的用户约束

1. 当前窗口同时作为总控和主开发窗口；用户会另行打开审查窗口并转交结论。
2. 只本地提交，不 push、不打 tag、不上传 Release；发布必须再次获得用户明确授权。
3. 设置页“保存此配置”和左侧说明保持原样。
4. 不使用 Windows Authenticode；接受 SmartScreen，并在 README/下载页披露。
5. Tauri updater 私钥和密码只由用户本地保管，不进入仓库、CI Secret、Release、日志、备份或截图；仓库/CI 如需占位只允许空模板。
6. 正式 Release 只允许安装包、公开 `.sig`、`latest.json`、SHA256 和发布说明。
7. 目标版本为 `1.8.0`，完成后准备正式上线。
8. 不推倒重写，不换 Zustand/SQLite/Tauri/React，不先整体拆 `store.ts`。

## 需要核对的代码与证据

### 数据、备份与迁移

- `src/types.ts`：`Project`、`ProjectCanvas`、`PromptSkill`、`Skill`、`ExportData`
- `src/store.ts`：persist、`clearData`、`exportData`、`importData`
- `src/lib/exportZip.ts`：manifest、分卷、技能导出、导入合并
- `src/lib/persistedState.ts`、`src/lib/workspaceStore.ts`
- `src/lib/tauriStorage.ts`、`src/lib/secretVault.ts`
- `src/studio/workflows/projectWorkflows.ts`
- `src/studio/workflows/resultImageStore.ts`

重点判断：

- 备份 v5 是否真正覆盖全部用户业务数据；
- 工作流配置从 localStorage、结果图从 IDB 导出/恢复是否有可靠事务边界；
- 旧 1.7.0 ZIP、旧 localStorage、旧技能 key 是否仍可读；
- 迁移失败是否保留旧数据；
- “清空数据”的范围是否准确，是否有静默残留。

### 技能架构

- `src/lib/capabilitySkillStore.ts`
- `src/lib/skillStore.ts`
- `src/lib/promptSkills.ts`
- `src/lib/promptSkillAdapter.ts`
- `src/lib/migratePromptSkills.ts`
- `src/lib/capabilitySkills.ts`
- `src/lib/skillKit.ts`
- `src/studio/components/SkillHubHost.tsx`
- `src/studio/modules/skills/SkillHubView.tsx`
- `src/studio/components/HomeHubView.tsx`

重点判断：

- 单注册表 + 判别联合是否比继续保留两套 store 更能降低长期修改成本；
- 是否能保留能力技能、提示词技能的真实差异，避免过度抽象；
- ID、名称、收藏、封面、变量、槽位、内置覆盖是否迁移完整；
- 新增技能类型是否真的只需新增处理器，而不是继续改多处；
- 是否出现第三套不必要的转换层。

### 工作流语义与性能

- `src/studio/components/WorkflowHub.tsx`
- `src/studio/modules/workflow/types.ts`
- `src/studio/modules/workflow/ComfyWorkflowView.tsx`
- `src/studio/types.ts`

重点判断：

- 工作区项目与保存的工作流分离是否符合实际语义；
- 移除占位 `projectId='workflow'` 是否影响现有数据和未来关联；
- 节点拖动只改 DOM transform、松手写 state 的方案是否正确；
- 拖动期间 `transition-all` 修复是否存在落点、连线、缩放和撤销竞态；
- 是否需要更新连线跟手，还是可登记限制。

### 左栏一致性

- `src/studio/components/AppSidebar.tsx`
- `src/studio/components/WorkflowHub.tsx`
- `src/studio/components/SkillHubHost.tsx`
- `src/studio/studio.css`
- `e2e/left-rails.e2e.ts`

重点判断：

- 共享 Sidebar shell 是否足够轻量；
- 项目搜索、工作流引擎/分组、技能分类是否仍能保持各自语义；
- 以技能库为视觉基准时，目标几何是否清楚；
- 是否会把三类业务内容错误抽成万能组件。

### MCP、设置与发布

- `src-tauri/src/mcp.rs`
- `src/components/settings/McpSettingsSection.tsx`
- `src/studio/modules/settings/SettingsModal.tsx`
- `.github/workflows/build.yml`
- `.github/workflows/tauri-release.yml`
- `src-tauri/tauri.conf.json`
- `src-tauri/windows/installer.nsi`
- `src/lib/diagnostics.ts`
- `src-tauri/src/diagnostics.rs`

重点判断：

- 新增五项只读 MCP 是否必要且不形成第二套业务逻辑；
- schema、脱敏、路径泄漏和只读边界；
- 无 Authenticode 但保留本地 updater 签名是否表述和执行一致；
- 发布工作流不依赖私钥 Secret 时，本机构建和人工授权的边界是否清楚；
- E2E advisory、12 条 skip 和发布无完整门禁是否被方案正确处理。

### 测试与发布门禁

- `e2e/left-rails.e2e.ts`
- `e2e/release-sweep.e2e.ts`
- `e2e/migration.e2e.ts`
- `e2e/workflow.e2e.ts`
- `e2e/acceptance.e2e.ts`
- `playwright.config.ts`
- `package.json`
- `.github/workflows/build.yml`

重点判断：

- 验收是否能覆盖真实旅程，而不是单测自证；
- 备份/恢复、技能迁移、清空、拖动和安装/更新是否有可执行门禁；
- 失败注入是否会真变红；
- 是否遗漏构建、安装、启动、MCP 不可用这三类阻塞；
- 74/76 项是否过多到失去重点，是否存在可删的无效检查。

## 审查要求

1. 只抓大放小，不挑命名、文案、个人偏好。
2. 阻塞只允许三类：
   - 会丢数据或损坏数据；
   - 会泄漏 API Key、token、私钥、敏感路径或破坏安全边界；
   - 会导致构建、安装、启动、更新或 MCP 不可用。
3. 架构预审最多列 3 个阻塞项、5 个非阻塞风险。
4. 执行预审最多列 3 个阻塞项。
5. 如认为方案过度重构，请指出哪一项可以删除或延后。
6. 如认为方案漏项，请指出具体阶段、接口或验收，不接受泛泛而谈。
7. 不要重开已冻结的用户约束；只判断方案是否安全、完整、可执行、可回滚。
8. 最多两轮审查；本轮只输出结论，不修改代码。

## 必须输出以下格式

```text
ARCH_REVIEW=APPROVE|CONDITIONAL|REJECT
PLAN_REVIEW=APPROVE|REJECT

阻塞项（最多 3 个）
1. [ARCH/PLAN][P0/P1] 问题
   证据：
   必须修改：

非阻塞风险（最多 5 个）
1. 风险与建议

可能过度设计或可延后项
1. ...

必须补充的验收（最多 5 个）
1. ...

结论
- 是否允许冻结为 1.8.0 执行方案：
- 若 CONDITIONAL/REJECT，只允许做哪些短修订：
```

请以 `ARCH_REVIEW` 和 `PLAN_REVIEW` 为最高层结论。不要自行开始实现。
