# 独立阶段定向复审：1.8.0 S4+S5（r3）

此前两轮均为 `CODE_REVIEW=REJECT`。本轮只复审 MCP metadata 的斜杠/反斜杠 Windows、UNC、POSIX 路径脱敏，以及正常技术 ID 保留；不扩大范围，不修改文件，不进入 S6+S7。

## 输入

- 总方案：`docs/execution/PLAN-1.8.0-LAUNCH-20261117.md`
- 清单：`docs/execution/CHECKLIST-1.8.0-LAUNCH-20261117.md`
- 报告：`docs/execution/REPORT-1.8.0-LAUNCH-S4-S5.md`
- 门禁：`docs/execution/GATES-1.8.0-LAUNCH-S4-S5.json`
- 基线：S2+S3 提交 `556dab1`

## 重点源码

- 三栏规格：`src/studio/components/sidebarStyles.ts`
- 三栏：`AppSidebar.tsx`、`WorkflowHub.tsx`、`SkillHubHost.tsx`
- 拖动：`src/studio/modules/workflow/ComfyWorkflowView.tsx`、`e2e/workflow-drag.e2e.ts`
- 几何验收：`e2e/left-rails.e2e.ts`
- MCP：`src-tauri/src/mcp.rs`
- 设置入口：`src/components/settings/McpSettingsSection.tsx`

## 只审三类阻塞

1. 技能名称/分类、工作流名称和记录元数据是否仍可能泄漏 `C:/...`、`//server/share`、`/Users/...`、`/home/...` 等路径。
2. UUID、SHA256、`wf-*`、`wfi-*`、`builtin:*` 是否被正确保留。
3. MCP 分页、Host/Origin/Bearer/stdio 边界是否因修复回退。

不重开三栏和拖动区域。最多列 3 个阻塞项；其他写 `known-limits`。
