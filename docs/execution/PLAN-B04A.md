# PLAN-B04A — 1.0.2 纠偏批

- 版本：v1.0.2（候选）
- 日期：2026-11-10
- 目标：先把“点了没反应/误删/假入口”清掉，给一个可安装的 1.0.2；不做双视图大重构、不做技能库重构。
- 依据：`OPINIONS-SUMMARY-20261110.md`、backlog C2/U6/W1、架构预审意见。
- 原则：小批、可安装、安装版验证；B04B 的底座/技能重构不混进来。

## 1. 范围

### 做

- **C2 下载统一**：所有单图/批量下载入口走同一条链路；Tauri Windows 走 `saveFile()`，Web 保留浏览器下载；取消不报错。
- **U6 空白取消素材选中**：空白点击同时清任务选中、素材选中、图片菜单。
- **W1 恢复工作流**：恢复「工作流」入口/路线图页；从侧栏移除「Lovart 技能」页（组件保留，B04B 重做）。
- **技能命名**：用户界面不再出现 Lovart；当前只做移除/改名，不做技能库结构。
- **安装 1.0.2**：签名构建、备份、安装、安装版验证。

### 不做（B04B）

- TaskAction/Selection 抽象、双视图 parity。
- Skill/SkillSlot、chip、技能库两 Tab、封面、底部选用技能。
- C1/C5/U1/U2（B04B）。
- M1–M4、S1/S2/S3/S5、E7、macOS、公开 Release。

## 2. 下载入口矩阵（必须逐项验证）

| # | 入口 | 当前实现 | B04A 处理 |
|---|---|---|---|
| 1 | 画布任务节点 `CanvasTaskNode` | `downloadImage()`（`<a download>`） | 改走统一 `saveTaskImage`/`downloadImageIds` |
| 2 | 画布素材节点 `CanvasBoard` | `downloadImage()` | 同上 |
| 3 | 九宫格卡片 `CardGridView` | `downloadImage()` + `imageUrl` fallback `<a>` | 两条都统一 |
| 4 | 右侧抽屉 `RightGeneratorDrawer` | `<a download>` | 统一 |
| 5 | 图片详情 `ImageDetailModal` | `<a download>` | 统一 |
| 6 | 任务详情 `DetailModal` | `downloadImageIds()` | 已走 saveFile，验证取消/失败 |
| 7 | 图片右键 `ImageContextMenu` | `downloadImageIds()` | 验证多选/批量 |
| 8 | 输入台/Agent 批量 | `downloadImageIds()` + `pickSaveDir()` | 验证只弹一次目录框 |
| 9 | 画布 artboard `StudioShell` | `downloadImage()` | 统一 |
| 10 | 其它 `<a download>` 搜索残留 | grep `a.download` | 逐个收口，目标业务组件 0 处（`saveFile.ts` Web 路径豁免） |
| 11 | `StudioShell.batchDownload`（选中任务批量） | 逐张 `downloadImage()` | 一次 `pickSaveDir` + `downloadImageIds`；`onProgress`；取消不报错 |

## 3. 冻结决策

1. **C2 只承诺 Windows**：`saveFile` 的 `save_file` 目前是 `GetSaveFileNameW`；非 Windows 返回“不支持”。macOS 不在本批。
2. **取消 ≠ 失败**：保存对话框取消时静默返回；只有真实读写错误才 Toast。
3. **批量只弹一次目录框**：多图走 `pickSaveDir` + `downloadImageIds`，不逐张弹保存框。
4. **W1 工作流保留**：不删除、不替换；Lovart 页面从侧栏移除，代码保留到 B04B 重做。
5. **不改技能数据结构**：本批不迁移 PromptSkill、不新增 Skill；B04B 再做。

## 4. 阶段与验收

### S1 下载统一（A）

- 扩展/统一 `downloadImage`：Tauri 走 `saveFile`，Web 走浏览器下载；统一返回 `DownloadImagesResult`（见 §9.1），并增加 `onProgress(done,total)` 可选回调。
- 统一矩阵 1–5、9 的入口；6–8 验证；搜索并清掉残留 `<a download>`。
- 多输出任务保留“选第几张”；批量走 `downloadImageIds` + `pickSaveDir`。
- 验收：安装版逐入口点击，真实落盘；取消不报错；多图只弹一次目录框；文件名清洗；`gate:dev`。

### S2 U6 + W1 + 命名（C）

- U6：`CanvasBoard.handlePointerUp` 无位移分支清 `selectedIds`、`selectedImageIds`、`imageMenu`。
- U6 E2E：选中素材 → 点空白 → Delete 不弹删除框；Esc 仍可清空。
- W1：恢复 `workflow` 入口/路线图页；`AppSidebar` / `StudioShell` 移除 `lovart` 活动；`LovartSkillLibraryView` 不再渲染。
- 命名：用户界面不出现 Lovart；技能入口先回到“技能库（现有 PromptSkill）”状态。
- 验收：U6 E2E；W1 入口存在；无 Lovart 用户文案；`gate:dev` + `e2e`。

### S3 构建/安装（A）

- 版本升 1.0.2；`gate:dev`、`e2e`、`cargo test`。
- 备份 data + app；`quick_check` + tasks/images 计数；签名构建；静默安装。
- 安装版验证：矩阵 1–11 下载、U6、W1、数据 pre/post 一致。
- 产出 `GATES-B04A.json`、`REPORT-B04A.md`、`CHECKPOINT` 更新。

## 5. 架构预审重点（A/C）

- 下载链路是否覆盖所有入口；取消/失败/成功三态是否清楚；批量是否只弹一次。
- `saveFile` Windows-only 的边界是否写清；macOS 是否明确不在本批。
- W1 恢复是否与技能入口解耦；是否误删技能数据。
- U6 是否只清选中、不破坏框选/多选。
- 安装/回滚是否可执行；旧 1.0.1 包是否保留。

## 6. 阻塞定义

- 丢数据/损坏数据；
- 泄漏 Key/token/敏感路径；
- 构建、安装、启动、MCP 不可用；
- 下载入口仍有死路/取消被当失败/批量逐张弹框。

## 7. 已知限制

- macOS 保存对话框未实现。
- 技能库交互仍是旧 PromptSkill 页面；Lovart 页面暂时下线，B04B 重做。
- C1/C5/U1/U2、M1–M4、S1/S5 不在本批。

## 8. 回滚

- 代码：本批提交；安装前记录 HEAD。
- 数据：`b04a-pre-install-<date>` 备份 data + app；保留 1.0.1 安装包 + `.sig`。
- 版本：1.0.2 失败回到 1.0.1；不重建同号。

## 9. 架构预审修订（v2，2026-11-10）

第一轮架构预审结论：`ARCH_REVIEW=CONDITIONAL` / `PLAN_REVIEW=REJECT`。已按以下方式修订，第二轮只做定向验证。

### 9.1 下载契约冻结

- `downloadImage` 不再返回 boolean，统一返回 `DownloadImagesResult`（`successCount/failCount/canceled/location/error`）。
- `downloadImage(imageIdOrUrl, fileNameBase, index?)` 作为 `downloadImageIds([...], fileNameBase)` 的薄包装；支持 imageId、`data:`、`http(s)`。
- 取消：`canceled=true`，调用方静默返回；失败：`failCount>0` 且保留 `error`；成功：`successCount>0` 且 `location`。
- 批量：`StudioShell.batchDownload` 改为先 `pickSaveDir` 一次，再 `downloadImageIds`；不逐张弹保存框；取消不弹失败 Toast。

### 9.2 入口矩阵补充

- 新增第 11 项：`StudioShell.batchDownload`（选中任务批量）。
- 目标：业务组件 0 处 `<a download>`；`saveFile.ts` 的 Web 下载路径是唯一豁免。
- `CardGridView` 的 `imageUrl` fallback、`RightGeneratorDrawer`、`ImageDetailModal` 都走同一包装，不再直接创建 `<a>`。

### 9.3 文件名与非 Windows

- 统一使用 `sanitizeFileNamePart`，补充 Windows 保留名（CON/NUL/COM1…）和尾随点/空格兜底；失败时自动重命名，不直接报错。
- Tauri 非 Windows 显式判断：只承诺 Windows；非 Windows 返回“当前平台暂不支持系统保存对话框”，不伪装成浏览器下载。

### 9.4 W1 视图契约

- 新增 `WorkflowView`（路线图页，非空内容），`StudioShell` 增加 `activeActivity === 'workflow'` 渲染分支，`AppSidebar` 恢复 workflow 按钮。
- 验收不是“按钮存在”，而是“点击后渲染非空路线图页，且全 UI 无 Lovart”。

### 9.5 失败注入与回滚

- S1 必做失败注入：取消、读取失败、默认保存目录不可用、目录不可写；每条有证据。
- 1.0.1 安装包与 `.sig` 复制到备份目录并登记 SHA256，避免 `cargo clean` 丢失。
