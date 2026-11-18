# 独立阶段定向复审包：1.8.0 S1（r2）

你是本项目独立只读审查窗口。第一轮 S1 审查为 `CODE_REVIEW=REJECT`，本轮只复审三个 P0 是否闭合以及整改是否引入新的丢数据、密钥泄漏、构建/启动阻塞，不扩大范围、不修改文件、不进入 S2。

## 输入

- 冻结方案：`docs/execution/PLAN-1.8.0-LAUNCH-20261117.md`
- 执行清单：`docs/execution/CHECKLIST-1.8.0-LAUNCH-20261117.md`
- S1 报告：`docs/execution/REPORT-1.8.0-LAUNCH-S1.md`
- S1 门禁：`docs/execution/GATES-1.8.0-LAUNCH-S1.json`
- S0 复审：`CODE_REVIEW=APPROVE`
- 清单 SHA256：`C458A0558AD263B32925E588104DFFCE61425198C16CDBBCEE9509F91D3A94E1`
- S1 报告 SHA256：`98AEBDFAA4282F1F2F488B3667CB75C8FB69B0B29E8C5FD431EC59AC707BD88C`
- S1 门禁 SHA256：`25F5D328F092938499687E70A07A21DE3FBE4828F63FAF6343C80C7C5FF1F700`

## 本阶段代码

- SQLite schema / 原子事务：`src-tauri/src/storage/mod.rs`
- Tauri commands / ACL：`src-tauri/src/storage/commands.rs`、`src-tauri/permissions/storage.toml`、`src-tauri/src/lib.rs`
- 工作流存储迁移：`src/studio/workflows/projectWorkflows.ts`
- 工作流备份：`src/lib/workflowBackup.ts`
- 图片不可变 ID remap：`src/lib/imageRestore.ts`
- 恢复合并规则：`src/lib/restorePlan.ts`
- journal recovery：`src/lib/restoreRecovery.ts`、`src/main.tsx`
- v5 ZIP / SafeSettings：`src/lib/exportZip.ts`
- 恢复主路径：`src/store.ts`
- 严格 flush：`src/lib/tauriStorage.ts`
- 相关测试：`src/lib/*.test.ts`、`src/store.test.ts`、Rust storage tests

## 自动门禁

- `npm run gate:dev`：通过
- 前端：109 文件 / 1160 用例通过
- Rust：110 用例通过
- SAST、build、release-check、vendor、typography：通过

## 第一轮阻塞项

1. 普通图片和缩略图是否始终先写不可变 staging ID，commit 失败后旧图片、缩略图和来源 URL 是否逐字节不变。
2. 恢复锁是否覆盖 Agent 提交、请求取消、执行排空和对话持久化队列；acquire 失败后是否解除锁并恢复任务提交。
3. 工作流 migration marker 是否只有一个 key；缺图时是否保留记录、参数和 ID，而不是删除运行记录。

## 定向复审重点

1. 只检查上述三个 P0 的真实实现与对应回归测试，不以文档声明代替代码判断。
2. 检查整改是否引入新的现有图片覆盖、Agent 迟到回调、半恢复、journal 漏清理或迁移覆盖问题。
3. U2 三项仍必须是 `[-]`，不能视为本阶段完成。

## 允许带入 U2 的条件

1. 使用 UI 创建非空工作流、Agent 和收藏夹，验证分卷、合并/替换、缺图和重启恢复。
2. 在真实导出、诊断和日志中检查 customProviders query/body 敏感值不存在。
3. S2 后验证 capability/prompt 同 ID remap 和 activeSkill/引用完整性。

## 输出格式

```text
CODE_REVIEW=APPROVE|REJECT

阻塞项（最多 3 个）
1. [P0/P1] 问题
   证据：
   必须修改：

允许带入 U2 的条件（最多 3 个）
1. ...

非阻塞问题
1. ...

结论
- 是否允许进入 S2：
```

只按丢数据、密钥泄漏、构建/安装/启动/MCP 不可用判断阻塞。不要开始实现。
