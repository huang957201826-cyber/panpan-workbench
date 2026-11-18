# REPORT-B04A — 1.0.2 纠偏批

- 日期：2026-11-10
- 版本：`1.0.2`
- 提交：`153476eebd466b9d0813c9cd4100a13f76eed2f1`
- 方案：`PLAN-B04A.md`，SHA256 `CDB551B680407497345FB3E7008AEDDE2F4F28933F45761FAD89747FA528CCBD`
- 结论：C2 下载、U6 空白取消、W1 工作流恢复、Lovart 入口移除均已完成，1.0.2 已安装并验证。

## 1. 本批改动

### 下载链路

- `src/lib/downloadImage.ts` 改为 `downloadImageIds` 的薄包装，单图与多图共用同一条保存链路，支持 imageId、`data:`、`http(s)`。
- `src/lib/downloadImages.ts` 统一三态：`successCount` / `failCount` / `canceled` / `location` / `error`；新增逐图进度回调；目录选择失败与 ZIP 写入失败都返回原因，不再抛未处理异常。
- `CanvasTaskNode`、`CanvasBoard`、`CardGridView`、`RightGeneratorDrawer`、`ImageDetailModal` 全部改走统一包装；取消时静默，失败时提示原因。
- `StudioShell.batchDownload` 改为一次 `pickSaveDir` + 逐任务 `downloadImageIds`，不再逐张弹框，并显示逐图进度。
- `sanitizeFileNamePart` 增加 Windows 保留名（CON/NUL/COM1…）、尾随点/空格兜底；业务组件中 `<a download>` 已清零，仅 `saveFile.ts` 的网页版下载保留。

### U6 / W1 / 命名

- `CanvasBoard.handlePointerUp` 无位移分支同时清 `selectedIds`、`selectedImageIds`、`imageMenu`。
- 新增 `WorkflowView` 路线图页；`AppSidebar` 恢复「工作流」入口，`StudioShell` 增加 workflow 渲染分支。
- 侧栏移除「Lovart 技能」；`LovartSkillLibraryView` 不再渲染，技能入口回到现有「技能库」。用户界面无 Lovart 文案。

## 2. 下载入口矩阵

| # | 入口 | 处理 | 验证 |
|---|---|---|---|
| 1 | 画布任务节点 | 统一 `downloadImage` | E2E 画布节点下载通过；与详情共用同一函数 |
| 2 | 画布素材节点 | 统一 `downloadImage` | 代码走同一函数；U6 同画布验证 |
| 3 | 九宫格卡片 | 统一 `downloadImage`，移除 `imageUrl` 手写 `<a>` | E2E 卡片下载通过 |
| 4 | 右侧抽屉 | 统一 `downloadImage` | 代码走同一函数 |
| 5 | 图片详情 | 统一 `downloadImage` | 安装版真实保存对话框，落盘 1,998,545 B |
| 6 | 任务详情 | `downloadImageIds` | 单测取消/失败三态 |
| 7 | 图片右键 | `downloadImageIds` | 单测取消/失败三态 |
| 8 | 输入台/Agent 批量 | `downloadImageIds` + 一次目录框 | 单测目录框次数 |
| 9 | 画布 artboard / 批量 | `StudioShell.batchDownload` | 安装版一次目录框，2 个文件落盘 |
| 10 | 残留 `<a download>` | 业务组件 0 处 | grep 通过 |
| 11 | 选中任务批量 | 一次 `pickSaveDir` + 逐任务下载 | 安装版验证通过，进度逐图推进 |

## 3. 门禁

| 项 | 结果 |
|---|---|
| `npm run gate:dev` | 通过；93 文件 / 1086 测试；release-check 1.0.2 |
| `npm run e2e` | 9 条通过（画布交互、下载、参数下拉 5 条、W1、U6） |
| `cargo test` | 105 条通过 |
| 签名构建 | 通过，`.sig` 448 B |
| 安装 | 静默安装退出码 0；注册表与 exe 均为 1.0.2 |

## 4. 失败注入

- U6：移除空白点击的素材清空 → E2E 红；恢复后绿。证据 `docs/execution/evidence/b04a-failure-injection.log`。
- W1：把 workflow 分支替换为空白 `<div />` → E2E 红；恢复后绿。证据同上。
- 下载三态：单测锁定取消 `canceled=true`、读取失败 `failCount=1` 且保留原因、多图目录框 1 次、传 dir 时 0 次。
- 安装版取消：保存对话框点取消 → 对话框关闭，无错误 Toast。
- 回滚：1.0.2 → 1.0.1 → 1.0.2；每一步 `quick_check=ok`，任务 12，图片 15。

## 5. 数据

- 安装前备份：`E:\02-RUANJIAN\67-盼盼工作台\backups\b04a-pre-install-20261110`（data + app + 1.0.1 安装包 + `.sig`）。
- 安装前：12 任务 / 16 图片，`quick_check=ok`。
- 安装后：12 任务 / 15 图片，`quick_check=ok`。
- 差异为 1 张无任何任务引用的孤儿图，应用启动时清理；12 个任务全部完整。

## 6. 产物

- 安装包：`PanPan Workbench_1.0.2_x64-setup.exe`，10,513,977 B，SHA256 `8A3C2B6E840A1B8A4CA68007F5CAD0B3888B9853A89298A9C53F27400A05382A`。
- 签名：`PanPan Workbench_1.0.2_x64-setup.exe.sig`，448 B，SHA256 `76FEAB92564E3C6D72F0E3AF0DEE577645879917E884A93A7F5F5DDAD610922A`。
- 回滚包：1.0.1，SHA256 `4B2708F0008013D64839FDF995F517C127F53FCDE77DAE752438F991AC964403`，已复制到备份目录。
- 证据：`b04a-workflow.png`、`b04a-installed-workflow.png`、`b04a-installed-projects.png`、`b04a-failure-injection.log`。

## 7. 已知限制

- 系统保存对话框仅 Windows 客户端支持，macOS 不在本批。
- 网页版下载跨域图片仍受浏览器 CORS 限制。
- 安装包未做 Authenticode 代码签名。
- 画布任务节点、右侧抽屉、artboard 入口未在安装版逐个点击，但与已点击的详情/批量共用同一 `downloadImage` 函数，并由 E2E 覆盖。
- 技能库仍是现有提示词配方页；技能包与编排交互在 B04B 重做。

## 8. 回滚

1. 关闭应用。
2. 运行 `backups\b04a-pre-install-20261110\PanPan Workbench_1.0.1_x64-setup.exe /S`。
3. 需要时把 `backups\b04a-pre-install-20261110\data` 覆盖回安装目录 `data`。
4. 启动后检查版本 1.0.1、`quick_check=ok`、任务/图片计数。
