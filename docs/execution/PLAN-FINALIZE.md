# 收尾方案（FINALIZE）— 接手 B02 之后的未完成工作

- 日期：2026-11-07
- 分支：`b02`，HEAD `84c003d`（feat(skills): 技能库 V1 与模型筛选）
- 规则：仍按 `WORKING-RULES.md`，本文件是收尾批次唯一方案，不再拆子方案
- 结论先行：`B02-CHECKLIST.md` 的 83 项已全部 `[x]/[-]`，**功能层基本完成**；真正没收尾的是四块 ——
  **A 在途代码**、**C 发布工程（硬阻塞）**、**D 安装态验证**、**E 文档台账**；B 是旧画廊口径未落地。

## 0. 核实过的事实（本次实测，非回忆）

| 项 | 现状 |
|---|---|
| 工作区 | 未提交：`CanvasBoard.tsx` +1 行、新增 `src/components/InteractiveDotGrid.tsx`（247 行） |
| InteractiveDotGrid | 全仓只在 `CanvasBoard.tsx:15` 被 import，**从未被渲染** → 写了没接上 |
| 类型检查 | `npx tsc -b` 通过 |
| 前端测试 | `npm test` 84 文件 / 1021 用例全绿（2026-11-07 22:14 实跑） |
| 候选安装包 | `PanPan Workbench_1.0.0_x64-setup.exe` 30,237,718 B，SHA256 `F0D22C5C…A1580CAA`（22:03 构建） |
| 更新清单 | `.sig` 与 `latest.json` 内签名**逐字一致**，`pub_date` 22:04 与构建时间吻合 |
| 已安装客户端 | 版本 1.0.0，exe 时间 21:35 → **比候选早一轮**；应用正在运行（PID 37684，21:44 启动） |
| Git 远端 | **无 remote、无 `v1.0.0` tag** → GitHub 仓库与 Release 完全没做 |
| 更新地址 | `tauri.conf.json` 指向 `github.com/panpan-workbench/panpan-workbench/...`，该仓库不存在 → 应用内检查更新必 404 |
| CI | 仅 `.github/workflows/build.yml` 生效，触发分支写的是 `main`；本地分支是 `b02/master` → 推上去不触发 |
| 发布工作流 | `tauri-release/deploy/docker/vercel-tag-deploy` 全部是 `.disabled` |
| 仓库内容 | 540 个跟踪文件；`docs/execution` 38 个被跟踪；`evidence/` 3 张真实用户项目截图在历史提交 `f9e1b32` 内 |
| 真实路径 | `GATES-B02-*.json` 含 `C:\Users\95720\...` |
| 旧画廊 | `studioShellEnabled` 开关 + `App.tsx:250` 分支 + `TaskGrid/Header/InputBar/FavoriteCollections` 仍在；设置页文案自认「收藏夹集合管理仍只在传统布局提供」 |
| 技能库 | `panpan-prompt-skills-v1`（Tauri kv / localStorage），**不进 ZIP 导入导出** |
| 台账 | `LEDGER.md` 63 条 REQ 全标「待做」；`MASTER-ISSUES.md` 60 条「未做」+6「部分」→ 与 B02 已完成状态脱节 |
| 10 条优化 | #7 只落了「复制错误」；超时 / 无 Key / 余额不足**没有分开提示**（`imageApiShared.ts:162` 只有 HTTP 状态分组） |

## 1. 未完成清单

### A 在途代码（P0，先收口）

- **A1** `InteractiveDotGrid` 半成品：作为画布点阵的有交互替代品（点阵靠近光标「实心化 + 弹性推开」+ 微粒子），但没渲染、没接 pan/zoom、没处理 `prefers-reduced-motion`、风格与仓库规范不符（带分号、`React.FC`、中文注释缺失、常驻 rAF）。**必须二选一：接入并补全，或删除 + 摘 import**，否则工作区不干净、候选包与实际代码不一致。

### B 功能口径未落地（P1，需决定）

- **B1** 旧画廊模式：`DECISIONS-RELEASE-V1.md §2` 写「删除旧画廊」，`REPORT-B02-UI.md` 写「因收藏夹集合管理未覆盖而保留」——**决策与实现冲突**，现在两套布局同时维护。
- **B2** 技能库不进 ZIP：换机/重装会丢自建技能。
- **B3** 错误提示未分类：无 Key / 余额不足 / 超时都落到同一条泛化错误里。

### C 发布工程（P0 硬阻塞，真正的「尾」）

- **C1** 干净公开快照：剥离 `docs/execution`（38）、`evidence/` 真实截图、`GATES` 真实路径、`release/` 二进制；历史里的真实用户图片不能只 `git rm`。
- **C2** GitHub：创建公开仓库、`main` 分支、`v1.0.0` tag；CI 触发分支从 `main` 改对。
- **C3** Release 附件：安装包 + `.sig` + `latest.json`；恢复 `tauri-release.yml`（tag 触发），否则打 tag 无产物。
- **C4** 更新地址对齐真实 owner/repo，重写 `tauri.conf.json` endpoint 与 `latest.json` 的 `url`。
- **C5** 最终候选重建：现有 1.0.0 包不含未提交改动；重建后 SHA 变化，需同步 `GATES-B02-UI.json`、`CHECKPOINT.md`、`release/` 目录。

### D 安装态与 U2（P1）

- **D1** 覆盖安装：21:35 安装版 → 新候选，验证数据/Key/任务数一致（真实数据 14 任务须先备份）。
- **D2** 干净安装 + 卸载两态（默认保留 data / 勾选删 data）。
- **D3** 960 窄窗 + 125%/150% DPI + 界面缩放 100/110/125/150 逐项截图。
- **D4** 手工点击回归：画布右键/拖动/缩放、删除快照恢复、@ mention IME、托盘「退出」、自动更新端到端（依赖 C2 先完成）。

### E 文档台账（P2）

- **E1** `LEDGER.md` / `MASTER-ISSUES.md` 状态回填（63 + 66 条）。
- **E2** `CHECKPOINT.md` / `REPORT-B02-UI.md` / `GATES-B02-UI.json` 终稿。
- **E3** README「已知限制」补齐（无签名/SmartScreen/MCP 默认关闭/旧参考图不迁移/技能库不进 ZIP）。

## 2. 计划（FINAL 批次，4 段长跑）

| 段 | 内容 | 产出 | 门禁 |
|---|---|---|---|
| F0 代码收口 | A1 去留落地；B1/B2/B3 按决定实现或明确记 `[-]` | 干净工作区 + 一个 commit | `tsc` + `npm test` 全绿 |
| F1 发布工程 | C1 干净快照 → C2 仓库/tag → C3 Release → C4 endpoint → C5 重建候选 | 可下载 Release + 新 SHA | `release-check`、`tauri:build`、`.sig`/`latest.json` 一致 |
| F2 安装态 | D1–D4 | `GATES-FINAL.json` + 截图 | 覆盖安装后任务/图片/Key 数量一致 |
| F3 文档终稿 | E1–E3 | CHECKPOINT/REPORT/LEDGER 终版 | 无 `[ ]`/`[~]`、无真实路径残留 |

顺序理由：候选包只构建一次、只签名一次，避免重复上传与 SHA 反复变化。

## 3. 两条备选路线

- **方案 A（推荐）**：F0 → F1 → F2 → F3 顺序做完再发版。代价是发版晚半天，好处是只发一次、SHA 只写一次、U2 验的是最终包。
- **方案 B**：先用当前 1.0.0 候选发「干净但冻结」的首版，UI 小项留 1.0.1。好处是最快拿到可下载链接；代价是发布流程与签名跑两遍，且要先接受旧画廊在首版里。

## 4. 需要你决定（4 条，决定后才动手）

1. **InteractiveDotGrid**：接入（替换现有 CSS 点阵 + 蓝色光晕，更像 AI Studio；需补 reduced-motion、跟随 pan/zoom、帧率上限）／删除（保留现状，最稳）。
2. **旧画廊**：现在就删（会失去收藏夹集合管理）／把集合管理先搬进 Studio 再删／保持现状不动。
3. **GitHub**：仓库 owner 与仓库名？是否公开？我这边没有 git 凭据与 `gh` 登录态，推送需要你提供授权方式（PAT 或你本机已登录的 `gh`）。
4. **自动更新端到端**：要不要用「旧安装包 → 新 Release」真机升一次级（需要 C2 先完成，且会改写真实数据目录）。

## 5. 风险与不做

- 应用**当前正在运行**且是真实数据：覆盖安装前必须先退出并备份 `data.db` + `images`，否则有丢数据风险。
- **更新私钥目前仍只躺在 `%TEMP%`**：`panpan-updater.key`（348B）、`.key.pub`、`panpan-updater.password`（28B）都在，但系统清理临时目录即丢；一旦丢失，**后续所有版本都无法签发更新包**。开工第一件事：原样复制到 `E:\02-RUANJIAN\67-生图工作台-backups\updater-key\` 并确认可读，绝不进仓库。
- 不做：8K、开机启动、多语言、完整撤销重做、历史收藏回接、`store.ts` 拆分、数据库重构。
- 不做：Windows Authenticode 代码签名（用户已确认接受 SmartScreen 提示）。
