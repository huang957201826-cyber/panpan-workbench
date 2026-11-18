# PLAN-B03 — 交付安装批

- 版本：v1.0.1（候选）
- 日期：2026-11-10
- 目标：把下一批 P0 收口成可安装版本，装到本机并验证数据不丢。
- 依据：`LEDGER.md` 下一批意见收口（N-01–N-32）；`WORKING-RULES.md` v2。
- 原则：数据安全 > 可回滚 > 可验证 > 功能完整；不重建架构，不扩大范围。

## 1. 范围

### 做

- S1 制度执法：pre-push 门禁、`CHECKPOINT` 机器可读状态块、审查输入包生成器。
- S2 应用修复：错误分类提示；侧栏「工作流」占位页替换为「Lovart 技能」。
- S3 Lovart 技能包：构建时只读快照、MANIFEST 索引、27 条技能列表、表单、提示词注入、交付规格确认。
- S4 验收：下拉 E2E + Lovart E2E + 画布基础交互 E2E；完整门禁；**只构建签名候选，不安装、不启动真实安装版**。
- S5 发布安装：1.0.1 版本号、关闭应用、备份真实数据与当前应用目录、签名安装包、覆盖安装、启动与数据核对。

### 不做（本批）

- 全局 OpenCode `workflow-gate` 插件（N-04）：不在无人值守时改全局插件/权限；用 pre-push + 状态块 + 审查包替代，下一批再做。
- 干净虚拟机安装/卸载（N-22）：本机无独立虚拟机，记 known-limit。
- 真实 API 出图 E2E（N-23）：不在夜间消耗真实额度，使用 mock provider。
- 公开发布仓/Release（N-24 的公开部分）：本批只做本机安装；版本纪律按 patch 执行。
- Authenticode、8K、多语言、完整撤销重做、store 拆分（N-25–N-29）。
- P1/P2 产品缺口（N-08–N-19、N-31、N-32）。

## 2. 冻结决策

1. Lovart 技能包**不改源目录**；源路径用 `LOVART_SKILL_KIT` 环境变量，默认 `%USERPROFILE%\lovart-skill-kit`。构建前用 `scripts/sync-lovart-kit.mjs` 复制到 `public/lovart-skill-kit/`（gitignore，不入公开仓）；不把绝对路径写进提交物或日志。
2. 前端用 `fetch('./lovart-skill-kit/...')` 读取快照；不新增 Rust 命令、不改 Tauri 权限。
3. 源包缺失时构建不失败，UI 显示“未找到技能包”；本机有源包时必须加载 27 条。
4. 版本号升 `1.0.1`；不覆盖 1.0.0 的同号资产。
5. 安装前必须备份 `E:\02-RUANJIAN\67-盼盼工作台\PanPan Workbench\data`，安装后核对任务/图片数。

## 3. 阶段与验收

### S1 制度执法

- `scripts/workflow-state.mjs`：读写 `CHECKPOINT.md` 中 `<!-- WORKFLOW_STATE -->` JSON 块；支持 `get/set`。
- `scripts/review-packet.mjs`：汇总 PLAN/CHECKLIST/`git diff --stat`/gate 结果/证据路径到 `docs/execution/REVIEW-PACKET.md`。
- `.githooks/pre-push`：执行 `npm run gate:dev`；失败退出 1。`scripts/install-hooks.mjs` 设置 `core.hooksPath`。
- 验收：`node scripts/workflow-state.mjs get` 输出合法 JSON；`node scripts/review-packet.mjs` 生成文件；`node .githooks/pre-push` 通过；`gate:dev` 通过。

### S2 应用修复

- `src/lib/apiErrorClassification.ts`：超时/无 Key/余额不足/限流/鉴权/网络/服务端/未知分类；`CanvasTaskNode` 与任务详情显示标题 + 建议。
- 单测覆盖各分类与未知兜底。
- 侧栏 `workflow` 入口替换为 `lovart`；移除“工作流规划中”占位页；`ActiveActivity` 加 `lovart`。
- 验收：`npm test` 通过；E2E 断言侧栏不再出现“工作流”、出现“Lovart 技能”。

### S3 Lovart 技能包

- `scripts/sync-lovart-kit.mjs`：只读复制源包到 `public/lovart-skill-kit/`；`predev`/`prebuild` 触发。
- `src/lib/lovartSkills.ts`：`loadLovartKit()` 读取 MANIFEST + 27 个 `skill.json`/`prompt.md`；`composeLovartPrompt()`；`validateLovartInputs()`；`parseOutputSpec()`。
- `src/studio/components/LovartSkillLibraryView.tsx`：分类/搜索/优先级筛选；技能详情；表单支持 image/enum/text/number/multi/bool；必填校验；交付规格确认；一键填入输入台（提示词、参数、参考图）。
- `onUsed` 回项目页；不自动提交生成。
- 单测：27 条全部可加载、必填校验、提示词注入、输出规格解析。
- E2E：打开 Lovart、选 `space.commercial-photo`、填必填项、确认交付规格、填入输入台，断言提示词包含技能名且参考图槽位出现。
- 验收：`gate:dev` + `e2e` 通过。

### S4 验收

- **先升版本到 1.0.1**：`package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`public/sw.js`、`RELEASE.md`；后续门禁在 1.0.1 状态下跑。
- 固定 1.0.0 回滚包：`src-tauri\target\release\bundle\nsis\PanPan Workbench_1.0.0_x64-setup.exe`，10,448,444 B，SHA256 `49DD2D3A3A0E31B996248A1B5BAEB00DF09FD9FBF298540391706CC01626EB98`，`.sig` 存在；写入 `GATES-B03.json`。
- 画布 E2E：画布/九宫格切换、滚轮缩放锚点、空格/中键平移、适应全部；有任务时验证节点拖动不跳动（mock API 生成一张图）。
- 完整门禁：`npm run gate:dev`、`npm run e2e`、`cargo test`。
- 构建前签名环境：读取 `%TEMP%\panpan-updater.key` 与 `%TEMP%\panpan-updater.password`；密码用 `Trim([char]0xFEFF)` 去 BOM 并去 CR/LF；只进环境变量，不回显、不写入日志；先确认两者可读。
- **只构建一次** `npm run tauri:build`；构建后校验 `.sig` 与 SHA256，记录到 `GATES-B03.json`；构建失败即停，不进入 S5。
- 安装包结构检查：NSIS 存在、版本 1.0.1、`.sig` 存在；**S4 不安装、不启动真实安装版**。

### S5 发布安装

- 复核 1.0.1 已同步（S4 完成）；只复核，不再改版本。
- **先关闭应用**并确认进程消失；把真实数据 `E:\02-RUANJIAN\67-盼盼工作台\PanPan Workbench\data` 复制到 `E:\02-RUANJIAN\67-盼盼工作台\backups\b03-pre-install-20261110\data`。
- 复制整个应用目录（`gpt-image-playground.exe`、`uninstall.exe`、`bin\`、`skills\`，不含 data）到同目录 `app\`，作为应用回滚点。
- 对备份副本做 `PRAGMA quick_check`，核对 tasks/images 数量与 pre 值；备份或校验失败即停，不安装。
- 静默安装 `/S`（`currentUser`）。
- 启动安装版，核对：注册表 `DisplayVersion=1.0.1`、进程存在、data 任务/图片数 pre/post 一致、Lovart 页 27 条可加载且 `space.commercial-photo` 可打开、截图存 `docs/execution/evidence/`。
- 更新 `CHECKPOINT.md` / `GATES-B03.json` / 最终报告。

## 4. 阻塞定义

只把以下当阻塞，其余记 known-limit：

- 丢数据/损坏 `data.db` 或图片；
- 泄漏 API Key/token/敏感路径；
- 构建、安装、启动、MCP 不可用。

## 5. 已知限制（本批）

- 全局 `workflow-gate` 插件未做；pre-push 只拦本机 push，不拦绕过 hook 的操作。
- 打包版只做启动/数据冒烟，不做 WebView2 逐控件点击；`tauri-driver` 下一批。
- 干净虚拟机、卸载重装未实测。
- Lovart 是构建时快照；源包更新后需重新构建。
- 真实 API 出图未在本批消耗额度。

## 6. 回滚

- 代码：本批提交；安装前记录 `git rev-parse HEAD`。
- 数据：`b03-pre-install-20261110\data` 整目录备份，附 `quick_check` 与 tasks/images 计数。
- 应用：`b03-pre-install-20261110\app`（当前 1.0.0 的 `gpt-image-playground.exe`、`uninstall.exe`、`bin\`、`skills\`）；失败时回拷，**不重建同号 1.0.0**。
- 安装包：不重建 1.0.0；如必须重装，使用执行前已校验 SHA256 的 1.0.0 安装包，路径与 SHA 写入 `GATES-B03.json`。
- 版本：1.0.1 失败则代码回退到本批前提交；已安装 1.0.0 的数据保留，不反向迁移。
