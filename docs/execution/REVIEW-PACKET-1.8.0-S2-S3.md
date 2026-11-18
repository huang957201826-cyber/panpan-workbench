# 独立阶段定向复审：1.8.0 S2+S3（r2）

第一轮 `CODE_REVIEW=REJECT`。本轮只复审“删除提示词后旧 prompt: 镜像复活”是否闭合，以及修复是否引入新阻塞；不扩大范围，不修改文件，不进入 S4+S5。

## 输入

- 总方案：`docs/execution/PLAN-1.8.0-LAUNCH-20261117.md`
- 清单：`docs/execution/CHECKLIST-1.8.0-LAUNCH-20261117.md`
- 报告：`docs/execution/REPORT-1.8.0-LAUNCH-S2-S3.md`
- 门禁：`docs/execution/GATES-1.8.0-LAUNCH-S2-S3.json`
- 基线：S1 提交 `93f0353`

## 重点源码

- 注册表：`src/lib/skillRegistry.ts`、`src/lib/skillRegistry.test.ts`
- 旧技能兼容：`src/lib/promptSkills.ts`、`src/lib/capabilitySkillStore.ts`、`src/lib/migratePromptSkills.ts`
- UI/动作收口：`src/studio/components/SkillHubHost.tsx`、`src/studio/components/SkillPickerModal.tsx`、`src/studio/components/BottomPromptBar.tsx`、`src/studio/components/HomeHubView.tsx`、`src/studio/StudioShell.tsx`
- 备份恢复：`src/store.ts`、`src/lib/exportZip.ts`
- 工作流语义：`src/studio/workflows/projectWorkflows.ts`、`src/studio/workflows/projectWorkflows.test.ts`、`src/studio/components/WorkflowHub.tsx`、`src/studio/components/WorkflowProjectPicker.tsx`

## 只审三类阻塞

1. 删除提示词后，`prompt:<sourceId>` 镜像是否仍可能出现在 catalog、导出或恢复结果中。
2. 镜像过滤是否误删正常 capability、破坏内置/custom 技能或备份恢复。
3. 修复是否导致构建、启动或技能选择不可用。

不重开 S2+S3 其他已审区域。最多列 3 个阻塞项；其他写 `known-limits`。
