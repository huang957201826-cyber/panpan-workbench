# REPORT — 1.8.0 S0 基线与迁移设计

- 批次：`1.8.0-LAUNCH`
- 阶段：`S0`
- 状态：`DONE`，独立窗口 `CODE_REVIEW=APPROVE`（2026-11-18）
- 总方案：`docs/execution/PLAN-1.8.0-LAUNCH-20261117.md`
- 预审冻结文件 SHA256：`912D81374CD13B338946843BD9C7B3E40D56A8512DDD6A37090FAE31B99C5493`
- S0 短修订通过内容 SHA256：`FC31A196398C2CF0125986259775B0B4BFFB6146237752B92AEA7E090755BDD8`
- 清单：`docs/execution/CHECKLIST-1.8.0-LAUNCH-20261117.md`

## 1. 基线

| 项 | 结果 |
|---|---|
| 分支 | `b02` |
| 批次开始提交 | `4115858e0725be756d7b75acb8461e4aea820326` |
| 已安装客户端 | `panpan-workbench 1.7.0`（安装版只读 MCP 返回） |
| 数据目录 | 已识别，本报告只记录匿名 ID `8fa3cb579f662515` |
| 构建 | `npm run build` 通过 |
| 单测 | 104 文件 / 1140 用例通过 |
| vendor | 26 文件通过 |
| 排版扫描 | `text-[数字px]=0`、`leading-[...]=0` |
| SAST | 通过；演示 Key 已清空 |
| 完整 `gate:dev` | 通过（process-check、vendor、typography、build、1140 单测、SAST、release-check） |
| 失败注入 | 缺失数据目录时盘点脚本 exit 1；恢复有效副本后 exit 0 |

### 构建警告（非本阶段阻塞）

- `src/lib/tauriLog.ts` 同时静态和动态导入，动态导入不会拆成独立 chunk。
- 主 chunk 超过 500 kB，Vite 提示可继续 code-split。
- 两项均为既有性能/打包提示，不改变 S0 数据与迁移结论。

完整门禁首次运行发现 `scripts/process-check.mjs` 仍按旧总账列位解析，并把新阶段 `stage-S0-review` 判为非法。S0 已把解析收窄到带“状态”表头的旧式表格，并允许 `stage-*`/`stage-*-review`；修正后 `gate:dev` 通过，没有跳过门禁。

## 2. 真实数据盘点

| 数据 | 结果 |
|---|---:|
| SQLite `tasks` | 19（18 done / 1 error） |
| SQLite `images` | 23 |
| SQLite `thumbnails` | 23 |
| SQLite `kv` | 6 |
| SQLite `meta` | 3 |
| 工作区项目 | 4 |
| 画布 | 6 |
| 画布图片节点 | 3 |
| 能力技能自定义 | 5 |
| 提示词技能 | 0 |
| 技能同名组 | 1（`TestSkill1800` ×2，ID 不同） |
| 缺失图片引用 | 0 |
| 孤儿图片记录 | 0 |
| 重复项目/画布 ID | 0 |
| 孤儿画布 | 0 |

SQLite `integrity_check=ok`、`quick_check=ok`。数据库主文件 122,880 B，盘点时 WAL 700,432 B。

工作流 `localStorage` key 已检出，但当前数据解析到 `workflowIdCount=0`、`workflowResultImageIdCount=0`；工作流结果 IDB 未检出。结论是当前安装没有已保存工作流数据，S1 仍需用非空 fixture 验证迁移。

文件统计：原图 23 个 / 44,892,371 B；缩略图 23 个 / 1,546,194 B；已有 DB 备份 5 个 / 14,237,280 B。

## 3. 受控数据副本

- 副本 ID：`s0-installed-data-copy-20261118`
- 位置：当前主开发工作区 `.tmp/`，不属于仓库交付物。
- 文件：78
- 大小：61,655,377 B
- 清单 SHA256：`90BCACC241FDB459D449DC1242B0989B7E9625E142E4AF94E3E5390A904DE64B`
- 副本只读盘点结果与真实数据一致。

## 4. 用户数据位置清单

| 类别 | 当前事实源 | 是否业务数据 | 备份目标 |
|---|---|---:|---|
| 任务、对话、图片/缩略图元数据 | SQLite 表 | 是 | 是 |
| 原图、缩略图文件 | 数据目录文件 | 是 | 是 |
| 设置、工作区、两类技能 | SQLite `kv` | 是 | 是 |
| 保存的工作流 metadata | WebView localStorage | 是 | S1 迁入 SQLite 后备份 |
| 工作流输入图/结果图 | IndexedDB（当前无数据） | 是 | ZIP 独立图片文件区 |
| 颜色、折叠、导出格式等 UI 偏好 | localStorage | 否 | 不强制，登记为界面偏好 |
| MCP token/config、API Key | meta/kv 密文 | 敏感 | 否 |

## 5. 备份 manifest v5

### 5.1 顶层字段

```ts
interface ExportDataV5 {
  version: 5
  appVersion: string
  exportedAt: string
  backupId: string
  backupPart?: { id: string; index: number; total: number }
  schemaVersions: {
    sqlite: number
    skills: number
    savedWorkflows: number
  }
  settings?: SafeSettings
  tasks?: TaskRecord[]
  agentConversations?: AgentConversation[]
  favoriteCollections?: FavoriteCollection[]
  defaultFavoriteCollectionId?: string | null
  workspace?: WorkspaceState
  skills?: UnifiedSkillRecord[]
  builtinSkillOverrides?: Record<string, SkillOverride>
  savedWorkflows?: SavedWorkflowRecord[]
  imageFiles?: Record<string, ImageFileRef>
  thumbnailFiles?: Record<string, ThumbnailFileRef>
  workflowImageFiles?: Record<string, WorkflowImageRef>
}
```

### 5.2 约束

- `appVersion` 新增强制字段；旧 v4 没有时按兼容路径处理。
- 工作流图片只进入 `workflowImageFiles` 文件区，不放入 `manifest.json`。
- Agent 对话沿用现有分卷计划：对话作为独立计划项拆分，不得在各卷重复全量复制。
- 收藏夹和 `defaultFavoriteCollectionId` 只写入含基础数据的第一卷；后续分卷不得覆盖。
- `backupId` 与分卷信息沿用现有分卷能力。
- 所有 ZIP 文件继续做清单检查和路径白名单检查。
- API Key、MCP token、签名私钥、日志原文、绝对路径不得进入 manifest。
- 导入先构建 `RestorePlan`，不直接按 manifest 顺序写 store。

### 5.3 SafeSettings 白名单

`SafeSettings` 不是任意 `AppSettings` 子集。顶层只允许以下字段：

```text
baseUrl model timeout apiMode codexCli apiProxy streamImages streamPartialImages
providerOrder clearInputAfterSubmit persistInputOnRestart reuseTaskApiProfileTemporarily
alwaysShowRetryButton saveTasksToActiveFavoriteCollection retryMode allowPromptRewrite
taskCompletionNotification writeLogFile enterSubmit privacyModeShortcut colorMode uiFont
uiFontName monoFont monoFontName showBatchPrompt batchPromptEnabled batchPromptMode
batchPromptConcurrencyLimited batchPromptConcurrency referenceImageEditAction
zipDownloadRoutes saveLocationMode agentScrollToBottomAfterSubmit agentMaxToolRounds
agentWebSearch agentMathFormattingPrompt agentApiConfigMode agentTextProfileId
agentImageProfileId studioShellEnabled uiScale activeProfileId
```

`apiKey` 永不允许。`profiles` 和 `customProviders` 作为专门结构处理：

- `profiles` 保留非敏感配置字段，`apiKey` 输出空字符串。
- `customProviders` 保留结构，但必须递归清洗 `query/body` 等全部嵌套对象。
- 敏感键名归一化后拒绝：`apiKey`、`accessKey`、`privateKey`、`token`、`accessToken`、`refreshToken`、`secret`、`clientSecret`、`password`、`passwd`、`authorization`、`auth`、`bearer`、`cookie`、`credential`、`signingKey`、`mcpToken`。
- 字符串值命中 `Bearer ...` 或 `sk-...` 时改为空/掩码。
- 新顶层设置字段必须显式加入白名单，不能因为新增字段自动进入备份。

## 6. 技能统一模型

```ts
type UnifiedSkillRecord = SkillShared & (
  | {
      kind: 'capability'
      basePrompt: string
      slots: SkillSlot[]
      requiredImages?: SkillRequiredImages[]
      existingCapabilityPayload: true
    }
  | {
      kind: 'prompt'
      prompt: string
      variables: SkillVariable[]
      recommendedParams?: PromptSkillParams
    }
)
```

### 6.1 迁移映射

| 来源 | 目标 | 保留 |
|---|---|---|
| `panpan-capability-skills-v1.state.mine` | `UnifiedSkillRecord(kind=capability)` | ID、名称、描述、槽位、图片约束、收藏、封面、参数、版本、时间 |
| `panpan-prompt-skills-v1.state.skills` | `UnifiedSkillRecord(kind=prompt)` | ID、标题、提示词、变量、标签、推荐参数、收藏、封面、时间 |
| 内置技能 | 只读快照 | 不复制进用户注册表 |
| `builtinOverrides` | 独立覆盖层 | 收藏、封面、模型、提示词和槽位覆盖 |

### 6.2 冲突规则

- 名称不是身份；同名不合并、不删除。
- 同一 canonical ID 在同一 kind 内冲突时，迁移中止并输出冲突报告，不静默覆盖。
- 同一原始 ID 出现在不同 kind 时，保留 capability 原 ID；prompt 使用确定性后缀 `legacy-prompt:<sha256-prefix>`，并记录映射。
- `TestSkill1800` 不在产品迁移中自动删除。
- 提示词技能保持显式合成，不引入通用 `execute`。

### 6.3 迁移完成标记

- 新 key：`panpan-unified-skills-v2`
- marker：`skills-unified-migrated-v2`
- 成功前旧 key 原样保留；成功后旧 key 只读兼容，至少保留到 1.8.0 U2 完成。

## 7. 工作流模型与前置迁移

### 7.1 统一记录

```ts
interface SavedWorkflowRecord {
  id: string
  name: string
  presetId: string
  workspaceProjectId: string | null
  values: Record<string, string | number | boolean>
  results: SavedWorkflowResult[]
  lastRunAt?: number
  createdAt: number
  updatedAt: number
}
```

`values` 只允许当前预设支持的有限参数，不允许任意节点属性、绝对路径或图片 data URL。

### 7.2 SQLite 迁移

- 新增 schema migration 3：
  - `saved_workflows(id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)`
  - `restore_journal(id TEXT PRIMARY KEY, state TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL)`
  - `saved_workflows_updated_at` 索引
- meta marker：`saved-workflows-migrated-v2`。
- 旧 `panpan-project-workflows-v1` 只读迁移；失败时旧 key 原样保留。
- 旧 `projectId='workflow'` 映射为 `workspaceProjectId:null`；只有 ID 确实存在于工作区项目时才保留关联。
- 工作流 ID、参数、运行记录和图片引用 ID 原样保留。

### 7.3 恢复与 IDB

- 工作流 metadata 在 S1 先进入 SQLite，恢复时参与 SQLite 单事务。
- IDB 图片不参与 SQLite 事务。
- 恢复图片先写入不可变暂存 ID；SQLite commit 成功后引用新 ID。
- commit 失败时只回收暂存图片，现有业务数据不变。

## 8. RestorePlan 提交与锁

### 8.1 固定顺序

```text
acquire restore lock
→ block new generation/delete/clear/import/restore
→ bump task/storage epoch and invalidate late callbacks
→ abort in-flight work and wait task writes
→ flush tauriStorage; require explicit success
→ clear pre-restore dirty keys
→ create safety snapshot
→ validate and stage images/temp records
→ SQLite single transaction commit
→ refresh store + kv + image caches
→ cleanup
→ unlock
```

### 8.2 失败中止

- flush 失败：不清 dirty，不继续。
- wait 超时、写入未排空：中止。
- 安全快照失败或空间不足：不进入 staging。
- staging 失败：清理暂存，不进入 commit。
- commit 失败：SQLite 回滚，清理暂存 IDB 图片。
- commit 后旧 epoch 写回：拒绝，不覆盖恢复数据。

### 8.3 恢复模式

- 合并：保留现有数据，只新增不存在 ID；同 ID 跳过。
- 替换：二次确认后按所选类别替换；同 ID 使用备份。
- Agent 对话与关联 Agent 任务按组合类别处理；合并时同 ID 对话及其关联任务整体跳过。
- 收藏夹合并保留现有同 ID；默认收藏夹 ID 优先保留当前有效值，空值才使用备份值。
- 替换恢复整体使用备份收藏夹和默认 ID；引用不存在时回退默认收藏夹。
- 两种模式都先生成安全快照。

## 9. 回滚点

| 项 | 回滚内容 |
|---|---|
| 代码 | `4115858e0725be756d7b75acb8461e4aea820326` |
| 安装 | 已保留 1.7.0 安装包 |
| 数据 | 当前工作区 `.tmp/s0-installed-data-copy-20261118` + manifest |
| DB 迁移 | 应用既有 `db-pre-migrate-*.db` 自动快照 |
| 旧来源 | 旧技能 key、旧工作流 localStorage 在 U2 完成前不删除 |

## 10. 证据

- `docs/execution/evidence/s0-data-inventory-20261118.json`
- `docs/execution/evidence/s0-test-copy-inventory-20261118.json`
- `.tmp/s0-installed-data-copy-20261118.manifest.json`
- `.tmp/s0-inventory-failure.log`
- `.tmp/s0-mcp-inventory.json`
- `docs/execution/GATES-1.8.0-LAUNCH-S0.json`
- `scripts/process-check.mjs` 的新总账/阶段兼容修正

## 11. 本阶段结论

- S0 清单 8 项全部完成。
- 未写真实用户数据，未进入 S1。
- 迁移顺序、manifest、技能 union、工作流 SQLite 前置、恢复锁和回滚点已冻结为 S1 输入。
- 等待独立窗口代码复审；未获得 `CODE_REVIEW=APPROVE` 前不进入 S1。
