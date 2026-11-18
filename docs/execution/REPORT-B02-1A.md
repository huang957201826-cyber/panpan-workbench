# B02-1A 开发报告：写入竞态、终态写穿与恢复截止

- 批次：B02-1A
- 日期：2026-11-06
- 方案：`docs/execution/PLAN-B02-1A.md`，SHA256 `BB92F4C179448687EA12B91B42A45F8BC69956D0FC16DC739B4CB49E634876B9`
- 门禁：`docs/execution/GATES-B02-1A.json`
- 状态：代码完成，构建、前端测试、Rust 测试通过；安装与 U2 未执行

## 分支与提交

- 分支：`b02`，从 `1275f2b` 创建
- 代码/构建提交：`40334cc`
- 代码 diff 范围：`1275f2b..40334cc`
- 子提交：
  - `12bec3b` feat(api): custom 恢复查询支持绝对截止信号
  - `067ad30` feat(store): 任务写入队列、epoch 与终态写穿
  - `a412d20` test: 覆盖写入竞态、删除失败与恢复截止
  - `bc88caa` chore(u2): mock 统计与 fixture/故障注入脚本
  - `a1839b3`、`72c7705` GATES/REPORT
  - `c920372` fix(store): 终态 epoch 前置捕获与 Agent 失败屏障
  - `d5bade7` test: 覆盖图片落库期间 stop 与延迟写拒绝
  - `5d8b172` fix(store): 终态写入执行时复核状态并前置恢复 epoch
  - `7867673` test: 覆盖终态写未落库时的恢复与 Agent 完成
  - `c468599` fix(store): 放行无流式任务的内置图片快照
  - `f0a092c` fix(store): 内置图片任务改为先 running 后 persist-first 完成
  - `5c369e2` test: 覆盖内置图片任务写库失败的终态
  - `277a611` fix(store): Agent 结果处理在 await 后检查停止信号
  - `9cd7667` test: 覆盖无 toolCallId 内置图片存储期间停止
  - `3c28360` fix(store): Agent 单图与批量建卡补全 abort 回滚
  - `fbdb364` test: 覆盖 Agent 建卡与引用解析期间停止
  - `96001d4` fix(store): streaming 分支完成写后丢弃已停止任务
  - `40334cc` test: 覆盖 streaming 图片完成后停止的清理
  - 更新后的 GATES/REPORT 为最后文档提交

## 修改范围

Owned files 内修改：

- `src/store.ts`
- `src/store.test.ts`
- `src/lib/openaiCompatibleImageApi.ts`
- `src/lib/api.test.ts`
- `src/lib/workspaceActions.ts`
- `scripts/mock-image-api.mjs`
- `scripts/u2/query.mjs`
- `scripts/u2/fixture.mjs`
- `scripts/u2/fail-task-write.mjs`
- `docs/execution/GATES-B02-1A.json`
- `docs/execution/REPORT-B02-1A.md`

未修改 `src/studio/**`、`src/components/**`、`src-tauri/**`、安装器、`package.json`、`package-lock.json`、`Cargo.toml`、任务字段、DB schema、导出格式。未写入 C 盘真实数据目录。

## 实现结果

### P0-02 完成写入竞态

- `store.ts` 增加按 taskId 的统一持久化队列：队列项是函数式 patch，执行时重新读取最新内存任务再合并写入。
- 增加 per-task epoch；`stopTask`、删除、覆盖重试递增。终态写入校验 epoch，过期返回 `superseded`。
- `saveTaskCompletion` 返回 `saved | superseded | failed`。
- 非终态写入（画布、改名、收藏、移动、部分失败清理、Agent 任务创建）统一走队列。
- 删除改为 DB-first：先递增 epoch、取消任务、等待该任务队列，再逐条删库，成功后才删内存；失败保留任务。
- 批量删除逐任务返回结果；部分失败提示失败数量，失败任务保留。
- Agent 轮次删除要求整体成功；部分失败会回写已删任务，避免对话与任务只删一半。

### P0-03 fal/custom 恢复 persist-first

- `completeRecoveredFalTask`、`completeRecoveredCustomTask` 改为先 `saveTaskCompletion`。
- `saved` 后才清恢复计时、提示成功并发送通知。
- `failed` 显示“恢复结果保存失败”，不标记 done；`superseded` 静默并清理本次输出图。

### P0-04 终态写穿

- `stopTask` 改为 async：先 abort、递增 epoch，再持久化终态；只有 `saved` 才提示已停止。
- `stopAgentResponse`、Agent 轮次停止/失败标记改为 async 并等待落库。
- 覆盖 `failOpenAITaskIfStillRunning`、`failRecoveryExpired`、fal/custom 恢复 catch、`executeTask` catch、缺少 API 配置分支、Agent 图像任务完成/失败、网络断开进入恢复、`clearData`、删除链。
- `workspaceActions.stopTasks` 改 async；`deleteCanvas` / `deleteProject` 等待停止写完成，删除失败时不再删除画布/项目。
- 重启后已写终态的 custom/fal 任务不再进入恢复队列；停止后重启不恢复。

### P0-05 custom 恢复绝对截止

- `getCustomQueuedImageResult` 增加可选 `signal` 与 `deadline`，透传到 `pollCustomTaskResult`。
- 轮询内部截止取 `Math.min(原截止, 调用方 deadline)`。
- `recoverCustomTask` 以 `(startedAt ?? createdAt) + 30 分钟` 计算绝对截止；外层 `AbortController` 定时 abort，截止异常映射为 `failRecoveryExpired`。
- `recoveryStartedAt` 只保留为进程内轮询辅助，不参与跨重启绝对截止。

### 代码复审 3 个阻塞修复

- 终态 epoch 现在在进入恢复/Agent 完成函数时、任何图片落库 await 之前捕获，并显式传给 `saveTaskCompletion`。图片落库期间发生 stop/删除/重试时，写库前后都会用旧 epoch 校验，返回 `superseded` 并清理本次图片。
- `completeAgentImageTask` 在图片落库后增加 `status === 'running'` 守卫，避免任务已停止或失败后继续写 done。
- `markAgentRoundTasksStopped` / `markAgentRoundTasksFailed` 返回结构化 saved/superseded/failed 计数；`stopAgentResponse` 只在全部 saved 时提示“已停止生成”，写失败只显示失败提示。
- Agent 失败/停止前建立终态屏障：`markAgentRoundTasksFailed`、`failAgentImageTask` 均递增 task epoch，与完成路径捕获的 expected epoch 配合，迟到完成不会覆盖失败。
- `enqueueTaskWrite` 的写库异常分支先复核 epoch；已被 stop/retry/delete 取代时返回 `superseded`，不提示“保存失败”，也不把旧完成任务置 error。
- 最后一处时序窗口：`enqueueTaskWrite` 在执行 done patch 时重新读取当前任务，只有仍为 running 或可恢复状态才允许写 done；恢复任务的 expected epoch 提前到轮询前捕获，stop/delete 会 abort 正在进行的恢复 controller。终态写尚未落库时启动的恢复/Agent 完成，会在执行时被状态复核拦为 `superseded`。
- 无流式内置图片任务不再先以 done 进入内存：先以 running 写入，再走正常 `saveTaskCompletion`；初始写失败会移除内存任务并清理图片，完成写失败会保留 error 和输出图供诊断，均不显示 done。
- Agent 结果处理在图片循环开始前及每个 await 后检查 `controller.signal.aborted`；停止后跳过后续图片，已写入图片会清理，已创建任务会移除，不再在“已停止生成”后新增完成卡片。Agent 停止也会 abort 正在进行的恢复 controller。
- Agent 单图引用解析、`ensureStreamingAgentTask`、批量建卡、`onImageToolStarted` / `onImagePartialImage` / `onImageToolCompleted` / `onImageToolFailed` 均在 await 后检查停止信号；批量建卡记录已创建任务，停止时逐个删除并清理 round/message 的 `outputTaskIds`。
- 带 `toolCallId` 的 streaming 图片分支在 `completeAgentImageTask` 返回后若已停止，会删除该任务并清理 `outputTaskIds`；`completeAgentImageTask` 内 `ensureStreamingAgentTask` 后也检查停止信号。

### P1-27 U2 准备（未执行）

- `scripts/u2/query.mjs`：Node 24 `node:sqlite` 只读查询任务数、状态、kv、workspace、配置、触发器。
- `scripts/u2/fixture.mjs`：从主测试库 kv 读取 `mock-custom-async` 配置，断言不是 openai/fal 且含 poll，插入 31 分钟和 29 分钟 custom 任务。
- `scripts/u2/fail-task-write.mjs`：只命中含 `__B02_FAIL__` 且 status=done 的 tasks 写入，支持 create/drop/list/verify；JSON1 不可用时回退字符串判断。
- `scripts/mock-image-api.mjs`：新增 `/__stats`（含 reset）、逐请求日志、按路径/任务计数、`async-pending` 模式。

三个脚本已在临时 SQLite 库完成建表、query、fixture、create/verify/list/drop 冒烟，未接触真实数据。

## 门禁结果

| 门禁 | 结果 |
|---|---|
| `npm run build` | 通过 |
| `npm test` | 72 文件 / 980 测试通过，0 失败 |
| `cargo test`（`src-tauri`） | 87 库测试通过，0 失败 |
| `npm run tauri:build` | 通过 |
| 定向回归 | 写入竞态、删除 DB-first、恢复写失败、31/29 分钟截止、停止后重启、收藏/画布竞态、终态写未落库时启动的恢复/Agent 完成均通过 |

## 候选产物

- 安装包：`C:\Users\95720\生图软件二开\gpt_image_playground-main\src-tauri\target\release\bundle\nsis\PanPan Workbench_0.1.1_x64-setup.exe`
- 大小：29,022,394 字节
- SHA256：`5A385ECB579BB1C89FE5F86551CA0C0D5126DE3B697B1FE0D81A7549813A3973`
- 内置 exe SHA256：`9038B71B9AE4A1D4CC293922394A4525AC26F0D330FB7ACB2D78B03CAFE2D6FF`
- 构建源提交：`40334cc`
- 未安装、未覆盖安装、未卸载。

## 未闭环项

1. P0-01 双安装/双数据迁移未执行：关闭旧程序、双份真实数据备份、卸载 E 盘旧版、清理注册表恢复源、安装到 C 盘、受控首次真实启动均由总控执行。
2. P1-27 真实写 U2 未执行：脚本已准备，U2 需在测试数据副本上执行并记录 `/__stats`、N/N+3、触发器日志、导出/导入清单。
3. 候选包未做安装/覆盖安装/卸载验证，未做干净虚拟机验证。
4. C 盘真实数据未打开、未写入；真实目录哈希与任务数 pre/post 未采集。
5. `stopAgentResponse` 已等待任务终态写库，但 Agent 对话本身仍由现有异步订阅落盘，未额外等待对话持久化。
6. 代码复审、U2 结论待总控安排。

## 第一个失败门

本批构建与测试门禁无失败；第一个未执行门是安装/U2，不是失败。执行顺序建议：

1. 总控按方案 A 完成真实数据双备份与旧安装卸载，记录清单哈希。
2. 安装本候选包到 C 盘默认目录，先只读校验。
3. 复制真实 `data` 到 `Temp\opencode\panpan-b02-1-test-data`，执行 `query.mjs` 记录 N。
4. 写 `<install>\data-dir` 指向测试目录，启动并确认实际数据目录。
5. 启动 `scripts/mock-image-api.mjs`，按方案 F 建立 `mock-openai` / `mock-custom-async` 测试配置。
6. 依次执行 fail-data 触发器验证、fixture 31/29 分钟截止、停止后重启、3 任务主库 U2、导出/导入。
7. U2 完成删除 `data-dir`，做真实数据 pre/post 哈希与受控首次启动。

## 回滚点

- 代码：`b02` 分支起点 `1275f2b`；方案文档回滚点 `7102904`。
- 安装与数据回滚按 `PLAN-B02-1A.md` G.2/G.3 执行，本批未触碰安装与真实数据。
