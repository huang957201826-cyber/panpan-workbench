# STATUS · 2026-11-16 · 三页像素级对齐（1.3.1）

## 结论

工作流、技能库、设置三页按 `OPINIONS-20261116.md` 与 `PIXEL-PARITY-PLAN-20261116.md` 完成对齐，1.3.1 已覆盖安装并实机验证。技能库从原型 `SkillHubView.tsx` 整文件复制接入；设置按原型外壳（820×660、180px 左栏、五栏、黑白控件）重排，现有能力逻辑未动。

## 交付

| 阶段 | 结果 |
|---|---|
| S0 入口 | 点「工作流」进大厅、点「技能库」进技能库；新增 E2E 锁定 |
| S1 技能库 | 原型整文件复制；27 条技能、2 列纯文卡、指令正文 `{变量}` 高亮、复制/+追加/替换；8 类与收藏计数与侧栏共用 store |
| S2 设置 | 820×660、180px 左栏、五栏、黑白控件；API 三步、推荐默认折叠标「含返利」、底部未保存拦截；DPAPI/导入导出/MCP/更新/备份/数据目录保留 |
| S3 工作流 | 入口回归；大厅 2 列对比卡；画布真实节点；实机无损放大出图并新增历史 |
| S4 收口 | `gate:dev`、66 条 E2E、构建、覆盖安装、三页对照截图 |

## 复制与适配边界

- `src/studio/modules/skills/SkillHubView.tsx`：源自原型同名文件；改动点均标 `PARITY-ADAPTER`（类型导入、数据源、分类派生、2 列、纯文正文、三动作）。
- `src/components/SettingsModal.tsx`：外壳尺寸/左栏/栏序/控件按原型；内层能力组件与逻辑保持原状。原型里的假测连、`D:/` 路径、价格与延迟未采用。
- 广告：特惠 API `https://api.tehui.xyz/v1`，注册 `https://api.tehui.xyz/sign-up?aff=rf9W`，预置模型 `gpt-image-2.5`，标「含返利」，只生成空密钥配置。

## 门禁与安装

- `npm run gate:dev`：通过（构建 + 1138 单测 + SAST + release-check 1.3.1）
- `npm run e2e`：66 条全过
- 安装包：`PanPan Workbench_1.3.1_x64-setup.exe`（12.52 MiB）
- SHA256：`875272F860C949A5A8327C25DBCF6984E2F28E227CFDAF7F5BCDEDBB915B82E8`
- 覆盖安装：`E:\02-RUANJIAN\67-盼盼工作台\PanPan Workbench`，注册表 `1.3.1`
- 数据：安装前双备份 `backups\20261116-1.3.1-a`、`-b`（AppData + 安装 data）

## 对照截图

- 视口 1440×900，DPR 100%，浅色；原型与本地同视口。
- `docs/execution/evidence/parity-workflow-light-proto.jpg` / `parity-workflow-light-local.jpg`
- `docs/execution/evidence/parity-skills-light-proto.jpg` / `parity-skills-light-local.jpg`
- `docs/execution/evidence/parity-settings-light-proto.jpg` / `parity-settings-light-local.jpg`

## 已知限制

1. 1024 宽下工作流页为 rail + 分类抽屉 + 工作流侧栏三栏，大厅偏窄。
2. 技能 `multi` 变量在原型里也是单选，未补多选控件。
3. 自定义工作流副本/导入预设仅当前会话有效。
4. 取消运行后，已提交到 ComfyUI 队列的任务仍会执行。
5. 设置的原型外壳为 660 宽/170 左栏，本版按意见第 16 条取 820×660/180。
6. `public/skill-kit/` 仍按仓库约定由构建前同步，不入 git。
7. 本轮只做本地覆盖安装，未生成 `.sig`、未 push、未打 tag；应用内更新需下次带签名密钥构建。
8. 来源校验：`docs/execution/provenance.json` 登记技能库为 adapted（非逐行一致），脚本 `node scripts/verify-provenance.mjs` 已通过。

## 回滚

- 安装包：`PanPan Workbench_1.3.0_x64-setup.exe`
- 数据：`backups\20261116-1.3.1-a` / `-b`
