# B02-1A 变更卡：数据保命、终态写穿与恢复截止

- 批次：B02-1A（B02-1 的第一个子批）
- 日期：2026-11-06
- 上游清单：`MASTER-ISSUES.md` P0-01–P0-05、P1-27
- 流程：S1 方案 → S2 方案复审 → S3 开发 → S4 代码复审 → S5 构建 → S6 安装/U2
- 本版：按审查窗口 `PLAN_REVIEW=REJECT` 的 8 个阻塞项修订

## 目标

1. 把“当前安装（E 盘测试数据）”与“真实数据（C 盘 387 files / 151.8MB）”统一到唯一安装与唯一数据目录，真实数据可见、可读写，测试数据隔离。
2. 修掉 B01 代码复审的 4 个数据安全阻塞：完成写入竞态、恢复先提示后写库、终态未写穿、custom 恢复无截止。
3. 做一次真实写操作 U2，证明任务可创建、关闭重开、导出/导入、写库失败可感知；真实数据在 U2 期间不被写入。

## 做

### A. 安装与数据目录（P0-01，运营操作）

1. 关闭当前运行中的 `gpt-image-playground.exe`。
2. 对 C 盘真实数据做**双份备份**，不放 Temp：
   - 源：`C:\Users\95720\AppData\Local\PanPan Workbench\data`
   - 主备份：`C:\Users\95720\Documents\PanPanBackups\b02-1-real-data-20261106`
   - 第二份：`E:\02-RUANJIAN\67-生图工作台-backups\b02-1-real-data-20261106`
   - 每份生成逐文件清单（相对路径 + 字节数 + SHA256），记录总文件数/总字节/清单哈希；两份哈希不一致则停止。
3. 记录旧安装证据：
   - 旧安装包：`C:\Users\95720\生图软件二开\release\PanPan Workbench_0.1.1_x64-setup.exe`
   - 记录其 SHA256（应为 `FFD58571167BF983A91CC781F6FC88D19489482C82C9E2C9D4109568F47D5858`，以实测为准）。
   - `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\PanPan Workbench` 的 DisplayName/DisplayVersion/InstallLocation/DisplayIcon/UninstallString。
   - `HKCU\Software\panpan\PanPan Workbench` 的**默认值**（`RestorePreviousInstallLocation` 读的是默认值，不是 `InstallLocation`）。
   - 桌面/开始菜单 `.lnk` 的 Target/IconLocation/WorkingDirectory。
   - 旧协议 `HKCU\Software\Classes\gpt-image-playground`。
   - E 盘测试数据卸载前清单：文件数/总字节/逐文件 SHA256/清单哈希，作为 A.4 对比基线。
4. 卸载 E 盘旧版：
   - 运行 `E:\02-RUANJIAN\67-生图工作台\PanPan Workbench\uninstall.exe /S`；
   - 静默卸载不显示“删除应用数据”复选框，默认不删数据；卸载后校验 E 盘 `data` 的文件数/字节/清单哈希与卸载前一致。
   - E 盘 `data` 保留为测试数据隔离，不合并、不删除。
5. 清理安装器恢复源：
   - 删除整个 `HKCU\Software\panpan\PanPan Workbench`；
   - 若 `HKCU\Software\panpan` 为空，用 `/ifempty` 删除；
   - 记录删除前后注册表值，证明默认值为空，安装器不会再回到 E。
6. 清理旧协议 `HKCU\Software\Classes\gpt-image-playground`；保留新协议 `panpan-workbench`。
7. 安装 B02-1A 构建到默认 C 盘用户目录：
   - `C:\Users\95720\AppData\Local\PanPan Workbench`
   - 该目录已有 `data\data.db`，安装器 `InstallDirPageLeave` 会允许继续并复用真实数据。
8. **不直接启动真实库**。先做只读校验：
   - 把真实 `data` 复制到 `C:\Users\95720\AppData\Local\Temp\opencode\panpan-b02-1-verify-data`；
   - 只对**副本**用 Node 24 `node:sqlite` 查询 `tasks`、`kv`（workspace）数量，记录基线 N；
   - 真实目录只做逐文件清单哈希，不用 SQLite 打开真实 WAL 库（避免 `-shm` 写）；真实目录在 U2 前不启动、不写；
   - 查询脚本放 `scripts/u2/query.mjs`，不依赖 Python。
9. 在测试数据副本上做 U2（见 F）；U2 结束删除 `data-dir` 指针，恢复默认目录，再做一次**受控首次真实启动**：
   - 启动前记录真实目录清单哈希/任务数；
   - 启动后记录任务数、项目数、迁移日志、DB/WAL 文件变化；
   - 这是唯一允许写真实目录的步骤，必须已有双份备份；若任务数不符或启动报错，立即回滚。
10. 验证：
   - exe 路径在 C；
   - 桌面/开始菜单快捷方式指向 C；
   - 应用内项目/任务数量与只读基线一致；
   - E 盘测试数据仍在，但不再被默认安装读取。

### B. 完成写入竞态（P0-02）

1. 在 `store.ts` 增加**按 taskId 的统一持久化队列**，所有任务写库都走队列，不只终态：
   - 队列项是 `patch`（函数式合并），不是调用时整条 task 快照；
   - 执行时重新读取当前内存 task，merge patch 后再 `putTask`；
   - 写成功后用函数式 `setState` 把同一 patch 合并到当前记录，禁止整条替换；
   - 队列执行时若内存中已无该 task，任何 patch 直接丢弃，删除后不得复活；
   - `finally` 释放队列，单次失败不阻塞后续；删除任务后清理该 task 的队列/epoch。
2. 纳入队列的写入点至少包括：
   - `saveTaskCompletion`（终态）；
   - `updateTaskInStore`（画布/改名/收藏/输出等所有 patch）；
   - `updateTaskCanvas`；
   - `moveTasksToWorkspace`；
   - `clearFailedTasks`；
   - 收藏夹批量写；
   - `removeTasks` 的删除。
3. 增加 per-task `epoch`：
   - `stopTask`、`removeTasks`、重新提交/覆盖重试时递增；
   - 终态写前/写后校验 epoch，过期则返回 `superseded`，不更新内存；
   - 非终态 patch 不因 epoch 过期而丢，仍按最新 task 合并。
4. `saveTaskCompletion` 返回三态：`saved | superseded | failed`。
   - `saved`：写库成功 + 更新内存；
   - `superseded`：被 stop/delete/retry 取代，静默返回，清理本次新写入但已无引用的输出图；
   - `failed`：真正写库失败，才提示“保存失败”并把当前任务置 error。
5. 删除改为 **DB-first**：
   - 先递增 epoch、取消 controller；
   - 先 `dbDeleteTask` / `persistTaskDeletionCleanup`；
   - DB 删除成功后再删内存；
   - DB 删除失败：保留内存与 UI，提示“删除失败”，不得显示已删除；重启后任务仍在，不能“复活”成另一个状态。
   - 批量删除逐任务返回结果；部分失败必须提示失败数量并保留失败任务，不能整体提示“已删除”。
   - `clearData`、agent 删除、批量删除都走同一顺序。
6. 不新增 DB 表，不改任务字段/导出格式。

### C. fal/custom 恢复 persist-first（P0-03）

1. `completeRecoveredFalTask`、`completeRecoveredCustomTask` 不再调用先改内存的 `updateTaskInStore`。
2. 改为 `await saveTaskCompletion(...)`：写库成功后才更新内存、清恢复计时、提示成功、发通知。
3. 返回 `failed`：不显示成功、不标记 done；显示“恢复结果保存失败”，保留任务可诊断/可重试。
4. 返回 `superseded`：静默，清理本次输出图，不提示成功。
5. 返回 `saved` 后才 `clearRecoveryStarted` / `clearRecoveryTimer`。

### D. stop/error/watchdog 终态写穿（P0-04）

1. `stopTask` 改为 async：先 abort、递增 epoch，再 `await saveTaskCompletion` 写终态；`saved` 后才提示“已停止”。
2. `failed`：提示“停止状态保存失败”，任务不得显示 done；不得 fire-and-forget。
3. 逐一列出并修改所有“写 `status=done/error` 或清 `falRecoverable/customRecoverable`”的站点：
   - `failOpenAITaskIfStillRunning`；
   - `failRecoveryExpired`；
   - `recoverFalTask` catch；
   - `recoverCustomTask` catch；
   - `executeTask` catch；
   - 启动时缺 profile 的失败分支；
   - agent 停止/失败分支；
   - `stopTask` / `stopAgentResponse`；
   - `removeTasks` 的取消链。
4. 定时器回调可以 `void`，但内部必须 await + 失败提示；所有终态必须 persist-first。
5. 把 `src/lib/workspaceActions.ts` 加入 owned：
   - `stopTasks` 改 async 并 await；
   - `deleteCanvas` / `deleteProject` 在 remove/move 前 await 停止写完成；
   - `src/studio/**` 仍保持 forbidden，不改 UI。
6. 重启后，DB 中已写终态的任务不得进入 fal/custom 恢复队列；写失败的任务允许恢复，但 UI 必须显示失败原因。

### E. custom 恢复截止（P0-05）

1. `getCustomQueuedImageResult` 增加可选 `signal?: AbortSignal` 和 `deadline?: number`，透传给 `pollCustomTaskResult`。
2. `recoverCustomTask`：
   - `const deadline = (task.startedAt ?? task.createdAt) + RECOVERY_MAX_MS;`
   - `if (Date.now() >= deadline) { await failRecoveryExpired(task, ...); return; }`
   - `const controller = new AbortController();`
   - `const timer = setTimeout(() => controller.abort(new RecoveryDeadlineError()), Math.max(0, deadline - Date.now()));`
   - `try { result = await getCustomQueuedImageResult(profile, provider, task.customTaskId, task.params, controller.signal, deadline) } finally { clearTimeout(timer); controller.abort(); }`
3. `pollCustomTaskResult` 内部截止改为 `Math.min(原计算值, deadline ?? Infinity)`；sleep/fetch/extract 都响应 signal。
4. 截止 abort 必须映射为 `failRecoveryExpired`（persist-first），不能落成普通网络错误。
5. 跨重启按任务原始 `startedAt ?? createdAt` 计算；`recoveryStartedAt` 只用于轮询节流，不参与绝对截止。

### F. 真实写 U2（P1-27，可执行脚本）

1. 测试数据：把真实 `data` 复制到 `C:\Users\95720\AppData\Local\Temp\opencode\panpan-b02-1-test-data`；用 `scripts/u2/query.mjs`（Node 24 `node:sqlite`）记录基线任务数 N。Python 不作为依赖。
2. **切到测试数据目录（必须显式做）**：
   - 关闭应用；
   - 写 `<install>\data-dir`（UTF-8 一行）为测试目录；
   - 启动后从日志/`data_dir_notice`/实际读写位置确认应用使用的是测试目录，记录证据；
   - 真实目录此阶段不启动、不写。
3. mock API 与请求计数：
   - 把 `scripts/mock-image-api.mjs` 加入 owned；
   - 建两个明确分开的测试 profile：
     - `mock-openai`：`provider=openai`、`apiMode=images`、baseUrl 指向 `http://127.0.0.1:<port>`，使用 `b64` 或 `url-ok` 模式，供 F.6 同步任务；
     - `mock-custom-async`：custom provider，submit 指向 `/custom/async-submit`，poll 指向 `/custom/tasks/{task_id}`，供 F.5 fixture；
   - 增加 `async-pending` 模式：custom 轮询返回 `{ data: { status: 'IN_PROGRESS' } }`，任务不会自动完成；fixture 的 `customTaskId` 用 `mock:async-pending:<ts>`；
   - 增加 `GET /__stats` 返回总请求数、按路径/任务计数，并逐请求写日志；
   - 记录 31 分钟 fixture、29 分钟 fixture、停止后重启、正常任务四组计数。
4. 写库失败注入（只打 `tasks` 表，不改生产代码）：
   - **独立库**：把测试数据复制到 `panpan-b02-1-fail-data`，触发器验证只在该库做；验证后切回主测试库（仍为 N），不污染 F.5/F.6 计数；
   - 新增 `scripts/u2/fail-task-write.mjs`，用 Node `node:sqlite` 在该库创建两个**只命中目标任务**的触发器：
     - 目标任务的 prompt 含唯一标记 `__B02_FAIL__`；
     - `BEFORE INSERT ON tasks WHEN instr(NEW.data,'__B02_FAIL__') > 0 AND json_extract(NEW.data,'$.status')='done'` → `RAISE(ABORT,'injected task write failure')`；
     - `BEFORE UPDATE ON tasks` 同条件兜底；
     - 若 `json_extract` 不可用，用 `instr(NEW.data,'"status":"done"')` 叠加标记判断。
   - 应用关闭时创建触发器；启动阶段没有标记的 done 任务不会被拦截；启动后创建带标记的任务：图片文件、`images`/`thumbnails` 记录应正常写入，仅该任务完成写 `tasks` 失败；
   - **重启前**核对 UI 显示“保存失败”、DB 无 done、输出图文件仍在（重启会清理未引用图片，不能放到重启后查）；
   - fail-data 库的 `retryMode` 若不同步改 `overwriteFailed`，这里的“重试”只是新建任务，不验证 taskId 复用；该库不计入 N，允许如此，但报告要写明；
   - 删除触发器后重试，应正常完成；
   - 不在 Rust/生产包加任何注入后门。
5. 截止 fixture（独立库，避免污染 N+3）：
   - 把测试数据再复制一份到 `panpan-b02-1-fixture-data`；
   - `scripts/u2/fixture.mjs` 从主测试库 `kv` 设置中读取 `mock-custom-async` profile，断言其 `provider` 不是 `openai`/`fal`，且该 custom provider 定义含 `poll`；用 `node:sqlite` 插入两条 custom 任务，显式写入 `id`、`createdAt`、`prompt`、`outputImages: []`、`apiProvider`、`apiProfileId`、`apiModel`、`apiMode`、`params`、`inputImageIds`、`status='running'`，`customTaskId` 均为 `mock:async-pending:<ts>`：
     - 31 分钟前：`startedAt = now - 31*60*1000`；
     - 29 分钟前：`startedAt = now - 29*60*1000`；
   - `data-dir` 指向 fixture 库启动；31 分钟任务按任务计数必须为 0，直接落 error/expired；29 分钟任务至少 1 次请求，并在 1 分钟内被 abort 落终态；
   - 同一 fixture 库做“停止后重启不恢复”用例：创建 `mock:async-pending:<ts>` 任务，保持 running 时点停止，等写库完成，重启后 `/__stats` 不增加。
6. 3 个任务 U2（主测试库，N 未被 F.4 污染）：
   - 把测试库设置的重试方式改为 `retryMode='overwriteFailed'`（通过 UI 或 `kv`），确保重试复用原 taskId；记录修改前后值；
   - 关闭应用，在主测试库创建 `__B02_FAIL__` 触发器，再启动（避免运行中 `CREATE TRIGGER` 遇 `SQLITE_BUSY`；触发器只命中标记任务，不拦启动阶段普通 done 写）；
   - 创建 3 个任务，其中 1 个 prompt 含 `__B02_FAIL__`，使用 `mock-openai`（`b64` 或 `url-ok` 模式，确保有可写入的输出图；不带 `customTaskId`/`falRequestId`，避免关闭重开时进入恢复）；记录该任务 id 和本次输出图 id/文件；
   - 检查：目标任务图片/缩略图写入成功，仅其 done 写失败；UI 显示“保存失败”，DB 无 done；**重启前**确认输出图文件仍在；
   - 删除触发器，重试目标任务直到 done；断言重试前后 **taskId 不变**；最终任务数 N+3；
   - 关闭重开，状态/输出图/输入图/画布位置一致；
   - 导出 ZIP（勾选导出配置）：关闭应用，创建空目录 `panpan-b02-1-import-data`，把 `data-dir` 切到该空目录，启动后导入；任务数为 N+3；图片数按导出 manifest 的图片条目与 `images` 表行数分别核对，重试前记录的失败任务未引用输出图不计入，重试后仍无引用的孤儿图单独列出；
   - 再关闭应用、切回主测试库。
7. U2 收尾与真实数据 pre/post：
   - 删除安装目录 `data-dir` 指针；
   - **pre**：只做文件清单哈希，记录真实目录 hash/N（不用 SQLite 打开真实库）；
   - A.9 受控首次启动；
   - **post**：记录真实目录 hash/N、迁移差异清单；
   - A.10 判定：任务数不得减少；任何差异逐项解释；否则回滚。
   - 记录 mock 请求日志、DB 查询输出、触发器注入日志、指针删除证据、pre/post 哈希。

### G. 回滚（可执行）

1. 代码回滚点固定：`7102904`（B02 文档 HEAD）。代码在新分支 `b02`，GATES 记录分支起点和最终 HEAD。
2. 安装回滚：
   - 旧安装包：`C:\Users\95720\生图软件二开\release\PanPan Workbench_0.1.1_x64-setup.exe`；
   - 旧包 SHA256 记录在 GATES；
   - 回滚命令（NSIS `/D=` 必须最后、路径不加引号）：
     `Start-Process -Wait -FilePath "C:\Users\95720\生图软件二开\release\PanPan Workbench_0.1.1_x64-setup.exe" -ArgumentList '/S','/D=E:\02-RUANJIAN\67-生图工作台\PanPan Workbench'`
   - 回滚后验证 E 版 exe、快捷方式指向 E、E data 清单哈希与卸载前一致。
3. 数据回滚：
   - 主备份 `C:\Users\95720\Documents\PanPanBackups\b02-1-real-data-20261106`；
   - 第二份 `E:\02-RUANJIAN\67-生图工作台-backups\b02-1-real-data-20261106`；
   - 恢复前先停应用，恢复后校验清单哈希/任务数。
4. 安装失败：立即恢复旧快捷方式/注册表，不写真实库；报告第一个失败门。

## 不做

- 不做 P1-40 错误边界、P1-41 回收站、P2-19 Key 加密、P2-25 DB 完整性、F-01/F-02/F-03 预置 API；这些放 B02-1B。
- 不改 UI、不改画布、不改品牌、不改安装器模板（除非 P0-01 必须修安装路径恢复逻辑）。
- 不重写 store、不换数据库、不新增任务表。
- 不发布公开 Release、不签名、不做 updater。

## Owned files

- `src/store.ts`
- `src/store.test.ts`
- `src/lib/openaiCompatibleImageApi.ts`
- `src/lib/openaiCompatibleImageApi.test.ts`（或现有 `src/lib/api.test.ts`）
- `src/lib/workspaceActions.ts`
- `src/lib/dataOperations.ts`（仅在终态判断需要时）
- `scripts/mock-image-api.mjs`（增加 `/__stats` 与逐请求日志）
- `scripts/u2/**`（query/fixture/fail-task-write 脚本）
- `docs/execution/GATES-B02-1A.json`
- `docs/execution/REPORT-B02-1A.md`

## Forbidden files

- `src/studio/**`
- `src/components/**`
- `src-tauri/**`（B02-1A 默认不改 Rust；U2 触发器方案失败也不自行加注入，需回总控改方案）
- `src-tauri/windows/installer.nsi`（P0-01 先按现有安装器验证；若必须改，先回总控改方案）
- `sponsor-presets.json`
- `package.json` / `package-lock.json` / `src-tauri/Cargo.toml`（版本号统一放 B02-1B）
- C 盘真实数据目录的任何写入（A.9 受控首次启动除外，且必须有双备份与前后证据）

## Invariants

1. 任何终态（done/error/stopped）写库成功前，界面不得显示成功。
2. stop/delete/retry 发生后，迟到的完成结果不得覆盖终态、不得把已删任务插回；drag/改名也不得用旧快照把 done 改回 running。
3. 恢复截止从任务原始开始时间计算，跨重启不重置。
4. U2 期间真实数据目录不被写入；A.9 受控首次启动是唯一例外，必须有双备份、前后哈希/任务数、失败即回滚。
5. 现有 950+ 测试、TypeScript、Rust 87 测试不回归。
6. 不改变任务公开字段/导出格式；导入旧备份仍可读。

## Independent expected（独立 oracle）

| 场景 | 预期 |
|---|---|
| `putTask` 延迟 1s，期间 stopTask | 最终 DB/内存均为 error/stopped；不得出现 done；不得重新插回已删任务 |
| `putTask` 延迟 1s，期间 drag/改名/收藏 | 最终内存/DB 保留新画布、新名字、done；重启后仍一致 |
| 完成写完后立即 drag | DB 不得回到 running |
| 完成写库失败注入 | 界面显示“保存失败”，任务不为 done；输出图 ID 不丢 |
| epoch 过期（retry 同 id） | 返回 `superseded`，新任务保持 running，无“保存失败”提示 |
| 删除时 `dbDeleteTask` 失败 | 不显示“已删除”，任务仍在，重启仍在 |
| 批量删除部分失败 | 提示失败数量，失败任务保留，不能整体提示“已删除” |
| fal/custom 恢复写库失败 | 不弹“已恢复/已完成”，不显示成功通知 |
| 停止后重启 | 该任务不再自动恢复；状态保持 error/stopped |
| 31 分钟 fixture，重启 | `/__stats` 按任务计数为 0，直接失败 |
| 29 分钟 fixture，重启 | 1 分钟内 fetch 被 abort 并落终态 |
| U2 启动 | 日志/实际读写显示数据目录为测试目录；真实目录哈希不变 |
| `__B02_FAIL__` 任务 done 触发器注入 | 启动/其他 done 任务不受影响；目标任务的图片/缩略图写入成功；仅该 tasks 的 done 写失败；UI 显示“保存失败”，DB 无 done；重启前输出图文件仍在；删触发器、`retryMode=overwriteFailed` 重试后 taskId 不变，最终 N+3 |
| 删除 `data-dir` 指针后 | pre 只读哈希/N；A.9 启动后 post 哈希/N 与迁移差异可审计 |

## Gates

- `npm run build`
- `npm test`
- `cargo test`（在 `src-tauri`）
- 定向回归：完成/停止/删除/重试/画布拖动/收藏/恢复相关测试
- `GATES-B02-1A.json` 记录：分支起点、最终提交、构建结果、测试数量、失败数、候选安装包哈希、真实数据双备份清单哈希、旧安装包哈希
- U2 证据：`data-dir` 指针写入/删除、实际数据目录确认、`/__stats` 按任务计数、测试库任务数（N/N+3）、`tasks` done 触发器注入日志、31 分钟任务按任务计数 0 请求、29 分钟 fixture 1 次内 abort、停止后重启按任务计数 0 请求、导出/导入清单、真实目录 pre/post 哈希与任务数

## Rollback

- 代码：`7102904`；新分支 `b02`。
- 安装：旧包路径 + SHA256 + `/D=E:\...` 命令（见 G.2）。
- 数据：主备份 + 第二份（见 G.3）。
- 失败：恢复旧快捷方式/注册表，不写真实库；报告第一个失败门。

## Stop conditions

- 真实数据双备份任一失败或两份清单哈希不一致。
- 安装器无法在保留 `data\data.db` 的情况下安装到 C 盘。
- 任何操作可能导致真实数据被写入/删除（A.9 受控启动除外，且必须满足备份/证据条件）。
- 测试发现终态仍可能被迟到完成覆盖，且方案内无法收敛。
- 需要改 `store.ts` 之外的大范围 UI/DB schema 才能完成本批。
- U2 的 mock/fixture/故障注入无法在干净环境复现。
