# B02-4 开发报告：本机 MCP

- 批次：B02-4
- 日期：2026-11-07
- 总方案：`docs/execution/PLAN-B02.md`，SHA256 `D167732252396120F0EA32F60EAEEA67B0024AC8647F99CD40CF800FBF10E679`
- 清单：`docs/execution/B02-CHECKLIST.md`，SHA256 `FC9C82326EE08BC1C6DECBF8E82DE201598C61C31F1F70D5128CFC57B60B4C90`
- 门禁：`docs/execution/GATES-B02-4.json`
- STATUS：代码/构建/测试完成；候选已重建；安装与 U2 未执行（按本批约束）

## HEAD 与候选

- 分支：`b02`
- 代码 HEAD：`9d99cab`
- 候选安装包：`src-tauri/target/release/bundle/nsis/PanPan Workbench_0.1.1_x64-setup.exe`
- 候选 SHA256：`85CFB729AB7E8F3681223F161EB0BE7A594EBEC9F17C133E01E91E6A44974BFB`
- 候选大小：30,200,732 字节（28.80 MiB）
- 测试：Vitest 78 文件 / 986 用例通过；Rust 105 用例通过；`npm run build`、`check-tauri-acl`、`release-check`、`npm run tauri:build` 通过

## 复审修复

1. stdio 只读
   - `--mcp-stdio` 不再调用 `data_dir::prepare`、`storage::init`、迁移、quick_check、tmp 清理或 `ensure_token`。
   - 使用 `data_dir::current_for_read()` 只读解析数据目录，`Storage::open_read_only` 以 `SQLITE_OPEN_READ_ONLY` 打开并设置 `query_only`。
   - stdio 工具列表只有 6 个只读工具；`task.create`/`image.attach` 调用返回“stdio 不支持写入”。
   - 实测：dev-data `data.db` SHA256 前后一致，目录文件列表不变，`task.list` 返回 13 条。

2. 停用释放端口
   - `stop_running` 发送 shutdown 后等待任务结束；5 秒超时显式 `abort()` 并等待，之后才把 `running.port` 置空。
   - 停用时旧 token 轮换；同端口可重新启用。
   - Rust 测试覆盖“停止后同端口重新 bind”。

3. 写入确认展示实际输入
   - `task.create` 只使用 MCP 请求显式传入的 `imageIds`，不再读取当前输入台 `inputImages`。
   - 确认框展示提示词、项目/画布名称、参考图数量与缩略图；`image.attach` 同样展示图片数量与缩略图。
   - 前端 60 秒超时会关闭确认框，取消/超时不会创建任务。
   - 新增 `mcpWrite` 纯函数测试：未传 imageIds 不夹带当前参考图；显式 id 原样进入 `inputImages`；Rust 测试确认 payload 中 imageIds 只来自请求。


## 工具清单

| 工具 | 权限 | 说明 |
|---|---|---|
| `project.list` | 只读 | 返回项目列表 |
| `canvas.list` | 只读 | 按项目过滤画布 |
| `task.list` | 只读 | `limit`/`offset` 分页，可按项目/画布过滤 |
| `task.get` | 只读 | 返回单个任务的安全字段 |
| `image.get` | 只读 | 返回图片内容 base64 与尺寸，不含路径 |
| `settings.get` | 只读 | 脱敏设置；无 apiKey/token，baseUrl 只保留 host |
| `task.create` | 写入 | 默认关闭，UI 确认后复用 `submitTask` |
| `image.attach` | 写入 | 默认关闭，UI 确认后加入当前参考图 |

## 安全用例结果

- 未授权请求：401 拒绝（HTTP 集成测试）
- 错 token：401 拒绝（HTTP 集成测试）
- 非本机 Host：403 拒绝（`local_host` 单测）
- 外部 Origin：403 拒绝（HTTP 集成测试）
- 只读工具：HTTP `initialize` + `tools/list` 通过；stdio `task.list` 真实连通通过
- stdio 只读：工具列表 6 个只读工具；写入返回“stdio 不支持写入”；`data.db` 与目录文件哈希前后不变
- 停用：Rust 测试确认 shutdown 后端口释放，同端口可重新 bind；旧 token 在停用时轮换
- 响应脱敏：任务错误详情与绝对路径被剥离；`settings.get` 的 baseUrl 只返回 host
- 写入确认：默认关闭；`task.create` 只用请求显式 `imageIds`；确认框展示提示词、项目/画布、参考图缩略图与数量；取消/60 秒超时不创建
- `mcpWrite` 测试：未传 imageIds 不夹带当前参考图；显式 id 与展示/提交一致
- 端口占用：`mcp_configure` 返回“端口不可用”并保持可重试，不崩溃
- 限流：60 次/分钟，超出返回 429
- token：32 字节随机、Bearer、常数时间比较、DPAPI 密文落盘

## known-limits

- 写入确认需要主窗口可见；窗口隐藏时请求会等待用户从托盘唤出，60 秒超时。
- stdio 模式只提供只读工具，不迁移、不写 meta/tmp，也不与 GUI 争夺写连接。
- GUI 默认关闭时不生成 token；启用或轮换时才写入 DPAPI 密文。停用时轮换 token，旧 token 失效。
- MCP token 通过本机 Tauri IPC 返回给设置页用于复制，不写入前端持久化。
- 限流为全局计数，不按 token/session 分开。
- 为消除测试二进制中 rfd/TaskDialog 的清单冲突，保存/目录选择改用 Win32 通用对话框；功能路径不变。
- 写入确认 UI 的点击与缩略图展示待 U2；本批未执行安装。

## 第一个失败门

- `null`
