# REPORT — 1.8.0 S1 数据安全与恢复

- 批次：`1.8.0-LAUNCH`
- 阶段：`S1`
- 状态：`APPROVED`，独立定向 `CODE_REVIEW=APPROVE`
- 总方案：`docs/execution/PLAN-1.8.0-LAUNCH-20261117.md`
- 基础提交：`f40777c`（S0 收口）
- 审查轮次：`r2`

## 1. 本阶段交付

### 1.1 工作流 metadata 前置迁移

- SQLite schema 升到 v3。
- 新增 `saved_workflows` 表及更新时间索引。
- 工作流记录不再以原生 localStorage 为主存；首次 Tauri 启动从 `panpan-project-workflows-v1` 幂等迁移。
- 迁移完成标记为 `saved-workflows-migrated-v2`。
- 旧 `projectId` 规则：
  - `'workflow'` / `'draft'` → `workspaceProjectId: null`
  - 其他真实项目 ID → 保留为 `workspaceProjectId`
- 迁移失败时旧 key 原样保留。

### 1.2 备份 manifest v5

- `manifest.version=5`，新增 `appVersion`。
- 保留 v4 已有的：
  - `tasks`
  - `agentConversations`
  - `favoriteCollections`
  - `defaultFavoriteCollectionId`
  - `workspace`
- 新增：
  - `savedWorkflows`
  - `workflowImageFiles`
- 工作流图片写入 `workflow-images/` 文件区，不进入 manifest。
- 工作流 metadata 只写基础数据卷；工作流图片按分卷计划独立分配。
- v4 旧备份仍走原兼容导入路径。

### 1.3 SafeSettings

- 顶层字段使用显式白名单，新设置字段不会自动导出。
- `apiKey` 顶层字段直接排除。
- `profiles/customProviders` 作为专门结构保留。
- 所有嵌套对象递归拒绝：
  - apiKey / accessKey / privateKey / signingKey / mcpToken
  - accessToken / refreshToken / token
  - secret / clientSecret / password / passwd
  - authorization / credential / cookie / bearer
- `Bearer ...`、`sk-...` 和常见 `key=value` 值统一掩码。
- `customProviders.query/body` 已加入专项测试。

### 1.4 RestorePlan

- 恢复分为：
  - 解析
  - 校验
  - 冲突统计
  - 安全快照
  - IDB 图片 staging
  - SQLite 单事务 commit
  - 内存/cache hydration
  - cleanup / journal recovery
- 恢复模式：
  - 合并：任务、Agent 对话、技能和工作流按冻结的同 ID 规则合并。
  - 替换：二次确认后使用备份同 ID。
- 收藏夹合并保留现有同 ID；默认收藏夹 ID 优先保留当前有效值。
- 替换模式整体使用备份收藏夹和默认 ID。
- 普通图片和缩略图不按备份原 ID 直接覆盖：
  - 每次恢复为图片生成不可变 staging ID。
  - 任务、Agent、工作区、技能、覆盖层和工作流图片引用统一 remap。
  - commit 失败时删除 staging 文件，旧图片、缩略图和来源 URL 保持不变。

### 1.5 恢复写锁

固定顺序：

```text
restore lock
→ 停止运行中任务
→ 增加 Agent 恢复代次并取消 Agent 请求
→ 等待 Agent 执行与对话持久化队列排空
→ 阻止新提交/清空/导出
→ 等待任务写入排空
→ 严格 flush tauriStorage
→ 清理 dirty 状态（失败即中止）
→ 安全快照
→ staging
→ SQLite commit
→ 刷新内存和图片缓存
→ cleanup
→ unlock
```

- `flushTauriStorageStrict` 在 flush 失败或仍有 dirty key 时抛出。
- Agent 排空失败或超过 5 秒时中止恢复；`acquire` 任何阶段失败都会解除恢复锁和任务写入阻断。
- 恢复开始后拒绝提交、重新生成、继续恢复、新建对话和标题生成迟到回写。
- 快照失败发生在 staging 之前。
- SQLite commit 失败整体回滚。
- commit 成功后旧任务写入状态清理，迟到回调不能覆盖新快照。

### 1.6 Journal recovery

- 新增 `restore_journal` 表。
- staging 前写 journal，分区记录普通图片、缩略图和工作流结果图暂存 ID。
- commit 与 journal `committed` 状态在同一 SQLite 事务内完成。
- 启动阶段在 App/store hydration 前回收：
  - `staging`：普通图片/缩略图走 `deleteImage`，工作流结果图走 `deleteResultImages`，随后删除 journal。
  - `committed`：保留已引用图片，只删除 journal。

### 1.7 清空数据说明

- 设置页明确说明“清空任务与配置”不包含技能和保存的工作流。
- 本批不提供名为“清空全部用户数据”的入口，避免用模糊范围执行破坏性操作。

## 2. 代码边界

- Rust storage schema / 原子提交：`src-tauri/src/storage/mod.rs`
- Tauri commands / ACL：`src-tauri/src/storage/commands.rs`、`permissions/storage.toml`、`lib.rs`
- 前端工作流存储：`src/studio/workflows/projectWorkflows.ts`
- 工作流备份/暂存：`src/lib/workflowBackup.ts`
- 恢复合并规则：`src/lib/restorePlan.ts`
- 启动 journal recovery：`src/lib/restoreRecovery.ts`、`src/main.tsx`
- v5 ZIP：`src/lib/exportZip.ts`、`src/store.ts`
- 设置清洗：`src/lib/exportZip.ts`

## 3. 测试与门禁

| 门禁 | 结果 |
|---|---|
| `npm run gate:dev` | 通过 |
| 前端测试 | 109 文件 / 1160 用例通过 |
| Rust 测试 | 110 用例通过 |
| build | 通过 |
| SAST | 通过 |
| release-check | 通过 |
| 排版扫描 | 0 |
| vendor | 26 文件通过 |

### 3.1 新增/更新测试

- v5 ZIP workflow metadata + workflow image round trip。
- v5 import：任务、Agent、收藏夹、技能、工作流合并恢复。
- Agent 同 ID 对话及其关联任务整体跳过。
- workflow image staging + ID remap。
- 缺失 workflow image 时记录级降级。
- SafeSettings 顶层白名单。
- customProviders query/body 嵌套 token/password/authorization/Bearer/sk 清洗。
- 运行中任务在 v5 恢复前停止并排空。
- Agent 文本请求进行中可取消、排空并完成 v5 恢复。
- Agent 持久化队列失败时，恢复锁解除后任务仍可提交。
- 同 ID、不同字节的图片和缩略图在 commit 失败后逐字节保持不变。
- 旧 localStorage 非空但迁移 marker 已完成时，不会覆盖恢复后的 SQLite 工作流。
- 缺图工作流结果保留记录、参数和原 image ID，并标记 `missingImageIds`。
- staging/committed journal recovery，覆盖普通图片、缩略图和工作流结果图。
- Rust 原子提交：
  - 成功 commit
  - 非法文档整体回滚
  - 非法 kv 写入导致全类别回滚
- 严格 flush 失败返回错误，不清理 dirty。
- 工作流旧 `projectId` 归一化。

## 4. 失败注入

| 注入 | 结果 |
|---|---|
| 损坏 JSON 文档 | restore 事务回滚，旧任务/工作流不变 |
| 非法 kv 写入 | 任务、对话、工作流、kv 全部回滚 |
| flush 写库失败 | strict flush 抛错，供恢复中止 |
| 缺失工作流图片 | 对应结果保留并标记缺图，报告缺失数 |
| staging journal 遗留 | 启动前按图片类别删除暂存文件 |
| committed journal 遗留 | 保留图片，仅删除 journal |
| 运行中任务 | 恢复前停止并等待写入排空 |
| Agent 文本请求进行中 | 取消请求、等待执行和对话队列排空后才恢复 |
| Agent 对话持久化失败 | 恢复中止、锁释放，后续任务可正常提交 |
| 同 ID 图片 commit 失败 | 旧图片、缩略图和来源 URL 不变，staging 清理 |

## 5. 带入 U2 的条件

1. 使用 UI 真实创建非空工作流、Agent 对话和收藏夹，验证导出/分卷/合并/替换/重启恢复。
2. 在真实导出文件、诊断和日志中检查 `customProviders.query/body` 注入的 token/password/authorization/Bearer/sk 原值不存在。
3. S2 完成后，对 capability/prompt 同 ID 冲突 remap 验证 `activeSkillId`、封面和参考图引用仍有效。

以上三项已在清单中标记为 `[-]`，不作为本阶段已完成项。

## 6. 已知限制

- 当前真实数据没有已保存工作流，因此 S1 的 workflow 测试使用非空 fixture；安装版真实 UI fixture 留到 U2。
- Web 测试不能证明 Tauri ACL / SQLite migration / 启动前 journal recovery；安装版 U2 必须覆盖。
- 工作流结果图缺失时保留记录、参数和 ID，仅标记图片不可用，不伪造图片。
- 恢复 commit 只覆盖业务数据事务；IDB 图片使用 staging + journal 协调，不是跨数据库原子事务。

## 7. 第一轮审查阻塞项闭环

| 审查项 | 整改 | 证据 |
|---|---|---|
| 普通图片/缩略图 commit 前按原 ID 覆盖 | 全部导入图片先分配不可变 staging ID；所有业务引用递归 remap；失败只清 staging | `src/lib/imageRestore.ts`、`src/store.ts`、同 ID commit 失败测试 |
| 恢复锁漏掉 Agent 和 acquire 失败遗留锁 | 增加 Agent epoch、取消/等待执行、排空对话持久化；acquire 失败统一 release | `src/store.ts`、Agent 进行中恢复测试、drain 失败后任务提交测试 |
| 工作流 marker 不一致、缺图删记录 | 导出唯一 marker 常量；恢复写同一 key；缺图记录保留并标记 | `projectWorkflows.ts`、`workflowBackup.ts`、marker/缺图测试 |

## 8. 回滚

- 代码回滚点：S0 提交 `f40777c`。
- 数据回滚：S0 受控副本 `s0-installed-data-copy-20261118`。
- 新 schema 升级前由既有 `db-pre-migrate-*.db` 自动快照保护。
- 旧工作流 localStorage 和旧技能 key 在 1.8.0 U2 完成前不删除。
- 1.7.0 安装包保留。

## 9. 证据

- `docs/execution/GATES-1.8.0-LAUNCH-S1.json`
- `src-tauri/src/storage/mod.rs` 原子提交测试
- `src/lib/exportZip.test.ts`
- `src/lib/restorePlan.test.ts`
- `src/lib/workflowBackup.test.ts`
- `src/lib/restoreRecovery.test.ts`
- `src/lib/imageRestore.test.ts`
- `src/lib/workflowBackup.test.ts`
- `src/studio/workflows/projectWorkflows.tauri.test.ts`
- `src/lib/tauriStorage.test.ts`
- `src/store.test.ts`

## 10. 结论

- S1 代码、门禁和自动失败注入完成。
- 第一轮三个 P0 已完成定向整改并通过自动回归。
- 独立窗口已确认三个 P0 闭合，未发现新的三类阻塞。
- 允许进入合并执行批次 `S2 + S3`；该批准只代表 S1 通过。
