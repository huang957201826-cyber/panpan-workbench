# B02-1B 开发报告：数据安全、预置 API 与错误兜底

- 批次：B02-1B
- 日期：2026-11-07
- 总方案：`docs/execution/PLAN-B02.md`，SHA256 `D167732252396120F0EA32F60EAEEA67B0024AC8647F99CD40CF800FBF10E679`
- 清单：`docs/execution/B02-CHECKLIST.md`，冻结 SHA256 `26407F6881F6D548E3ADD5B435D9076374B00D4793669267E7C17C419C2148F1`
- 门禁：`docs/execution/GATES-B02-1B.json`
- 状态：代码/测试/候选完成；真实数据副本 dry-run、安装与 U2 未执行

## 分支与提交

- 分支：`b02`
- 起点：`8f83c20`（B02-1A 收口）
- 总方案提交：`155cae8`
- 本阶段代码/构建提交：`41b7452`
- 代码 diff 范围：`8f83c20..41b7452`
- 文档提交：本报告与 GATES/CHECKLIST 更新为最后文档提交

## 完成内容

### P1-40 顶层错误边界

- 新增 `src/components/ErrorBoundary.tsx`，React 渲染异常时显示重新加载、复制诊断、打开日志。
- `src/main.tsx` 包裹 App；动态导入/启动初始化失败由 `renderStartupFailure` 输出可操作页面，不再白屏。
- `src/lib/diagnostics.ts` 对 `sk-`、`Bearer`、`apiKey` 脱敏；错误边界测试覆盖。

### P1-41 删除保护

- 删除任务、画布、项目前调用 `createDeleteSnapshot`，复用现有导出链路生成含图片的完整 ZIP。
- 快照写入 `<数据目录>/backups/delete-<timestamp>.zip`，失败时中止删除并提示。
- 自动保留最近 5 份；设置页“最近删除快照”列出并复用现有 ZIP 导入恢复。
- 未新增回收站表、未做 30 天后台清理。
- 网页版没有本地 `data/backups`，跳过快照（报告限制）。

### P2-19 API Key 加密

- 新增 Rust `secret.rs`：Windows DPAPI `CryptProtectData` / `CryptUnprotectData`，密文前缀 `dpapi:v1:`。
- `loadTauriStorage` 启动时把旧明文 `apiKey` 迁移为密文；迁移失败保留原明文，不删除旧 Key。
- 内存中仍使用明文供请求/界面使用；写 kv 前由 `encryptedTauriStorage` 加密。
- 导出链路继续剥离所有 Key；MCP token 在 B02-4 复用同一机制。

### P2-25 数据库韧性

- `Storage::open_with` 启动执行 `PRAGMA quick_check(1)`；失败返回 `corrupt`，不删除原文件。
- schema 升级前用 `VACUUM INTO` 创建 `backups/db-pre-migrate-<时间>.db`，保留最近 5 份。
- 启动提示区分“数据库损坏”，指引从 `data/backups` 恢复。
- Rust 测试覆盖迁移前快照、损坏库拒绝、DPAPI 往返。

### P2-24 磁盘预检

- 新增 Rust `disk_free_space`、`disk_cleanup_temp` 与前端 `ensureDiskSpace`。
- 生成任务、写入生成图、导出、保存文件前检查剩余空间；不足时先清理 tmp/，仍不足给出可用/所需空间提示。
- 网页版跳过检查。

### F-01/F-02/F-03 预置 API

- `sponsor-presets.json` 只保留「默认」+「特惠 API」；删除 APIMart/摸鱼/JuCodex/MaruCode/Sublyx/custom-apimart。
- 特惠 API：注册送 10 刀、注册链接、`baseUrl=https://api.tehui.xyz/v1`、模型 `gpt-image-2.5`、Key 留空。
- 被现有任务引用的旧 profile 保留；无引用旧广告配置清理（含无 previousPresetConfig 的旧升级）。
- 新增 `scripts/preset-scan.mjs`：构建前扫 `sponsor-presets.json`，构建后扫 `dist`；`vite.config.ts` 接入插件，命中 `apiKey`/`api-sz-link`/`jucodex` 等即失败。
- 正负 fixture 由 `scripts/preset-scan.test.mjs` 覆盖。

### P2-11 发布检查

- 新增 `scripts/release-check.mjs`：检查 package/Cargo/Cargo.lock 版本一致、预置两条与特惠参数、dist 扫描、GATES 候选 SHA/大小匹配。
- 默认不检查 `RELEASE.md`；`--release` 留给 B02-3 P2-20。

### B02-1A 非阻塞收口

- `removeTasks` 使用 `try/finally` 释放写入 epoch/阻止标记。
- `clearData` 失败时明确提示“只完成一部分”，不再静默。
- Agent 对话仍由现有异步订阅落盘，`stopAgentResponse` 只等待任务终态写库；限制写入本报告与 GATES。

### 复审修订（第二轮）

- P1-41：快照只包含本次删除的任务/画布/项目及其输入、输出、遮罩、透明原图和中间图，不再全库导出；取消单卷限制，图库再大也可只删单任务。画布/项目只生成一份快照；Agent 轮次/消息删除也带 `snapshot: true`。创建前先落当前画布草稿。
- F-01：旧广告 profile 有非空 Key 或与上次预置相比改过 baseUrl/model/name/provider 时保留；无 Key 且未修改才删除；被任务引用的继续保留。
- P2-19：API Key 迁移写回后执行 `PRAGMA wal_checkpoint(TRUNCATE)` + `secure_delete=ON` + `VACUUM`；Rust 测试确认 `data.db`/`data.db-wal` 不含旧明文。MCP token 明确归 B02-4，清单用 `P2-19-MCP [-]` 表示。
- P2-24：磁盘预检放入 `saveFileToDir`，覆盖默认目录和批量直写；`disk_cleanup_temp` 只清理超过 10 分钟且非 `.write-test` 的临时文件，活动文件保留。
- F-03/P2-11：`release-check` 增加安装包 UTF-8/UTF-16 二进制扫描（旧广告标识、`sk-`、Bearer、非空 apiKey 字面量），并校验 productName/identifier/图标/协议/NSIS installMode/安装模板；`--release` 才检查签名，签名正式归属 B02-3。`preset-scan.mjs` CLI 入口改用 `pathToFileURL`，Windows 手工运行不再静默退出。
- 顺手修：`backup_read`/`backup_delete` 仅允许 `delete-*.zip`，保护 `db-pre-migrate-*.db`。

### 复审修订（第二轮补充）

- GATES BOM：`release-check` 读取 package/tauri/GATES/预置前统一去 BOM；BOM 解析与改名产品身份测试覆盖。`deleteSnapshotLongGallery` 已补近似 300MB 无关图库单任务删除测试。
- P1-41 workspace 裁剪：快照接收目标类型/ID，任务删除只保留目标项目/画布，画布/项目删除只保留目标项目/画布；无关画布及其草稿引用图不进入快照，恢复不会改动无关画布。
- P2-19 重试：已加密设置每次启动检查并重试 `storage_secure_cleanup`；失败不再静默，启动提示“API Key 安全清理未完成”，下次启动继续重试。
- B02-3 改名兼容：release-check 不再写死 `PanPan Workbench`/`com.panpan.workbench`，改为校验 productName 非空、identifier 非空且格式合法；改名后仍可通过。
- 测试文件：`src/store.deleteSnapshot.test.ts` 已移到 `src/lib/deleteSnapshot.scope.test.ts`。
- Tauri ACL：新增 `permissions/secret.toml`、`permissions/maintenance.toml`，`files.toml`/`storage.toml` 补齐新增命令，`capabilities/default.json` 加入 `secret`、`maintenance`；新增 `check-tauri-acl.mjs` 静态扫描 `lib.rs` invoke_handler 与权限文件，当前 64 个命令、10 个权限集全部匹配，并接入 `npm test` 与 release-check。
- P2-19 首次迁移：清理判断改用 `migrated ?? raw`，首次把明文迁移为密文后当次执行 `storage_secure_cleanup`，不再依赖第二次启动；失败保留 Key/cache 并记录重试错误。dry-run 新增 `data.db`/`data.db-wal`/`data.db-shm` 原始字节扫描，`plaintextSecretBytes` 必须为 0。

## 门禁

| 门禁 | 结果 |
|---|---|
| `npm run build` | 通过；预置/构建产物扫描通过 |
| `npm test` | 79 文件 / 1010 测试通过，0 失败 |
| `cargo test` | 94 通过，0 失败 |
| `node scripts/release-check.mjs` | 通过 |
| `npm run tauri:build` | 通过 |

## 候选产物

- 安装包：`src-tauri\target\release\bundle\nsis\PanPan Workbench_0.1.1_x64-setup.exe`
- 大小：29,082,405 字节
- SHA256：`4E2B38143032F7E2BA74AB7429029C9D4EB7100D1BEF0B7D2B889F6A545F1289`
- 内置 exe SHA256：`411A9B7CE5ACB6FD9B98B15B983039EE0D9AF634257C74F200901FB57E0718B9`
- 构建源提交：`41b7452`
- 未安装、未执行 U2。

## B02-1B 真实数据副本 dry-run（待总控执行）

1. 确认 B02-1A 双备份仍有效。
2. 复制真实数据到独立副本：
   `node scripts/u2/b02-1b-dry-run.mjs --source "C:\Users\95720\AppData\Local\PanPan Workbench\data" --work "C:\Users\95720\AppData\Local\Temp\opencode\panpan-b02-1b-migration-data" --pretty`
3. 把 `<install>\data-dir` 指向副本后启动应用，完成明文 Key 加密迁移与 DB schema 检查。
4. 迁移后复核：
   `node scripts/u2/b02-1b-dry-run.mjs --verify --work "C:\Users\95720\AppData\Local\Temp\opencode\panpan-b02-1b-migration-data" --pretty`
   要求 `quickCheck=ok`、任务/项目/画布数不减少、`encryptedApiKeyMarkers>0`、`plaintextApiKeyFields=0`、`hasPlainSk=false`。
5. 在副本上执行一次导出，确认 ZIP 不含 Key；再验证删除快照可恢复。
6. 全部通过后，才允许受控首次真实启动；真实目录 pre/post 哈希与任务数必须记录。

## B02-1B 清单关闭情况

本阶段归属项均已在 `B02-CHECKLIST.md` 标 `[x]`：

- P1-41、P2-25、P2-24、P2-11、F-01、F-02、F-03、P1-40、P2-19（API Key）
- `[-]`：P2-19-MCP（B02-4）、F-04、P2-09（按清单不进入本批）

## 未闭环项

1. 真实数据副本 dry-run、受控首次真实启动未执行。
2. 安装、覆盖安装、卸载、U2 未执行。
3. 网页版不保存删除快照。
4. MCP token 复用 DPAPI 留到 B02-4。
5. P1-41 删除快照与恢复的客户端实机点击验证待总控 U2。

## 第一个失败门

本批构建/测试/扫描/release-check 无失败。第一个未执行门是真实数据副本 dry-run，其后是安装/U2，由总控执行。

## 回滚点

- 代码：B02-1A 收口提交 `8f83c20`。
- 真实数据：B02-1A 双备份；本批未写入真实目录。

## 最终收口（2026-11-07，总控执行）

- 安装候选 `4E2B38143032F7E2BA74AB7429029C9D4EB7100D1BEF0B7D2B889F6A545F1289`，安装 exe SHA256 `1FDF26E3CEBDC037A4EF5716FFED63E7C7E46B867540046E8943D8701F08187F`。
- 真实数据副本 dry-run：14 任务不变；profile 6→2；Key 全部 `dpapi:v1:`；`data.db`/`-wal`/`-shm` 明文 0 字节；`quick_check=ok`。
- 受控首次真实启动：14 任务不变；`quick_check=ok`；明文 0 字节；DPAPI 解密成功。
- 迁移前快照：`E:\02-RUANJIAN\67-生图工作台-backups\b02-1b-pre-real-20261107`。
- 已知限制：删除快照恢复、ErrorBoundary、磁盘提示只跑自动化测试，未做真实点击 U2；真实库已加密，回退 B02-1A 需还原上述快照。
