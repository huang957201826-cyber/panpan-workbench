# 新设置页：死控件清单（N3b 依据）

- 日期：2026-11-17
- 对象：`src/studio/modules/settings/SettingsModal.tsx`（原型 2404 行；N3a 复制时与 vendor 原件只差 1 行 import，N3b-1 起按批修改测试连接 / 更新检查 / 推荐节点）
- 入口：预览态 `Ctrl+Alt+S` 或 `?settings=prototype`；齿轮仍是旧设置
- 结论：**原型是设计稿，11 处控件没有真实行为**。不补完不许替换入口。

## 已确认可用（无需改）

| 项 | 依据 |
|---|---|
| API 配置读写 | `installSettingsStorageBridge()` 把 localStorage 接到本项目 store，密钥用 `__stored__` 哨兵，明文不落盘 |
| 保存 / 新增 / 删除 / 复制配置 | `handleSaveProfile` / `handleStartNewProfile` / `handleDeleteProfile` / `handleDuplicateProfile` |
| 复制分享链接 | `navigator.clipboard`，已脱敏 |
| 导入 `.ppconfig` 文件 | `handleParseImportPayload` + 文件选择 |

## 死控件（按修复批分组）

### N3b-1：API 与关于（已完成，提交 `889c9ee`）

| 编号 | 位置 | 原状 | 处理结果 |
|---|---|---|---|
| SET-01 ✅ | `handleTestAndFetchModels` | 请求失败时回退 `DISCOVERED_MODELS_POOL`，**照样报“连接畅通”**；超时 2.2 秒 | 改用 `adapters/settings.testConnection()`（8 秒），成功显示真实模型数与延迟，失败直接报错且不填任何模型；`DISCOVERED_MODELS_POOL` 已删除 |
| SET-02 ✅ | 关于页 | `setTimeout(() => setUpdateCheckStatus('latest'), 600)` | 接 `updateService.performUpdateCheck()`：`idle/checking/latest/available/error` 五态，网页预览提示“当前环境不支持应用内更新”，失败显示原因 |
| SET-09 ✅ | `FEATURED_RELAY_NODE` | `registerUrl: 'https://api.tehui.xyz'`、`badge: '官方合作 · 新客赠额度'` | 注册链接 `https://api.tehui.xyz/sign-up?aff=rf9W`，badge 改「含返利 · 新客赠额度」，preset 模型只留 `gpt-image-2.5`，仍然只填地址与模型、密钥留空 |

验收证据（`docs/execution/evidence/`）：

- `n3b1-test-connection-success.png`：真实配置返回 2 个模型、999ms。
- `n3b1-test-connection-bad-key.png`：错误密钥报「密钥无效（HTTP 401）」，模型列表被清空。
- `n3b1-update-check.png`：关于页真实检查结果为「已是最新版本 v1.3.7」。
- `n3b1-relay-referral.png` / `n3b1-relay-referral-detail.png`：推荐卡片显示「含返利」。

已知限制：

- 客户端里 `fetch` 受 CORS 限制，`testConnection` 必须走 `lib/platform.apiFetch`（Rust 侧发请求）才能拿到真实结果；网页预览仍走浏览器 `fetch`。
- 预览宿主的存储桥接改为在渲染前安装，否则组件首次渲染读到的是原型内置默认配置而不是本项目配置。

### N3b-2：数据页（已完成，提交 `2964d90`）

| 编号 | 控件 | 原状 | 处理结果 |
|---|---|---|---|
| SET-03 ✅ | 下载目录 → 选择 | `notifyUser('请在本地桌面窗口选择下载目录')` | 调 `changeSaveDirWithMigration()`，选择后更新地址（复用 `components/settings/saveDirMigration.tsx`） |
| SET-04 ✅ | 打开下载文件夹 | `notifyUser('已打开下载保存文件夹')` | `openDefaultSaveDir()` 打开真实目录 |
| SET-05 ✅ | 更改数据目录 | `notifyUser('请在桌面端目录窗口中选择新的数据目录')` | 复用 `StorageInfoSection` 同款流程：`pickDataDir()` → 确认框 → `changeDataDir()`；本地存储显示真实目录与占用 |
| SET-06 ✅ | 导出数据 | `notifyUser('已开始打包导出所选数据至本地文件夹')` | `trackDataTransfer(() => exportData({ exportConfig, exportTasks }))`，完成提示真实保存路径 |
| SET-07 ✅ | 导入备份 | `notifyUser('请选择导出的 ZIP 备份文件')` | 隐藏 `input[type=file][accept=.zip][multiple]` → `importData(files, …)`，完成后刷新存储信息 |
| SET-11 ✅ | 确认彻底清空 | `notifyUser('已清空所选本地缓存数据')` | 弹出应用确认框，确认后 `clearData({ clearConfig, clearTasks })` 并刷新存储信息 |

验收证据（`docs/execution/evidence/`）：

- `n3b2-dir-picker.png`：下载目录选择框弹出（已取消）。
- `n3b2-data-dir-picker.png`：更改数据目录的选择框弹出（已取消，未迁移）。
- `n3b2-export-done.png`：导出完成提示真实路径 `export-test-138c.zip`（临时目录，验后已删）。
- `n3b2-import-picker.png`：导入文件选择框（已取消）。
- `n3b2-clear-confirm.png`：清空确认弹层（已取消，未执行清空）。

### N3b-3：通用 / 外观（已完成，提交 `2bced6b`）

| 编号 | 控件 | 原状 | 处理结果 |
|---|---|---|---|
| SET-08 ✅ | MCP 配置 | 原型没有这个区块 | 「通用」页末新增「AI 工具集成」卡片，直接渲染 `components/settings/McpSettingsSection.tsx`，非桌面端提示仅桌面端可用 |
| SET-10 ✅ | 界面缩放 / 并发数 / 提交快捷键 / 网络代理 / 字体模式 / 主题 | 组件内 `useState`，重开即丢 | 全部改为读写 store：`settings.uiScale`、`batchPromptConcurrency`（+`batchPromptConcurrencyLimited`）、`enterSubmit`、`lib/networkProxy`（`system/none/custom`）、`uiFont`、`colorMode` |

同批顺带处理的通用项（同样遵守“接现有字段或删除”）：

| 控件 | 处理 |
|---|---|
| 任务完成或失败时发送系统通知 | 接 `settings.taskCompletionNotification`，开启时走现有通知授权 |
| 重试任务方式 | 接 `settings.retryMode`（`new` / `overwriteAll`） |
| 允许模型优化改写提示词 | 接 `settings.allowPromptRewrite` |
| 一键隐私遮罩快捷键 | 显示真实 `settings.privacyModeShortcut` |
| 鼠标滚轮直接缩放画布 | **删除**：无对应设置字段，画布也不读取，属于纯假开关 |
| 保留输入内容与参考图 | **删除**：`AppSettings` 无此字段 |
| 下载图片时每次询问位置 | **删除**：`AppSettings` 无此字段，保存行为由现有目录逻辑决定 |
| 收藏夹新任务自动归入当前收藏夹 | **删除**：`AppSettings` 无此字段 |

旧页入口：

- 旧设置页标题栏（版本号与关闭按钮之间）新增「试用新版设置」，点击后关闭旧页并打开新版预览；App 监听 `open-prototype-settings` 事件。
- 新页顶部新增可关闭提示条：「预览版：API 与数据页已可用；MCP 与部分开关仍在补齐」。

验收证据（`docs/execution/evidence/`）：

- `n3b3-concurrency-before-restart.png` / `n3b3-concurrency-after-restart.png`：并发数改为 2 后重启仍为 2（数据库记录 `batchPromptConcurrency=2`、`batchPromptConcurrencyLimited=true`，默认值 10）。
- `n3b3-mcp-section.png`：「AI 工具集成 / 本机 MCP」，显示运行中地址、端口与 token。
- `n3b3-general-after.png`：通用页现状（已无被删的四个假开关）；删除前对照见 `n3b2-dir-picker.png`（1.3.8 通用页）。
- `n3b3-old-entry.png`：旧页标题栏的「试用新版设置」。
- `n3b3-preview-banner.png`：新页顶部预览提示条。

已知仍待补齐（不影响本批验收）：数据页「最近删除快照」的恢复按钮仍是前端提示；外观页没有自定义字体输入。

### N3b-4：补齐旧页能力（已完成，提交 `16e5f06`）

| 项 | 位置 | 结果 |
|---|---|---|
| 存储信息 | 「数据」页最上方 | 直接渲染 `components/settings/StorageInfoSection.tsx`；原先手写的存储卡片删除，避免出现两个「更改数据目录」 |
| 技能设置 | 「通用」页「AI 工具集成」之后 | 新增原型卡片外框，内部渲染 `components/settings/SkillSettingsSection.tsx` |
| 字体许可 | 「关于」页「开源协议与第三方许可」下方 | 新增「字体许可」行，打开现有 `components/settings/FontLicensesModal.tsx` |
| 顶部提示条 | 新页顶部 | 文案改为「预览版：功能已接通，版式仍在按原型校准」 |
| 最近删除快照 | 「数据」页 | 删除原型自带的示例快照列表（恢复按钮只弹提示），改由 `StorageInfoSection` 内的真实备份列表承担 |

验收证据（`docs/execution/evidence/`）：

- `n3b4-data-storage.png`：数据页顶部真实存储信息与备份列表。
- `n3b4-general-skills.png`：通用页技能设置（Claude Code / Codex 等安装状态、Skill 文件夹）。
- `n3b4-font-licenses.png`：字体许可弹层，显示 Noto Sans SC 子集与 SIL OFL 1.1 原文。

## 哈希口径例外（必须记录）

设置页**不能**满足「与 vendor 哈希相等」：

| 项 | 数值 |
|---|---|
| vendor 原件 | 2404 行 |
| 当前实现 | 2574 行（持续增加） |
| 与原件差异 | 约 **346 行新增 / 199 行删除** |

原因：原型 11 处是设计稿假实现（见上表），要能用就必须改逻辑。**纯复制的结果就是假按钮。**

因此设置页的判据改为：

1. 每一处差异都必须能对应到本清单的编号（SET-01…SET-11、入口按钮、提示条、补齐的三块旧能力）；
2. 出现**未登记**的差异即失败；
3. vendor 目录仍必须零改动（`verify-vendor` exit 0）。

技能页与工作流页仍按「哈希相等」验收——它们是受控组件，不需要改正文。

## 验收（每批都做）
1. 控件真点一次，有可见结果（不是 toast 完事）；
2. 重启应用后设置仍在（针对 SET-10）；
3. 无新空 `onClick`；
4. build + test 绿；
5. 截图存 `docs/execution/evidence/`。

## 批次顺序

`N3b-1` → 验收 → `N3b-2` → 验收 → `N3b-3` → 验收 → 六项总验收 → 替换齿轮入口（N3c）。

任何一批不过，齿轮继续指向旧设置页。
