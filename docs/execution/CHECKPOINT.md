# CHECKPOINT — 盼盼工作台

- **执行规则：`docs/execution/WORKING-RULES.md`（一份总方案；禁止子方案；抓大放小）**
- 当前批次：`1.8.0-LAUNCH`（implementation）
- 当前阶段：`S7` 唯一一次最终构建、安装与 U2
- 剩余施工口径：S1 独立复审；之后按 `WORKING-RULES.md` §2.1.2 合并为 `S2+S3`、`S4+S5`、`S6+S7` 三个批次
- 总方案：`docs/execution/PLAN-1.8.0-LAUNCH-20261117.md`，`FROZEN`
- 审查通过内容 SHA256：`902C36F49F832961F2F58D5021B6006061DFE502CF6E2DF81F31755B9D21AB0F`
- S0 修订通过内容 SHA256：`FC31A196398C2CF0125986259775B0B4BFFB6146237752B92AEA7E090755BDD8`
- 当前冻结文件 SHA256：`B343E0CF467E2381239F36026D63581CE8955F84AB15D5C23846395938533728`
- 清单：`docs/execution/CHECKLIST-1.8.0-LAUNCH-20261117.md`，103 项
- 清单 SHA256：`C458A0558AD263B32925E588104DFFCE61425198C16CDBBCEE9509F91D3A94E1`
- S0 报告：`docs/execution/REPORT-1.8.0-LAUNCH-S0.md`
- S0 门禁：`docs/execution/GATES-1.8.0-LAUNCH-S0.json`
- S0 复审：`CODE_REVIEW=APPROVE`
- S1 报告：`docs/execution/REPORT-1.8.0-LAUNCH-S1.md`
- S1 门禁：`docs/execution/GATES-1.8.0-LAUNCH-S1.json`
- S1 复审包：`docs/execution/REVIEW-PACKET-1.8.0-S1-20261118.md`
- 方案预审：`ARCH_REVIEW=APPROVE`、`PLAN_REVIEW=APPROVE`
- 状态：S1、S2+S3、S4+S5 已复审；S6 源码/文档门禁完成并停审，安装、push/tag/Release 均未开始
- 历史批次：`1.7.0-LAUNCH-PREP`、`1.3.3-ROLLBACK`、`1.3.2-PARITY`、`1.3.1-PARITY`、`1.3.0-MIGRATION`、`1.3.0-W2`、`1.2.1-R9`、`1.2.0`、`1.1.0`、`1.0.8`、`B04B`、`B04A`、`B03`、`B02`

## 1.3.3 三页 UI 回退收口（2026-11-17）

- BASE `1c6a925`；恢复 `SettingsModal.tsx`、`WorkflowView.tsx`、`AppSidebar.tsx`，技能页回 `CapabilitySkillLibrary`，删除 `src/studio/modules/**`，`StudioShell`/`App` 导入回 BASE 写法；后端未动。
- 门禁：build、1129 单测、`gate:dev`（SAST、release-check 1.3.3）通过。
- 安装包：`PanPan Workbench_1.3.3_x64-setup.exe`；SHA256 `B1872F8E2163EA31C82EC73D907456387A17DB66B266CC3C2F6E63CC1CF70347`；注册表 1.3.3。
- 点验：设置六栏入口与原有控件在；技能搜索/收藏/新增/选用在，复制/+追加/替换不在（已随回退移除）；工作流可进画布，运行先提示选原图。
- 回滚：1.3.2 安装包 + `backups\20261117-1.3.3-a`。

## 1.3.2 原型整文件替换收口（2026-11-17）

- 技能库/设置用 `Copy-Item` 从 `src/studio/modules/ported/` 覆盖正式文件，只改导入、类型、数据适配；`node scripts/verify-provenance.mjs`：设置 95.73%、技能 99.87%（阈值 95%）。
- 设置接真实 store：DPAPI 落盘、真实 `/models`、`?apiUrl=`/`.ppconfig`、MCP/更新/备份/数据目录、未保存拦截、推荐「含返利」。
- 版本 1.3.2；安装包 `PanPan Workbench_1.3.2_x64-setup.exe`，SHA256 `6E87E23F28CC3A0C5394099E8170F39C75D747C5B8EAB00A54C2F414296EFDE4`。
- 门禁：`gate:dev` 通过（1138 单测、provenance、SAST、release-check 1.3.2）；E2E 63/66，3 条遗留为布局断言（见 STATUS）。
- 安装：覆盖安装后注册表 1.3.2；实机打开技能库（27 条、2 列、三动作）与设置（五栏、API 三步、含返利、未保存拦截）。
- 回滚：1.3.1 安装包 + `backups\20261117-1.3.2-a`。

## 1.3.1 三页像素级对齐收口（2026-11-16）

- 范围：S0 侧栏入口 → S1 技能库原型整文件接入 → S2 设置 820×660 外壳与能力挂载 → S3 工作流回归 → S4 门禁/构建/安装。
- 提交：`55057fb`（S0+S1 技能库）、`460b879`（S2 设置）、S4 文档与版本。
- 门禁：`gate:dev` 通过（1138 单测、SAST、release-check 1.3.1）；`npm run e2e` 66 条全过（含新增 S0 与三页冒烟）。
- 安装包：`PanPan Workbench_1.3.1_x64-setup.exe`（12.52 MiB）；SHA256 见 STATUS；本地 `--config` 关闭 updater 产物，仓库 `tauri.conf.json` 保持 `createUpdaterArtifacts: true`。
- 安装：覆盖安装到 `E:\02-RUANJIAN\67-盼盼工作台\PanPan Workbench`；注册表 `1.3.1`；安装前双备份 `backups\20261116-1.3.1-a/b`。
- 实机：技能库 27 条/2 列/三动作；设置五栏 820×660；工作流大厅 → 无损放大画布 → 真实出图并新增历史第 2 条。
- 审查：方案预审两轮（第一轮 REJECT，修订后 APPROVE）；S0+S1、S2 阶段复审 APPROVE。
- 已知限制：1024 宽工作流页三栏偏窄；技能多选变量仍为单选；自定义副本仅会话内；取消后已排队任务仍执行。
- 回滚：`PanPan Workbench_1.3.0_x64-setup.exe` + `backups\20261116-1.3.1-*`。

## 1.3.0 三模块迁移收口（2026-11-16）

- 范围：P1 工作流大厅 → P2 真实 ComfyUI 画布 → P3 技能库 → P4 设置五栏/API 三步/未保存拦截 → P5 侧栏分类抽屉 → P6 门禁与安装。
- 提交：`136e703`（大厅）、`c5d5859`（画布真实通道）、`dc175ad`（技能库）、`60813a2`+`8b69005`+`c9b9c5d`（设置三次提交）、`ac8ff75`（侧栏）。
- 门禁：`npm run gate:dev` 通过（1138 单测、SAST、release-check）；`npm run e2e` 65 条全过（`audit-interactions` 的设置断言已改为未保存拦截）。
- 安装包：`PanPan Workbench_1.3.0_x64-setup.exe`（12.52 MiB）；SHA256 `7A7F88D3EFF4E9DD37455166C76FCFA16F9CCB894E1291EE7B80472B1CEDFF58`；构建用 `--config` 临时关闭 updater 产物，仓库 `tauri.conf.json` 仍为 `createUpdaterArtifacts: true`。
- 安装：覆盖安装到 `E:\02-RUANJIAN\67-盼盼工作台\PanPan Workbench`；注册表仍为 `1.3.0`（未提版本）。
- 实机验证：工作流大厅 4 张真实卡 → 画布真实节点 → 无损放大真实出图并归档；技能库 27 条分类计数；设置五栏、API 三步、推荐折叠、未保存底栏均可见。
- 审查：P1/P2/P3/P5 `APPROVE`；P4 第一轮 `REJECT`（外部 setSettings 会清空未保存草稿），已加入脏草稿保护后复审通过。
- 已知限制：1024 宽工作流页三栏偏窄；自定义副本/导入预设仅会话内；画布比例档位不参与真实图参数；取消后已排队任务仍会执行。
- 回滚：`PanPan Workbench_1.2.1_x64-setup.exe` + 既有 `backups\20261112-1.2.1-*` 数据备份。
- 报告：`STATUS-20261116-MIGRATION.md`；映射：`P2-MAPPING-20261116.md`。

## 1.2.1 收口（2026-11-12）

- 版本：`1.2.1`；安装路径 `E:\02-RUANJIAN\67-盼盼工作台\PanPan Workbench`；注册表 `DisplayVersion=1.2.1`。
- 安装包：`PanPan Workbench_1.2.1_x64-setup.exe`；SHA256 `6DFBA7588B3D5F874024ABC356B9B9F42640ABBC3DFF7FFCEE3766648AE6BDEB`。
- 数据：安装前/后 18 任务 / 19 图片；`quick_check=ok`；双备份 `backups\20261112-1.2.1-a`、`-b`。
- 门禁：`gate:dev`、62 条 E2E、1129 单测、107 Rust、SAST、签名构建全部通过。
- 审查：两轮 `REJECT`（1024 右侧停靠遮挡、自定义尺寸弹窗指针事件），修复后最终 `APPROVE`。
- 公开发布：公开库 `panpan-workbench` `v1.2.1`，快照提交 `31bbcd1`；Release 资产为本地已验证安装包（SHA `6DFBA7588B3D5F874024ABC356B9B9F42640ABBC3DFF7FFCEE3766648AE6BDEB`）、`.sig`、`latest.json`。公开库 `windows` job 因缺少签名 Secret 跳过，采用手动上传。
- 覆盖：N55–N57 完成；N52 仍 🟡；M2/M3/M4 无凭据 known-limit。
- 报告：`REPORT-1.2.1.md`；门禁：`GATES-1.2.1.json`；证据：`r9-input-*.png`、`r9-skill-picker-1440/1024.png`、`r9-right-dock-1024.png`、`r9-installed-2560.png`。
- 回滚：1.2.0 安装包 + 双备份 data/app。

<!-- WORKFLOW_STATE_START -->
{
  "batch": "1.2.1-R9",
  "stage": "release",
  "phase": "done",
  "plan": "docs/execution/PLAN-ALL-REMAINING-20261110.md",
  "planHash": "D7154F8E29A29DAFD1FB1FBB24E245CA4042829D48B0A70C56DAF8D27A1F29D8",
  "gate": "green: 1.2.1 installed; data 18/19; quick_check ok; 1129 unit / 62 e2e / 107 rust",
  "review": "CODE_REVIEW=APPROVE (final delta after 2 blockers fixed)",
  "next": "仅 M2/M3/M4 live 验证（需真实 Key/中转站）"
}
<!-- WORKFLOW_STATE_END -->

## 1.2.0 收口（2026-11-12）

- 版本：`1.2.0`；安装路径 `E:\02-RUANJIAN\67-盼盼工作台\PanPan Workbench`；注册表 `DisplayVersion=1.2.0`。
- 安装包：`PanPan Workbench_1.2.0_x64-setup.exe`；SHA256 `72058841DBDF1EEC24FEF6E80ADAA40FD9236F73CE875A0466C926AEB9C9B403`。
- 数据：安装前/后 17 任务 / 18 图片；`quick_check=ok`；双备份 `backups\20261112-1.2.0-a`、`-b`。
- 门禁：`gate:dev`、58 条 E2E、1129 单测、107 Rust、SAST、签名构建全部通过。
- 审查：R1–R2 四轮、R3–R6 三轮，最终 `APPROVE`；R7 补按钮扫描/交互 E2E 后进入 U2。
- 覆盖：N32–N54 完成；M2/M3/M4 无凭据 known-limit。
- 报告：`REPORT-1.2.0.md`；门禁：`GATES-1.2.0.json`；按钮契约：`BUTTON-CONTRACT.md`；交互矩阵：`INTERACTION-MATRIX.md`。
- 回滚：1.1.0 安装包 + 双备份 data/app。

## 1.1.0 收口（2026-11-11）

- 版本：`1.1.0`；安装路径 `E:\02-RUANJIAN\67-盼盼工作台\PanPan Workbench`；注册表 `DisplayVersion=1.1.0`。
- 安装包：`PanPan Workbench_1.1.0_x64-setup.exe`；SHA256 `AE6B0620736B384560571DD119CFA206F6B0953920B09CF8E42CA9B2D910B581`。
- 数据：安装前/后 12 任务 / 15 图片；`quick_check=ok`；双备份 `backups\20261111-1.1.0-a`、`20261111-1.1.0-b`。
- 门禁：`gate:dev`、22 条 E2E、1099 单测、105 Rust、签名构建全部通过。
- 审查：独立审查窗口第一轮 `REJECT`（2 个数据语义阻塞），开发窗口修复后第二轮 `APPROVE`。
- 覆盖：N15–N31 完成；M2/M3/M4 代码与 mock/E2E 完成，真实 Key live 仍为 known-limit。
- 已知限制：Gemini/2K/4K 未 live；SVG 为位图包装；GIF 主线程量化无进度；迁移不保留 pinned/usageCount/author/sourceTaskId。
- 报告：`REPORT-1.1.0.md`；门禁：`GATES-1.1.0.json`；UI 分析：`UI-MIGRATION-ANALYSIS-20261111.md`。
- 回滚：安装包回退 1.0.8 + 双备份 data/app。

<!-- WORKFLOW_STATE_START -->
{
  "batch": "1.2.0-R1-R8",
  "stage": "release",
  "phase": "done",
  "plan": "docs/execution/PLAN-ALL-REMAINING-20261110.md",
  "planHash": "42527CE359B8B67B119A5ED5E17E7AF47796564B877DFA2F55D99255161DE7B4",
  "gate": "green: 1.2.0 installed; data 17/18; quick_check ok; 1129 unit / 58 e2e / 107 rust",
  "review": "CODE_REVIEW=APPROVE (R1-R2, R3-R6); R7 evidence closed before U2",
  "next": "仅 M2/M3/M4 live 验证（无凭据 known-limit）"
}
<!-- WORKFLOW_STATE_END -->
- 历史总方案：`docs/execution/PLAN-B02.md`，SHA256 `D167732252396120F0EA32F60EAEEA67B0024AC8647F99CD40CF800FBF10E679`
- 历史清单：`docs/execution/B02-CHECKLIST.md`，无 `[ ]`/`[~]`

<!-- WORKFLOW_STATE_START -->
{
  "batch": "B04B",
  "stage": "S4",
  "phase": "done",
  "plan": "docs/execution/PLAN-B04B.md",
  "planHash": "A7687CFB02862C694A4E6E7EBA91712C9DBD80ACBFC0F6365FC5DAE1DD4ADFE8",
  "gate": "green: 1.0.3 installed; data 12/15; quick_check ok; 1085 unit / 11 e2e / 105 rust",
  "review": "ARCH_REVIEW=APPROVE; PLAN_REVIEW=APPROVE; injections red then restored",
  "next": "B05"
}
<!-- WORKFLOW_STATE_END -->

## B04B 收口（2026-11-10）

- 版本：`1.0.3`；安装路径 `E:\02-RUANJIAN\67-盼盼工作台\PanPan Workbench`；注册表与 exe 均为 `1.0.3`。
- 安装包：`PanPan Workbench_1.0.3_x64-setup.exe`，10,530,675 B，SHA256 `A3DA499B1FF8BF41C2955F228FAF131C6D46D33549FCBE8A23888213A729B14B`；`.sig` 448 B，SHA256 `0A71F9D3B538D154C95FB6B3A5C129161D76A5C080BE3F35064321764E2AA636`。
- 数据：安装前/后 12 任务 / 15 图片；`quick_check=ok`；备份 `E:\02-RUANJIAN\67-盼盼工作台\backups\b04b-pre-install-20261110`。
- 门禁：1085 单测、11 E2E、105 Rust；`gate:dev` 与签名构建通过。
- 安装版：技能选择器加载 27 条技能；版本 1.0.3；数据不变。
- 失败注入：统一清空失效与技能合并跳过均使 E2E 变红，恢复后绿。
- 证据：`docs/execution/evidence/b04b-installed-skill-picker.png`、`b04b-failure-injection.log`。
- 报告：`docs/execution/REPORT-B04B.md`；门禁：`docs/execution/GATES-B04B.json`。
- 下一批：`B05`（技能内容精修、封面、Round 2 意见）。

## B04A 收口（2026-11-10）

- 版本：`1.0.2`；安装路径 `E:\02-RUANJIAN\67-盼盼工作台\PanPan Workbench`；注册表与 exe 均为 `1.0.2`。
- 安装包：`PanPan Workbench_1.0.2_x64-setup.exe`，10,513,977 B，SHA256 `8A3C2B6E840A1B8A4CA68007F5CAD0B3888B9853A89298A9C53F27400A05382A`；`.sig` 448 B，SHA256 `76FEAB92564E3C6D72F0E3AF0DEE577645879917E884A93A7F5F5DDAD610922A`。
- 数据：安装前 12 任务 / 16 图片；安装后 12 任务 / 15 图片；`quick_check=ok`。少 1 张为无任务引用的孤儿图，12 个任务完整。
- 备份：`E:\02-RUANJIAN\67-盼盼工作台\backups\b04a-pre-install-20261110`（data + app + 1.0.1 安装包 + `.sig`）。
- 门禁：1086 单测、9 E2E、105 Rust；`gate:dev` 与签名构建通过。
- 安装版验证：详情单图真实保存（1,998,545 B）；批量下载一次目录框落盘 2 个文件；取消保存无错误提示；U6 空白点击 + Delete 不弹删除框；工作流路线图页正常；界面无 Lovart。
- 失败注入：U6/Workflow 故意破坏后 E2E 变红、恢复后变绿；1.0.2 → 1.0.1 → 1.0.2 回滚循环数据一致。
- 证据：`docs/execution/evidence/b04a-installed-workflow.png`、`b04a-installed-projects.png`、`b04a-failure-injection.log`。
- 报告：`docs/execution/REPORT-B04A.md`；门禁：`docs/execution/GATES-B04A.json`。
- 下一批：`B04B`（1.0.3 底座与技能），先完成 DoR 与冻结。

## B03 收口（2026-11-10）

- 版本：`1.0.1`；安装路径 `E:\02-RUANJIAN\67-盼盼工作台\PanPan Workbench`；注册表 `DisplayVersion=1.0.1`。
- 安装包：`PanPan Workbench_1.0.1_x64-setup.exe`，10,526,164 B，SHA256 `4B2708F0008013D64839FDF995F517C127F53FCDE77DAE752438F991AC964403`；`.sig` 已生成。
- 数据：安装前/后均 12 任务 / 15 图片；`PRAGMA quick_check=ok`；备份 `E:\02-RUANJIAN\67-盼盼工作台\backups\b03-pre-install-20261110`（data + app）。
- 门禁：1077 单测、7 E2E、105 Rust；签名构建与静默安装通过。
- Lovart：安装版 27 条可加载，`space.commercial-photo` 可打开。
- 回滚：`backups\b03-pre-install-20261110\app` + `data`；1.0.0 安装包 SHA256 `49DD2D3A3A0E31B996248A1B5BAEB00DF09FD9FBF298540391706CC01626EB98`。

## 自动化门禁（2026-11-10）

- 本地：`npm run gate:dev`（构建 + 1077 单测 + 静态检查 + dist 扫描）；`npm run e2e`（7 条：参数下拉、Lovart、画布交互）；完整 `npm run gate:all`。
- 远端：`b02` push 触发 GitHub Actions；终态 run `42671302913` 全绿（E2E 6 passed / 1 skipped：Lovart 无源包自动跳过）。
- 状态：`npm run state` 读写 CHECKPOINT 的 `WORKFLOW_STATE`；`npm run review:packet` 生成审查包；`npm run hooks:install` 启用 pre-push。
- 下一批入口：意见收口 → 方案 → 预审查 → 放行，见 `WORKING-RULES.md` §2.1。

## 安装与数据（B02 历史）

> B03 起以顶部「B03 收口」为准；以下为 B02 阶段记录。

- 安装目录：`C:\Users\95720\AppData\Local\PanPan Workbench`（保持旧路径，显示名“盼盼工作台”）
- 最终候选：`PanPan Workbench_0.1.1_x64-setup.exe`
  - SHA256 `85CFB729AB7E8F3681223F161EB0BE7A594EBEC9F17C133E01E91E6A44974BFB`
  - 30,200,732 字节
  - 安装 exe SHA256 `B77E88154DA9DEE895A389E400760E6DF2F0B31F6747E4C4D6D0892F587569B9`
- 真实数据：14 任务（10 完成 / 4 失败）、1 项目、2 画布、22 图片；Key 已 DPAPI 加密；`data.db/-wal/-shm` 明文 0
- 真实迁移前快照：`E:\02-RUANJIAN\67-生图工作台-backups\b02-1b-pre-real-20261107`
- B02-1A 双备份：`C:\Users\95720\Documents\PanPanBackups\b02-1-real-data-20261106`、`E:\02-RUANJIAN\67-生图工作台-backups\b02-1-real-data-20261106`

## MCP（B02-4）

- 默认关闭；设置页开关/端口/token/写入开关/客户端配置/审计
- 只读：`project.list`、`canvas.list`、`task.list`、`task.get`、`image.get`、`settings.get`
- 写入：`task.create`、`image.attach`，默认关闭，UI 确认，只使用显式 `imageIds`
- HTTP `127.0.0.1:7331` + Bearer；stdio `--mcp-stdio` 只读
- 实测：HTTP initialize/tools/list/task.list(14) 通过；stdio 6 工具/task.list(14)/写入拒绝/`data.db` 哈希不变；无 token/错 token=401，非本机 Host=403，外部 Origin=403

## 门禁与证据

- 最终：`npm run build`、77 文件 / 986 前端测试、105 Rust 测试、71 命令 ACL、release-check、`tauri:build` 全部通过
- 门禁：`GATES-B02-1B.json`、`GATES-B02-2.json`、`GATES-B02-3.json`、`GATES-B02-4.json`
- 报告：`REPORT-B02-1B.md`、`REPORT-B02-2.md`、`REPORT-B02-3.md`、`REPORT-B02-4.md`

## B02-UI-FIX

- 7 项 UI/交互修复已完成：拖拽入口去重与遮罩复位、三按钮占位、左上角回退、缩放/视图位置统一、全局放大与界面缩放 100/110/125/150、参考图落画布、生图后输入不变。
- 门禁：`npm run build`、84 文件 / 1021 前端测试、105 Rust 测试、`npm run tauri:build` 通过。
- 复审修复：删除快照/导出包含画布图片节点；所有加图路径统一 pending；`submitTask` 统一阻止缺失素材（MCP 复用）。
- 发布部分：updater 前端入口与 `update_check`、签名产物与 `latest.json`、README/SECURITY/LICENSE/CI/第三方许可已补齐。
- v1.0.0 第一批：生成状态/比例、蓝色光效、@ 编号、下载、默认删除、尺寸、共享工具栏、About/齿轮、版本与字体打包、低成本优化；旧画廊因收藏夹集合未覆盖而保留。
- 候选 SHA256 `F0D22C5C9D13F0F85391DD30479060E5B05412BEC4C775E271266F04A1580CAA`（30,237,718 字节，未安装）。
- 证据：`REPORT-B02-UI.md`、`GATES-B02-UI.json`。

## FINAL（2026-11-07 收尾批次）

- 方案：`PLAN-FINALIZE.md`；筛查：`AUDIT-FINAL.md`；门禁：`GATES-FINAL.json`
- 提交：`cfa108f`（点阵特效接入 + 旧布局开关收起）
- 最终候选：`PanPan Workbench_1.0.0_x64-setup.exe`（30,211,348 B，SHA256 `B770BC5A0BB9C548110DAF96179AE43D0F36BE20147FDA9E5905D2943BFD9C68`）
- 已覆盖安装到本机：exe `2026-11-07 22:52:38`，SHA256 `695CFEE6…D06039`；数据 15 任务 / 20 图片不变
- 门禁：`tsc`、`npm run build`、84 文件 / 1021 用例、105 Rust 用例、72 命令 ACL、`release-check`、`tauri:build`（含 updater 签名）全通过
- 待办：GitHub 仓库/Release/更新地址（等用户明确指令）；技能库进 ZIP；错误分类提示；960 窄窗与 DPI 逐项截图

## Known limits（压缩范围）

- UI 字号/留白/密度/无障碍细节、8K、开机启动、多语言、完整撤销重做、历史收藏回接等按压缩方案不做
- 删除快照恢复/ErrorBoundary/磁盘提示未做真实点击 U2，仅自动化测试
- 拖入/拾取/@/IME/手动队列未逐项真实点击，自动化测试通过
- 托盘“退出”菜单未实机点击；关闭隐藏与托盘唤起已实测
- 窗口位置不持久化，每次居中
- 真实库 Key 已加密，回退 B02-1A 需先还原迁移前快照

## 回滚点

- 代码：B02-1A 收口 `8f83c20`；各阶段提交见 git log
- 数据：`b02-1b-pre-real-20261107` 或 B02-1A 双备份

## 2026-11-14 · 1.3.0-W2

- 改动：工作流板块改为三节点画布（素材/生成/结果）；引擎由客户端子进程自动拉起；新增 engine 权限
- 版本：1.3.0（package / lock / sw / Cargo / RELEASE 六处同步）
- 门禁：
pm run gate:dev 通过（构建 + 1129 单测 + SAST + release-check）
- 安装：PanPan Workbench_1.3.0_x64-setup.exe，覆盖安装退出码 0，数据保留
- 实机：进入工作流页 12 秒内引擎端口就绪；界面显示已连接；同一 API 图出图成功
- 审查：CODE_REVIEW=REJECT（阻塞项 createUpdaterArtifacts），已恢复为 true 并复跑 release-check 通过
- 已知限制：另外 5 条工作流未接生成链路；素材节点暂只支持单图；无画布批量队列
- 回滚：重装 1.2.1；引擎目录 D:\AI\ComfyUI 删除即卸载
## 2026-11-16 · 四条工作流跑通

- 保留：无损放大 / 抠图 / 精修 / 截图转效果图；其余六条下线
- 模型：补齐 RealESRGAN_x4plus、birefnet-general
- 实跑：四条全部出图；结构校验全通过
- 修复：COMBO 枚举解析、上传重名覆盖、seed=0 随机、对比图 URL 回收、缩放胶囊对齐
- 审查：CODE_REVIEW=APPROVE，无阻塞；5 条非阻塞已修 4 条
- 安装：1.3.0 覆盖安装成功
- 未完成：项目树、设置向导、队列取消
## 2026-11-16 · 项目工作流

- 工作流按项目分组，参数与运行结果按条目保存
- 审查 REJECT→修复→APPROVE
- E2E 62 全过，1.3.0 覆盖安装
- 未完成：设置三步向导
## 2026-11-16 · 设置三步向导

- 添加 API 配置：选来源 → 粘密钥 → 选模型；推荐服务商标含返利并隔离
- 审查 REJECT（密钥外发）→ 修复 → APPROVE
- 修复 hooks 顺序导致设置弹窗崩溃
- E2E 62 全过，1.3.0 安装


## 1.8.0-LAUNCH S7（2026-11-18）

- 状态：本地完成，等待发布授权；未 push / tag / Release
- 最终报告：`REPORT-1.8.0-LAUNCH-S7.md`；门禁：`GATES-1.8.0-LAUNCH-S7.json`
- 安装包：`PanPan Workbench_1.8.0_x64-setup.exe`，SHA256 `8E70801C7B768EC8FAD8DBA5F78645C741EC6DF1F0AEF7F0F6430D66161E51AF`，`.sig` 448 B，`latest.json` 1.8.0
- 数据：真实安装 1.8.0，升级前备份 `E:\02-RUANJIAN\67-盼盼工作台\backups\20261118-1.7.0-pre-1.8.0`，数据库 SHA `B16F4F0B2A73368E132024C515D41319075B15A5B15981EB2D5864A72522BC60`
- U2 证据：`evidence/s7-u2-workflow-after.png`、`s7-u2-workflow-result.png`、`s7-backup-export.png`、`s7-backup-restore.png`、`s7-reinstall-restore.png`
- known-limit 证据：`evidence/s7-export-known-limit.png`（真实数据导出备份被缺图工作流阻断）
