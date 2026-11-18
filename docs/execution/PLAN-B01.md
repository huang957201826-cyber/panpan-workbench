# PLAN-B01 — 数据安全 + 核心交互 + 品牌收口

- 批次：`B01`（拆为 B01-1 / B01-2 / B01-3）
- 级别：Tier C
- 基线：tag `b01-3`（当前 HEAD，工作区干净；以 `git rev-parse b01-3` 为准）
- 代码回滚点：`a56d3d1`（P6 验收版本）
- 目标：把“会丢数据/会重复扣费/会永久卡住”的 P0/P1 与用户明确指出的画布/输入台/品牌问题修到可安装体验。
- 原则：每个子批单独 commit/tag、单独 U2、单独回滚点；上一子批 Gate 通过后才进入下一子批。

## 子批划分

| 子批 | 范围 | 对应 REQ | 回滚 |
|---|---|---|---|
| B01-1 数据安全 | 持久化写穿/回滚、取消链路、异步截止、导入导出、Rust 存储 | REQ-001–005 | tag `b01-1` + 数据备份 |
| B01-2 核心交互 | 快捷菜单、画布选择/拖动/插入/节点动作、尺寸、输入台、外壳状态 | REQ-006–014、018 | tag `b01-2` |
| B01-3 品牌安装 | 图标、上游推广清理、假入口、安装/U2 | REQ-015–017、019 | tag `b01-3` + 旧安装包 |

## B01-1 做

### A1 持久化写穿/回滚契约

- 任务创建、状态转 `done/error`、输出图写入、画布位置更新：**先写库成功，再更新内存/提示成功**；若已更新内存，写库失败必须回滚到上一状态并显示可重试错误。
- 设置写入失败：由 `tauriStorage` 抛错事件到 UI，显示一次明确提示；关闭窗口前未写入的 dirty 不清空为“成功”。
- 验收：mock `putTask`/`putTaskCanvas`/`flushTauriStorage` 失败，断言 UI 不显示成功、内存回滚、重启不丢旧数据、重试成功后一致。

### A2 取消链路与远端规则

- 删除 running、停止、watchdog 超时、覆盖重试：abort 旧 controller；`finally` 只清理当前 execution 的 controller。
- Agent hybrid 单图传 `signal`。
- Provider 能力矩阵（不假设 abort 能停止服务端计费）：
  - OpenAI Images/Responses：本地 abort 只停止客户端等待，服务端可能仍已受理；停止/超时/重试必须确认远端终态后才能重新提交。
  - fal：SDK 支持 `abortSignal`，但仍可能已在远端排队/执行；停止/删除后显示“远端可能仍在执行”，保留 request ID。
  - 自定义异步：只能停止本地轮询，远端任务不可取消；停止/删除后保留 task ID。
- **任何 provider 的 error 状态都不自动重提**；用户点重试时，若原任务可能仍在远端执行，先弹确认“已到服务商确认原任务结束”，确认后才提交。覆盖重试同样拦截。
- 验收：OpenAI/fal/custom 的 stop/timeout/retry 场景都断言不产生第二个请求；无法确认取消时 UI 显示远端状态；provider 矩阵不把任何未确认取消的 provider 标为“安全重试”。

### A3 异步截止

- 自定义轮询：总截止 30 分钟（或 2×timeout，取大）、连续错误 20 次、未知状态 3 次即失败；错误可读，保留远端 task ID。
- fal：`abortSignal` + 总超时；恢复任务同样有上限。
- 验收：模拟 429/5xx/未知 status/网络错误，断言在阈值内结束且错误可读；不会无限 running。

### A4 导入导出

- 导出前把当前 composer 写回画布。
- 导出引用集合由 `collectReferencedImageIds` 从任务全部图片字段、workspace 参考图/遮罩、Agent 轮次/消息、gallery/agent 草稿显式收集；再与 `getAllImageIds()` 做差集，缺失即中止并列出 ID。遮罩 base64 随 workspace 快照单独校验。
- 导出 settings 时递归剔除 `apiKey`；保留 baseUrl/model/能力配置。
- 导入：拒绝 `version > 4`；任务补 `params/status/createdAt/outputImages` 等必需字段，running 标记中断；同 ID 任务跳过；Agent 对话按 round ID/消息 ID 稳定并集，同 ID round 取较新对话版本并保留另一侧独有 round；导入前快照 tasks/workspace/对话/收藏夹/设置，失败时统一补偿回滚，并删除本次新写入且导入前不存在的图片/缩略图。
- 验收：旧备份 roundtrip、缺图导出拒绝、`version:99` 拒绝、同 ID 不覆盖、Agent 两侧不同 round 均保留、导出 JSON 无 apiKey、任务/workspace/Agent/图片写入分别注入失败后数量与导入前一致。

### A5 Rust 存储

- `storage/mod.rs`：`PRAGMA busy_timeout=5000`。
- `files.rs`：提交前 `sync_all`。
- `migrate.rs`：跨盘复制后、删除源前 `sync_all`。
- `data_dir.rs` 只复核已有 `sync_all`/回滚，不重复改；若需改动，纳入 Owned files。
- 验收：cargo test；失败注入证明 fsync/迁移失败不删源。

## B01-2 做

### B 画布

- 默认选择箭头；Space/中键/手型平移；左键空白框选；Shift/Ctrl 多选；Ctrl+A、Delete；输入框/文本域/contentEditable 聚焦时忽略画布快捷键。
- 删除节点/批量选中必须确认，显示任务/图片数量；取消不删除。
- 拖动 offset 用 `dx / scale`；松手不跳动。
- 新任务：选中行下方；无选中最后一行下方；x 对齐、48px 间距；批量同一行向右排开。
- 节点动作：复用参数、设为参考图、编辑输出图、删除、重新生成、详情；工具条自动上下翻转；右键同动作。
- 低倍总览点击命中放大；500+ 占位可点击定位；节点极值计算不用 spread。

### C Studio 输入台与外壳

- 快捷参数菜单 Portal 化（底部 + 右侧），不被 `overflow-x-auto` 裁切。
- 尺寸复用原版 `SizePickerModal`（1K/2K/4K、8 比例、自定义、auto）。
- URL 添加、粘贴、拖放；参考图来源：本地/画布/历史/链接；16 张上限与单文件 20MB/8192px 校验。
- 文件夹展开/收起；历史流“画布”定位具体节点；筛选变化清空隐藏选择；批量进度/停止；遮罩状态 chip。
- 移除假撤销/重做、Ctrl+N/Z/Y 标签、默认项目删除、更新死入口。

## B01-3 做

- 图标：优先使用仓库/用户已有盼盼品牌源图；没有则用“盼盼熊猫”简单标记生成 master 1024px，明确为本批首版，安装后由用户确认；替换窗口/任务栏/开始菜单/安装包/卸载器/favicon/PWA。
- 移除 Rummage/客户端公告、50 图赞助、关于页赞助/上游 Issues、帮助页上游仓库；保留 MIT 版权、LICENSE、第三方许可。
- 构建、安装、覆盖安装、静默卸载、U2、回滚记录。

## 不做

- MCP、8K、Agent 回归、工作流/技能库内容。
- 完整撤销/重做命令层；只移除假入口。
- `store.ts` 全面拆分、React Flow/tldraw 替换、数据库结构重写。
- 代码签名、自动更新产物、干净虚拟机、跨盘断电实测。

## Owned files

- `src/store.ts`
- `src/lib/workspaceActions.ts`、`workspaceState.ts`、`persistedState.ts`、`inputDraftState.ts`、`tauriStorage.ts`
- `src/lib/exportZip.ts`、`exportImages.ts`、`agentConversationState.ts`、`taskState.ts`
- `src/lib/openaiCompatibleImageApi.ts`、`falAiImageApi.ts`、`imageApiShared.ts`
- `src/lib/canvasNodes.ts`、`canvasMath.ts`
- `src/components/CanvasBoard.tsx`、`CanvasTaskNode.tsx`、`SizePickerModal.tsx`、`InputBar.tsx`、`MaskEditorModal.tsx`
- `src/studio/StudioShell.tsx`、`src/studio/components/BottomPromptBar.tsx`、`RightGeneratorDrawer.tsx`、`AppSidebar.tsx`、`TitleBar.tsx`、`FloatingMenu.tsx`、`src/studio/adapters.ts`
- `src/App.tsx`、`src/components/SupportPromptModal.tsx`、`src/components/settings/AboutSettingsTab.tsx`、`src/components/settings/StorageInfoSection.tsx`、`src/components/settings/SettingsModal.tsx`、`src/components/HelpModal.tsx`
- `public/announcements.json`、`public/pwa-icon.svg`、`public/pwa-maskable-icon.svg`
- `src-tauri/icons/*`、`src-tauri/tauri.conf.json`
- `src-tauri/src/storage/mod.rs`、`src-tauri/src/files.rs`、`src-tauri/src/migrate.rs`、`src-tauri/src/data_dir.rs`
- `package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`
- `docs/execution/*`
- 对应 `*.test.ts`

## Forbidden files

- `dist/`、`src-tauri/target/`、`node_modules/`
- 用户真实数据目录 `C:\Users\95720\AppData\Local\PanPan Workbench\data`（只读备份，不做实验）
- `LICENSE`、`src/assets/third-party-notices.txt`、字体/第三方许可
- 与本批无关的 Agent、工作流、技能库、MCP 代码

## Invariants

- 现有数据格式向后兼容；旧备份仍可导入。
- 不改变 API 参数语义；不新增假尺寸/假模型/假开关。
- 保留 MIT 版权、LICENSE、第三方许可。
- `maskDataUrl` 唯一持久化来源改为 workspace 快照；主 store 草稿不再保存遮罩 base64；`MaskEditorModal` 与提交链路仍读内存 `maskDraft`，旧双份数据在下一次 `saveActiveCanvasSnapshot` 时收敛，不丢遮罩。
- 现有 950 个测试全过；tsc、build、tauri build 通过。
- 安装失败时可回滚到 `0.1.0` 安装包与安装前数据备份。

## Independent expected（REQ → 判据）

| REQ | 独立判据 |
|---|---|
| 001 | mock `putTask`/`updateTaskCanvas`/`flushTauriStorage` 失败：不显示成功、内存回滚、重启旧数据在、重试成功 |
| 002 | OpenAI/fal/custom 的 stop/delete/timeout/retry spy abort；都不产生第二请求；不可确认取消时重试被拦截 |
| 003 | 429/5xx/未知 status/网络错误在 30 分钟内结束且错误可读 |
| 004 | 缺图导出拒绝并列出 ID；version 99 拒绝；同 ID 不覆盖；导出 JSON 无 apiKey；失败导入无孤儿图片 |
| 005 | cargo test；fsync 失败/迁移失败源目录保留 |
| 006 | 底部/右侧每个胶囊实际点击，菜单完整可见 |
| 007 | 输入框聚焦时 Ctrl+A/Delete 不改画布；Shift/Ctrl 多选；Delete 必须确认 |
| 008 | k=0.5 时 100px 屏幕位移写入世界坐标 200px |
| 009 | 3 行节点下新节点 x 对齐选中行、y=行底+48；无选中时最后一行下方 |
| 010 | 六个节点动作逐个可执行；工具条在首行上下翻转；右键菜单同动作 |
| 011 | 粘贴/拖入/URL 三种来源均生成真实图片 ID；第 17 张被拒绝 |
| 012 | 2K/4K/16:9/21:9/自定义可选，值写回并刷新保留 |
| 013 | 文件夹收起；历史“画布”定位；筛选后隐藏任务不被批量删；批量显示进度并可停止 |
| 014 | 遮罩 chip 可见；主 store 持久化 JSON 不含 maskDataUrl；workspace 含一份 |
| 015 | 窗口/任务栏/开始菜单/安装包/卸载器/favicon/PWA 逐项视检 |
| 016 | 应用内无 Rummage/赞助/上游 Issues/上游仓库入口；MIT 署名与第三方许可仍在 |
| 017 | 无假撤销/重做/Ctrl+N/默认项目删除/更新死入口 |
| 018 | 低倍点击命中放大；501 个节点第 501 个占位可定位 |
| 019 | 安装/覆盖/卸载/U2/回滚记录与哈希 |

## Gates

1. `npx tsc -b`
2. `npm test`（全量）
3. `npm run build`
4. `cargo test`（`src-tauri`）
5. `npm run tauri:build`
6. 每个子批独立安装/U2/回滚演练
7. 产物 SHA-256、安装目录、版本号、第一个失败门写入 REPORT-B01

## U2

- 不在真实数据目录做生成/导入/迁移实验。
- 安装前关闭应用，备份真实数据目录并计算大小/SHA-256。
- 测试数据目录统一放 `%TEMP%\panpan-b01-data`（例如 `C:\Users\95720\AppData\Local\Temp\panpan-b01-data`），测试数据可丢弃；不使用 `src-tauri/target/`，不写真实数据目录。
- 启动测试用 release 二进制前设置环境变量 `PANPAN_DATA_DIR=%TEMP%\panpan-b01-data`；程序优先使用该目录，不再读安装目录的 `data-dir`。U2 第一步先确认设置页显示的数据目录是该路径。
- 安装版只做启动/界面/菜单/图标/设置只读检查；真实数据目录哈希前后必须一致。
- 回滚演练：旧安装包静默安装 + 数据备份恢复，确认可启动。

### B01-1 U2（数据）

1. release 二进制 + `%TEMP%\panpan-b01-data` 启动；新建 3 个任务，确认写库成功。
2. 关闭重开，任务/画布/草稿仍在；无 running 幽灵任务。
3. 导出备份，解压 `manifest.json`，确认 `apiKey` 为空字符串；恢复后任务/图片数量一致。
4. mock/注入一次写库失败（测试数据），确认 UI 显示错误且不显示完成。

### B01-2 U2（交互）

1. 底部/右侧快捷菜单逐个点开，菜单完整可见。
2. 尺寸选 2K/16:9/自定义，写回并刷新保留。
3. 画布默认箭头；Space/中键平移；Shift 多选；拖动节点松手不跳动。
4. 选中节点后新生成落在该行下方；六个节点动作逐个执行；右键菜单同动作。
5. 粘贴/拖入/URL 添加参考图；第 17 张被拒绝；从画布/历史选参考图。

### B01-3 U2（安装）

1. 静默安装新包 → 启动 → 窗口/任务栏/开始菜单/安装包/卸载器/favicon 图标逐项视检。
2. 覆盖安装 → 启动 → 设置 6 Tab、无上游推广弹窗。
3. 静默卸载 → exe/注册表清理，`data` 保留。
4. 回滚：旧 `0.1.0` 安装包 + 数据备份，启动成功。

## Rollback

- 子批回滚矩阵：
  - B01-1 失败 → 回到 tag `b01-base`。
  - B01-2 失败 → 回到 tag `b01-1`。
  - B01-3 失败 → 回到 tag `b01-2`。
  - 整批失败/安装回滚 → `a56d3d1` + 旧安装包 + 数据备份。
- 每个子批：`git tag b01-N` + 该子批报告。
- 安装回滚：关闭应用 → 静默安装 `C:\Users\95720\生图软件二开\release\PanPan Workbench_0.1.0_x64-setup.exe`。
- 数据回滚：`C:\Users\95720\AppData\Local\Temp\opencode\panpan-b01-data-backup`。
- 代码总回滚点：`a56d3d1`。

## Stop

- 环境硬阻塞（构建工具、磁盘、权限、安装器无法运行）。
- 红灯必须改规则（例如修 P0 需要改数据格式且无法向后兼容）。
- 图标首版为按用户“为什么图标不改”要求生成的盼盼熊猫标记，安装后由用户确认；不因风格未定阻塞本批。
