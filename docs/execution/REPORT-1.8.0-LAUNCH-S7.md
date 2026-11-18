# REPORT · 1.8.0-LAUNCH S7 最终候选与 U2

- 状态：本地候选与 U2 全部完成；发布锁未解除，未 push、未打 tag、未上传 Release。
- 日期：2026-11-18
- 版本：1.8.0
- 代码提交：`e379fe6`（S6 收口提交，S7 未改源码）

## 最终候选（唯一带签名构建）

- 安装包：`src-tauri/target/release/bundle/nsis/PanPan Workbench_1.8.0_x64-setup.exe`
- 大小：`15,537,168` 字节
- SHA256：`8E70801C7B768EC8FAD8DBA5F78645C741EC6DF1F0AEF7F0F6430D66161E51AF`
- 签名：`PanPan Workbench_1.8.0_x64-setup.exe.sig`，448 字节
- 签名 key id：`94CBC66F59E52734`，与 `tauri.conf.json` 内置公钥一致
- 签名校验：`prehash=true`、`global=true`；trusted comment 中 `file=PanPan Workbench_1.8.0_x64-setup.exe`、`version=1.8.0`
- 更新清单：`src-tauri/target/release/latest.json`，version `1.8.0`，URL 指向 `v1.8.0/PanPan.Workbench_1.8.0_x64-setup.exe`
- 构建：使用本机 `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PATH` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 环境变量执行 `npm run tauri:build`，退出码 0；10:07 那次无签名构建不是最终候选。

## 安装与数据迁移

- 升级前备份：`E:\02-RUANJIAN\67-盼盼工作台\backups\20261118-1.7.0-pre-1.8.0\{app,data}`，964 文件 / 204.8 MB
- 升级前数据库：`integrity=ok`；`images=23`、`tasks=19`、`thumbnails=23`、`kv=6`、`agent_conversations=0`；SHA256 `B16F4F0B2A73368E132024C515D41319075B15A5B15981EB2D5864A72522BC60`
- clean install：`%TEMP%\pp-u2\clean`，版本 1.8.0、可启动、`data/` 正常生成；静默卸载 `/S` 保留数据
- 1.6.3 → 1.8.0 隔离升级：版本 1.8.0；数据库 SHA256 不变；自定义 marker 保留
- 1.7.0 → 1.8.0 真实升级：退出码 0；exe 版本与注册表 `DisplayVersion` 均为 1.8.0；数据库 SHA256 不变；`images=23` 不变
- 回滚点：1.7.0 安装包与升级前备份均保留
- 收尾复核：真实安装仍为 1.8.0，`integrity=ok`，`images=23`、`tasks=19`、`thumbnails=23`；后续 U2 使用使数据库产生正常写入，当前 SHA256 `2EF581E0976CA1AD81E860EC6F560A90747411A3F23E86C20E17B8DA2AF53547`（升级前后同一时点的哈希未变）。新增 `saved_workflows=3`、`restore_journal=0`、`kv=7`。

## U2 · 真实引擎旅程

- 引擎：`D:\AI\ComfyUI`，8188 有响应；工作流「无损放大」`qwen-upscale`
- 实际提交：ComfyUI prompt `dcafdbb9-a124-4c3b-82f6-897a4e7b10ef`，模型 `RealESRGAN_x4plus.pth`，输出 `upscale_00033_.png`，4096×5468
- 界面结果：右侧「对比图（Image Comparer）」B 图显示生成结果
- 下载：`C:\Users\95720\Downloads\panpan-qwen-upscale-1794970973630.png`，22,999,007 字节，PNG 4096×5468
- 证据：`evidence/s7-u2-workflow-after.png`、`evidence/s7-u2-workflow-result.png`

## U2 · 备份与卸载恢复（隔离安装）

- 备份导出：隔离安装 1.8.0 → 选择「默认地址」→ `downloads\gpt-image-playground-backup_2026-11-18_11-33-49.zip`（1,361 字节），界面提示「已导出到 …」
- 恢复导入：选择该 ZIP → 确认「替换所选数据」→ 提示「备份已替换恢复」，并生成删除快照
- 卸载保留数据：`uninstall.exe /S` 后 exe 删除、`data/data.db` 保留
- 卸载删除数据：GUI 勾选「删除应用数据」后 `data/` 整体删除，`downloads/` 中的备份 ZIP 保留（与勾选框文案一致）
- 重装恢复：再装 1.8.0 生成全新 `data/`；从保留的 ZIP 再导入一次，提示「备份已替换恢复」
- 证据：`evidence/s7-backup-export.png`、`evidence/s7-backup-restore.png`、`evidence/s7-reinstall-restore.png`

## Known limits（未做 / 受阻，不记为通过）

1. **真实安装的“导出数据备份”被已有数据阻断**：界面提示「导出失败，有 2 张工作流结果图不在图片库中，备份会缺图，已中止。」。该状态在应用重启后仍存在，属于已保存工作流引用了结果图存储中不存在的图片；按冻结规则未改源码。隔离干净数据下导出/恢复已全部通过。证据：`evidence/s7-export-known-limit.png`。建议后续版本在备份时对缺图工作流改为“跳过并提示”而不是整体中止，或提供清理入口。
2. **updater 真实更新安装/回滚未做**：`GIP_UPDATER_ENDPOINT` 仅在 debug 构建生效；发布锁未授权，不能发布 1.8.1 测试源。已在真实 1.8.0 校验签名、版本绑定与 `latest.json` 一致性。需要做真实更新演练时，须先获得发布授权并发布一个新版本。
3. **签名私钥离线备份未建**：私钥与密码目前只在 `%TEMP%\panpan-updater.key`、`%TEMP%\panpan-updater.password`，未在仓库或提交物中。需用户指定离线保管位置并自行保管密码；丢失后只能生成新密钥并要求所有客户端重装。
4. **云端生图与两条 qwen 流程 UI 取证跳过**：按用户要求不使用生图中转站 Key；本地引擎的 U2 已完成。
5. 工作流界面上的历史记录仍为会话内状态，重启后清空；但“已保存工作流”引用的结果图 ID 会持久化，引用缺失时会阻断备份导出（见第 1 条）。这是既有行为，非本批引入。

## 停止位置

- 真实安装保持 1.8.0，升级前数据备份完整，无源码改动。
- 等待用户明确发布授权后才可 push / 打 tag / 上传 Release；在此之前不再改动产物。
