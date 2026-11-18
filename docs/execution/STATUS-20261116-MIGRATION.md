# STATUS · 2026-11-16 · 三模块迁移收口

## 结论

AI Studio 三模块（工作流大厅/画布、技能库、设置栏）已按 `MIGRATION-PLAN-20261116.md` 的 P1–P6 迁入本地客户端，构建并覆盖安装 1.3.0，实机跑通。

## 交付

| 阶段 | 结果 |
|---|---|
| P1 工作流大厅 | 四张真实流程卡（原图/成图对比），左侧分类、归档抽屉、引擎状态；示例图在 `public/workflow-demo/` |
| P2 工作流画布 | 节点与连线由 `API_WORKFLOW_BY_ID` 生成，没有的分组不显示；运行走真实 ComfyUI，结果入库并进历史胶囊 |
| P3 技能库 | 27 条纯文配方，8 个真实分类，`{变量}` 高亮，复制/追加到输入台，收藏持久化 |
| P4 设置 | 五栏版式；API 三步（名称与地址 → 密钥与真实 `${baseUrl}/models` 测试 → 点选模型）；推荐服务商折叠、标「含返利」、不写入个人配置；底部未保存拦截 |
| P5 侧栏 | 工作流分类抽屉、技能分类抽屉；分类与收藏计数实时联动 |
| P6 收口 | `gate:dev`、65 条 E2E、构建、覆盖安装、实机验证、文档 |

## 关键文件

- `src/studio/modules/workflow/adapter.ts`：manifest + API 图 → 大厅卡片与真实节点
- `src/studio/modules/workflow/ComfyWorkflowView.tsx`：真实执行入口与进度/取消/错误
- `src/studio/components/WorkflowView.tsx`：原图/蒙版上传 → 锚点 → 队列 → 出图 → 入库
- `src/studio/modules/skills/`：`adapter.ts`、`SkillHubView.tsx`、`libraryStore.ts`
- `src/components/SettingsModal.tsx`、`AddProfileWizard.tsx`
- `src/studio/components/AppSidebar.tsx` + `filterStore.ts`
- 映射规格：`docs/execution/P2-MAPPING-20261116.md`

## 门禁与安装

- `npm run gate:dev`：通过（构建 + 1138 单测 + SAST + release-check）
- `npm run e2e`：65 条全过（设置断言改为「放弃并关闭 / 保存并关闭」）
- 安装包：`src-tauri/target/release/bundle/nsis/PanPan Workbench_1.3.0_x64-setup.exe`
- SHA256：`7A7F88D3EFF4E9DD37455166C76FCFA16F9CCB894E1291EE7B80472B1CEDFF58`
- 构建配置：`tauri build --config <临时配置>` 关闭 updater 产物；仓库 `tauri.conf.json` 未改
- 覆盖安装：`E:\02-RUANJIAN\67-盼盼工作台\PanPan Workbench`，注册表 `1.3.0`
- 实机：工作流大厅 → 无损放大画布 → 运行 → 出图并写入项目历史；技能库 27 条；设置五栏与 API 三步

## 审查

- P1：APPROVE；P2：APPROVE；P3：APPROVE；P4：第一轮 REJECT（外部设置写入会清空未保存草稿），修复后通过；P5：APPROVE。
- 只按「丢数据 / 泄密钥 / 构建安装不可用」三类判定，其余记 known-limit。

## 已知限制

1. 1024 宽下工作流页为 rail + 分类抽屉 + 工作流侧栏三栏，大厅横向偏窄。
2. 自定义副本/导入的工作流只在当前会话有效，不落库。
3. 画布上的比例/分辨率档位不参与真实 API 图（固定 1MP 归一）。
4. 取消运行后，已提交到 ComfyUI 队列的任务仍会执行。
5. `public/skill-kit/` 仍按仓库约定由构建前同步，不入 git；干净检出需本机有技能包源。
6. 设置里部分高级开关仍是即时保存；未保存拦截覆盖输入框类字段。

## 回滚

- 安装包：`PanPan Workbench_1.2.1_x64-setup.exe`
- 数据：`backups\20261112-1.2.1-*`
