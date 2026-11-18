# B04A 执行清单（1.0.2 纠偏批）

- 日期：2026-11-10
- 总方案：`PLAN-B04A.md`
- 状态口径：`[ ]` 未做 / `[~]` 进行中 / `[x]` 已验证 / `[-]` 本批不做

## S1 下载统一（A）

- [x] S1-1 统一 `downloadImage`：Tauri Windows 走 `saveFile`，Web 走浏览器下载。
- [x] S1-2 下载结果区分成功/取消/失败；取消静默，不报“图片读取失败”。
- [x] S1-3 `CanvasTaskNode` 单图/多输出下载接入统一链路。
- [x] S1-4 `CanvasBoard` 素材节点下载接入统一链路。
- [x] S1-5 `CardGridView` 卡片下载 + `imageUrl` fallback 接入统一链路。
- [x] S1-6 `RightGeneratorDrawer` 下载接入统一链路。
- [x] S1-7 `ImageDetailModal` 下载接入统一链路。
- [x] S1-8 `StudioShell` artboard 下载接入统一链路。
- [x] S1-9 `DetailModal` / `ImageContextMenu` / `InputBar` 批量验证取消、多选、目录框。
- [x] S1-10 搜索并清掉残留 `<a download>`（目标 0 处业务下载）。
- [x] S1-11 安装版逐入口验证：矩阵 1–11（含 `StudioShell.batchDownload`）、真实落盘、取消不报错、多图只弹一次目录框、文件名清洗。
- [x] S1-12 `StudioShell.batchDownload`：先 `pickSaveDir` 一次，再 `downloadImageIds`；`onProgress` 进度；取消不弹失败 Toast。
- [x] S1-13 单测锁三态：取消 `canceled=true`、读取失败 `failCount=1` 且保留原因、多图目录框恰好 1 次、传 dir 时 0 次；调用方层断言一次流程总目录框次数。
- [x] S1-14 文件名保留名/尾随点空格兜底；非 Windows 显式“不支持”提示。
- [x] S1-15 失败注入：取消、读取失败、默认目录不可用、目录不可写；每项留证据；单图走保存文件框、多图走目录框。

## S2 U6 + W1 + 命名（C）

- [x] S2-1 `CanvasBoard.handlePointerUp` 无位移分支清 `selectedIds`、`selectedImageIds`、`imageMenu`。
- [x] S2-2 U6 E2E：选中素材 → 点空白 → Delete 不弹删除框；Esc 仍可清空。
- [x] S2-3 恢复 `workflow` 入口/路线图页；不删除。
- [x] S2-4 `AppSidebar` / `StudioShell` 移除 `lovart` 活动；`LovartSkillLibraryView` 不再渲染。
- [x] S2-5 用户界面不出现 Lovart；技能入口回到现有 PromptSkill 技能库。
- [x] S2-6 S2 验收：U6 E2E + W1 入口 + 无 Lovart 文案 + `gate:dev`/`e2e`。
- [x] S2-7 新增 `WorkflowView` 路线图页（非空），`StudioShell` 增加 workflow 渲染分支。
- [x] S2-8 验收：点击“工作流”渲染非空路线图页，不是空白/占位坏页。
- [x] S2-9 失败注入：故意破坏 WorkflowView/U6 清选中，E2E 必须红；恢复后绿，留证据。

## S3 构建/安装（A）

- [x] S3-1 `npm run gate:dev` 通过。
- [x] S3-2 `npm run e2e` 通过。
- [x] S3-3 `cargo test --manifest-path src-tauri/Cargo.toml` 通过。
- [x] S3-4 版本升 1.0.2（package/lock/Cargo/lock/sw/RELEASE）。
- [x] S3-5 备份 data + app；`quick_check` + tasks/images 计数。
- [x] S3-6 签名构建 1.0.2；记录 SHA256 + `.sig`。
- [x] S3-7 静默安装；注册表 1.0.2。
- [x] S3-8 安装版验证：下载矩阵 1–11、U6、W1、数据 pre/post 一致。
- [x] S3-9 更新 `CHECKPOINT.md` / `GATES-B04A.json` / `REPORT-B04A.md`。
- [x] S3-10 1.0.1 安装包 + `.sig` 复制到备份目录并登记 SHA256。
- [x] S3-11 1.0.2 安装失败可回退 1.0.1；data 计数与 `quick_check` 一致。
- [x] S3-12 失败注入：故意使 1.0.2 安装失败（或使用回滚包），验证 1.0.1 回退、数据 quick_check/计数一致，留证据。

## 本批不做

- [-] TaskAction/Selection、双视图 parity、Skill/SkillSlot、chip、技能库两 Tab、封面、底部选用技能（B04B）。
- [-] C1/C5/U1/U2（B04B）。
- [-] M1–M4、S1/S2/S3/S5、E7、macOS、公开 Release。
