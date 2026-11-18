# REPORT — 1.2.1 R9（N55–N57）收口（2026-11-12）

## 范围

- N55：底部输入框宽度以用户截图蓝框为准，`max-w-[1320px]` 自适应；2560 实测 1272px、1440 实测 1053px、1024 实测 637px。
- N56：缩放/全览控件固定在画布右下角；输入台上移让位；1024 右侧停靠时控件右移 360px，避开覆盖式抽屉。
- N57：技能选择器固定 880×640，分类栏与技能列表内部滚动；切换分类外框尺寸不变，技能少时留白。
- 交互修复：输入台透明区域不再拦截画布拖动；自定义尺寸弹窗与技能弹窗补齐指针事件。

## 验证

| 项 | 结果 |
|---|---|
| `npm run gate:dev` | 通过 |
| 单测 | 102 文件 / 1129 通过 |
| E2E | 62 通过 |
| Rust | 107 通过 |
| SAST | 通过 |
| 签名构建 | 通过 |
| 静默安装 | 通过，注册表 `DisplayVersion=1.2.1` |
| 安装后数据 | 18 任务 / 19 图片；`quick_check=ok` |

## 安装

- 安装包：`PanPan Workbench_1.2.1_x64-setup.exe`
- 桌面副本：`C:\Users\95720\Desktop\PanPan Workbench_1.2.1_x64-setup.exe`
- SHA256：`6DFBA7588B3D5F874024ABC356B9B9F42640ABBC3DFF7FFCEE3766648AE6BDEB`
- 大小：10969181 字节
- 双备份：`E:\02-RUANJIAN\67-盼盼工作台\backups\20261112-1.2.1-a`、`-b`
- 回滚：1.2.0 安装包 + 双备份 data/app

## 公开发布

- 公开仓库：`https://github.com/huang957201826-cyber/panpan-workbench`
- 公开快照：`31bbcd1`（`main`），tag/Release `v1.2.1`，非草稿、非预发布。
- 资产：`PanPan.Workbench_1.2.1_x64-setup.exe`（SHA256 `6DFBA7588B3D5F874024ABC356B9B9F42640ABBC3DFF7FFCEE3766648AE6BDEB`，10969181 字节）、`.sig`、`latest.json`。
- 发布方式：公开库 Actions 的 `windows` job 因未配置 `TAURI_SIGNING_PRIVATE_KEY` 被跳过；本次用本地已验证安装包手动上传，保证公开资产与安装验收哈希一致。
- 后续：如需自动构建，需在公开库配置 `TAURI_SIGNING_PRIVATE_KEY` 与 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。

## 复审

- 第一轮 `REJECT`：1024 右侧停靠时缩放/全览被 360px 抽屉覆盖。修复 `rightInset` 偏移，补几何与 `elementFromPoint` E2E。
- 第二轮 `REJECT`：`SizePickerModal` 继承输入台的 `pointer-events-none`，自定义尺寸弹窗点不动。补 `pointer-events-auto` 与关闭 E2E。
- 最终 delta：`CODE_REVIEW=APPROVE`。

## 证据

- 输入框：`r9-input-2560.png`、`r9-input-1440.png`、`r9-input-1024.png`
- 技能选择器：`r9-skill-picker-1440.png`、`r9-skill-picker-1024.png`
- 右侧停靠：`r9-right-dock-1024.png`
- 安装版：`r9-installed-2560.png`

## Known limits

- N52 仍为 🟡：筛选、遮罩编辑器、设置取消没有专用 E2E。
- M2 Gemini、M3 2K/4K、M4 2.6 实际参数仍缺真实 Key/中转站 live 验证。
- N57 技能很少时的留白、详情区内容变化不跳，由固定外框保证，未加专用断言。
- 模型下拉 E2E 改为直接写 store，不再覆盖“写 localStorage 后 reload 仍生效”的路径。
- 保存仍有 check→persist 的极小 TOCTOU 窗口；设置关闭即保存，没有取消按钮。
