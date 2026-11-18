# B02-UI-FIX 报告

- 日期：2026-11-07
- 分支：`b02`
- 范围：用户确认的 7 项 UI/交互修复
- 约束：未改底层生图 API、未换数据库、未重写 React Flow/tldraw；未安装客户端、未触碰真实数据

## 结果

7 项全部完成。Vitest 84 文件 / 1021 用例通过，Rust 105 用例通过，`npm run build`、`npm run tauri:build` 通过。

- 候选：`src-tauri/target/release/bundle/nsis/PanPan Workbench_1.0.0_x64-setup.exe`
- SHA256：`F0D22C5C9D13F0F85391DD30479060E5B05412BEC4C775E271266F04A1580CAA`
- 大小：30,237,718 字节（28.83 MiB）
- 未安装

## 逐项结果

### 1. 拖拽遮罩/重复处理（P0）

- 只保留 `CanvasBoard` 一个外部文件 drop 入口；`StudioShell` 的 window `drop` 只复位遮罩，不再调用 `addImageFromFile`。
- `CanvasBoard` 文件分支 `stopPropagation`，多文件串行处理，不再 `Promise.all` 并发解码。
- 处理期间通过 `onPendingChange` 置 pending，底部/右侧提交按钮禁用。
- 单张失败只提示，不创建节点、不放置落点。
- 大图先压缩再入库：超过 20MB 或最长边超过 8192px 时，先缩到最长边 4096px 并重新编码；压缩后仍超限才拒绝。
- 遮罩复位覆盖 `dragend`、`drop`、`blur`、`Esc`、拖出窗口、1.5 秒无 `dragenter` 超时，以及画布 drop 的自定义复位事件。
- 测试：画布节点去重、串行/失败不置节点、删除后缺失标记、输入删除不影响画布。

### 2. 三个大按钮

- `StudioShell` 的 `enabledActivities` 恢复为 `['projects', 'workflow', 'skills']`。
- `AppSidebar` 恢复工作流/技能库按钮；点击显示“正在开发，敬请期待”，不再恢复 Comfy/SkillHub 大页面。
- 侧栏不再因切换功能自动折叠。
- `B02-CHECKLIST` 的 P1-42/P2-18 改为“保留占位入口”。

### 3. 左上角回上一版

- 删除 `TitleBar.tsx` 中 B02-3 新增的 C logo，恢复 `[折叠][应用][编辑]` 顺序。
- `AppSidebar` logo 恢复 16px（28px 框）。

### 4. 缩放/全览/视图切换

- 画布缩放 `−`、百分比、`+`、全览固定右下；去掉 `1rem + bottomInset` 的 16px 双抬升，只按输入台实际高度避让。
- `--input-bar-clearance` 不再额外加 12px。
- 画布/九宫格视图切换统一到右上；九宫格底部重复切换器移除，改到卡片头部右上。

### 5. 全局放大 + 界面缩放

- 新增持久化设置 `uiScale`：100/110/125/150，默认 100。
- 设置页“通用 → 界面缩放”可切换；`useUiScale` 写入 `--ui-scale` 与 `data-ui-scale`。
- `.ui-scale-chrome` 只包 UI 外壳（标题栏、侧栏、底栏、右侧抽屉、九宫格、视图切换、弹窗层），画布世界坐标和节点尺寸不读取缩放值。
- 追加全局字号/图标/按钮下限覆盖：9/9.5→12、10/10.5→12.5、11→12.5、11.5→13、12→13.5、12.5→14，正文 13.5；图标 12→14、14→16、16→18；按钮最小高度 30–32。
- 窄窗下 `ui-scale-chrome` 限制最大宽度，避免横向溢出。

### 6. 参考图落画布（核心）

- 新增 `CanvasImageNode`（id/imageId/x/y/w/h/z）与 `ProjectCanvas.imageNodes`。
- 画布图片节点与任务节点共用坐标、缩放与框选；支持拖动、右下角缩放、选中、Delete 删除、右键“设为参考图/删除素材”。
- 图片节点支持 normalize、持久化、导出/导入合并、删除快照与 GC 引用收集；切换画布后节点保留。
- 外部文件 drop：串行入库后同时加入输入选择并在落点创建图片节点。
- 输入框/历史卡片/参考图架拖到画布：已有节点则聚焦选中，没有则创建节点并加入选择。
- 输入框删除只取消选择，画布节点保留。
- 画布删除图片节点时把 imageId 记入 `removedImageIds`；输入框对应项显示“素材已删除”灰块并阻止提交。
- 删除任务时，若其输出正被选为参考图，同样标记缺失。
- 重新拖入同一图像会清除缺失标记。
- 旧画布无 `imageNodes`/`removedImageIds` 时不迁移、不误判缺失。
- MCP `canvas.list` 返回 `imageNodeCount`、`imageNodeIds`、`imageIds`，不返回路径。
- 测试：同一图像只建一个节点、删除后输入缺失、输入删除不影响画布、切换画布节点保留、持久化包含图片节点。

### 7. 生图后输入不变

- 移除 `submitTask` 中按 `clearInputAfterSubmit` 清空提示词/参考图的旧逻辑。
- 提交只新增任务与画布输出节点，不追加 `@图1`、不把输出加入 `inputImages`、不改参考图顺序。
- 设置页原开关改为静态说明“提交后保留输入”。
- 测试：批量全部成功后 prompt 与 inputImages 保持不变；停止批量后输入也保持原样。

## 复审修复

1. 删除快照/导出漏 imageNodes 图片
   - `collectReferencedImageIds` 统一收集 `canvas.imageNodes[].imageId`。
   - `createDeleteSnapshot`、`exportData` 的缺图预检随之覆盖图片节点；快照 ZIP 与导出 `imageIds` 包含节点图片。
   - 新增测试：只含图片节点、无任务的画布删除快照包含图片并保留 `imageNodes`；节点图片缺失时拒绝删除。
   - `trimWorkspaceForDelete` 对画布/项目范围保留画布及其 `imageNodes`；任务范围保留涉及画布。

2. 所有加图路径接入 pending
   - 新增 store 级 `pendingInputs` 与 `withInputPending`，`try/finally` 复位。
   - 文件选择、粘贴、CanvasBoard 文件 drop、`application/x-studio-image` drop、`addImageFileToCanvas`、链接添加、画布选择、编辑输出、MCP attach 全部纳入。
   - 多文件串行；提交按钮和 `submitTask` 在 pending 期间阻止。
   - 新增测试：延迟两个文件入库后立即提交，任务包含全部参考图；pending 期间直接 submit 不创建任务。

3. submitTask 统一校验缺失素材
   - `submitTask` 在确定目标画布后检查 `removedImageIds` 与当前参考图交集，命中即中止并提示。
   - 底部、右侧、键盘提交都走 `submitTask`；MCP `task.create` 复用同一入口，空结果返回失败，不创建任务。
   - 新增测试：缺失图片直接 submit 不创建任务；清除 `removedImageIds` 后可正常提交。

顺手：`fitAll`、Ctrl+0 与自动布局已把 `imageNodes` 纳入 `allRects`。

## 发布部分

### 自动更新

- 后端继续使用 `tauri-plugin-updater`，新增 `update_check` 命令；前端使用 `@tauri-apps/plugin-updater` 2.13.3 与 Rust 版本对齐。
- `tauri.conf.json` 写入 GitHub Releases 的 `latest.json` 地址和新生成的 updater 公钥；`createUpdaterArtifacts` 开启。
- 左下角显示 `v1.0.0`，点击检查；启动后延迟 4 秒自动检查一次；Web 版不显示入口。
- 状态覆盖检查中、已是最新、发现新版本（确认后下载）、下载进度、已下载待重启安装、失败/重试。
- 私钥在仓库外 `%TEMP%\panpan-updater.key`，密码同样只在 `%TEMP%`；公钥写入配置，未提交私钥。
- 新增 `npm run updater:manifest` 生成 `latest.json`；本次已生成到 `src-tauri/target/release/latest.json`。
- 测试：版本比较、状态机、无更新/有更新、下载/安装命令的模拟分支。

### 公开发布材料

- README 重写为“盼盼工作台”，删除上游徽章、`cooksleep.dev`、GHCR 上游镜像、JuCodex 推广和上游演示链接；保留特惠 API 预置与注册链接。
- `package.json` 补 MIT、author、repository。
- `LICENSE` 保留上游版权并补 fork 版权；新增 `SECURITY.md` 和 `.github/workflows/build.yml`。
- 重新生成 `src/assets/third-party-notices.txt`（Rust 336、npm 244），包含 `rmcp`/`axum`；`about.toml` 已接受 MIT/Apache-2.0。
- 本轮不移动 `docs/execution`、真实截图或真实路径。

## 验证

- `npm run build`：通过
- `npm test`：84 文件 / 1021 用例通过
- `cargo test`：105 用例通过
- `npm run tauri:build`：通过（未安装）
- 开发服务器界面自检：三按钮可见、工作流占位、界面缩放选项可见、视图切换位于右上

## 已知限制

- 真实拖拽/文件选择、右键菜单、画布节点拖动缩放未做自动化点击回归，需要 U2 手工验证。
- 图片大图压缩使用主线程 canvas，极端超大图仍可能有短时卡顿；已限制重新编码后的最长边 4096px。
- 界面缩放使用 CSS `zoom`，只作用于 Studio 外壳；设置页和独立弹窗仍按默认字号，不随该设置放大。
- 触屏 44px 目标未全量强制，仅放大了主要按钮与图标。
- 窄窗 960 与 125%/150% DPI 只做了编译与布局规则检查，未逐项截图回归。
- 旧画布参考图不迁移为图片节点，仍按原样保留。
- MCP `canvas.list` 的结构有变更（只返回画布摘要与节点 ID），未更新外部客户端示例。
- 自动更新只在本地验证签名产物、`latest.json` 与模拟分支；真实 GitHub Release 端到端升级未验证。
- 更新私钥与密码只保存在本机 `%TEMP%`，丢失后无法为后续版本签名。
- 安装包无 Authenticode 签名；本轮未安装、未做干净 VM 覆盖升级/卸载验证。
- 公开仓库仍需重写历史并移除内部执行文档与真实截图；本轮未提交这些文件。


## v1.0.0 UI/发布第一批（2026-11-07）

### 1. 生成状态与真实比例

- 任务节点按 `actualParams.size` / `params.size` 计算比例，缩略图 `object-contain`；极端长图节点高度按 `MIN_HEIGHT=180` / `MAX_HEIGHT=640` 限制。
- 生成中显示模糊骨架/模糊图、共享每秒 tick 的 `mm:ss` 计时和“生成中”；完成后 420ms blur-up。
- 失败节点整图红色半透明遮罩、大 X、悬停错误摘要、复制错误和重试；点 X 不打开详情，其他区域仍可双击详情。
- 生成中/失败即使没有最终图也用请求 size 做占位框。

### 2. 蓝色画布动效

- 复用原型 `stitch-dot-highlight` 思路，在 `CanvasBoard` 增加 `canvas-blue-glow`：蓝色径向光晕、小圆点跟随；rAF 写 CSS 变量，不每帧 setState；离开淡出；`prefers-reduced-motion` 下隐藏；层为 `pointer-events-none`。

### 3. @ 编号与蓝色 mention

- Studio 底部/右侧输入台新增 `PromptMentionOverlay`，`@图N` 蓝色显示并保留下划线；textarea 透明文字、光标可见。
- 参考图架、图片节点、输入框统一 `图1/图2`。
- 排序/删除/替换沿用 `remapImageMentionsForOrder` 同步改号。

### 4. 下载与节点底栏

- 画布任务节点、图片节点、九宫格卡片支持下载；多输出任务提供第 1/2/3 张菜单；文件名清洗；读取失败 Toast。
- 任务节点底部渐变改为半透明深色玻璃底 + 蓝色柔光描边/外发光。

### 5. 默认项目/画布删除

- `normalizeWorkspace` 不再补回默认项目/画布；显式空数组保持空工作区。
- store 删除默认项不再拦截，也不再自动创建替代画布。
- 删除当前项时切到剩余项；没有剩余时项目/画布区域显示“新建项目/新建画布”空状态。
- 删除仍走确认、ZIP 快照和设置页“最近删除快照”恢复入口。
- 兼容导入、任务归属回退和 MCP 空画布列表。

### 6. 尺寸预设

- 保留“自动”，新增 1K 16:9 1280×720、1K 9:16 720×1280、2K 16:9 2560×1440；标签显示比例+像素。
- 画布节点按新比例显示；旧任务不迁移；接口归一化后尺寸变化时提示“已回退”。

### 7. 共享工具栏

- 新增 `StudioViewToolbar`，画布和九宫格共用搜索、状态筛选、只看收藏、多选、全选、批量收藏/下载/删除、选中数量/清除、视图切换，固定在右上。
- 画布使用同一 `filteredTasks`，参考图节点始终可见；九宫格内部重复工具栏/视图切换已移除，背景改纯色；画布保留点阵。
- 切换视图保留 query/status/favorite 状态。

### 8. 设置齿轮、About、旧模式

- 左下角设置改经典齿轮，悬停蓝色高亮。
- About 顶部只显示产品名、版本、开发者：盼盼盼2222；删除醒目的原作者/AI Agent 警告块；保留不显眼的开源许可和第三方许可。
- 旧画廊评审结论：旧画廊仍有“收藏夹集合管理/集合视图”（`FavoriteCollectionsView`、`ManageCollectionsModal`）未被 Studio 覆盖，按用户“能力未覆盖先报告不要盲删”的要求，本轮保留 `studioShellEnabled` 开关和旧模式，未删除代码。

### 9. 版本与字体

- 版本统一升到 1.0.0：`package.json`、`package-lock.json`、`Cargo.toml`、`Cargo.lock`、`RELEASE.md`、`public/sw.js`。
- 内置字体改为随安装包分发，移除 `fontsapi.zeoseven.com`/`cdn.jsdelivr.net` 与相关 CSP；字体许可证保留在第三方许可清单。

### 10. 低成本优化

- 删除任务/画布/项目 Toast 增加“查看快照”，跳到设置的数据页恢复入口。
- 任务节点标“成品”、图片节点标“素材/图N”。
- 错误信息可复制。
- 首次关闭到托盘发送一次系统通知提示。

### 验证

- `npm run build`、`npm test`（84 文件 / 1021 用例）、`cargo test`（105）、`check-tauri-acl`（72 命令）、`release-check`、带 updater 签名的 `npm run tauri:build`。

### 本轮已知限制

- 旧画廊因收藏夹集合能力未覆盖而保留，未按原计划删除。
- 蓝色光效/模糊揭示未做真实点击 U2；rAF/CSS 变量逻辑通过编译与单元回归。
- @ mention 使用透明 textarea + overlay，极端长文本滚动同步为近似，未做 IME 实机回归。
- 删除后 Toast 的“查看快照”跳转到设置数据页，不是直接弹恢复对话框。
- 托盘首次提示依赖系统通知权限，权限未授予时不显示。


## 复审修复：筛选选择与空工作区

- 筛选后隐藏任务：CanvasBoard 按可见任务 ID 裁剪 selectedIds，图片节点选择独立保留；StudioShell 批量操作只取 filteredTasks 与 selectedTaskIds 的交集。测试覆盖 query/status/favorite 隐藏后 Delete/批量收藏/下载/删除不包含隐藏任务。
- 空工作区/导入：移除 mergeImportedWorkspace 的逐项目补画布；activeCanvas 必须属于 activeProject，否则为空；resolveTaskOwnership 对有效 projectId 保留项目，缺少同项目画布时 canvasId 置空，不改投其他项目。测试覆盖 A 无画布 + B 有画布时的导入与任务归属。
- CanvasBoard 自动 fit 已统一使用 allRects；长图节点高度口径统一为 MIN_HEIGHT=180 / MAX_HEIGHT=640。


## v1.0.0 第二批：技能库与工具增强

- 技能库 V1：`PromptSkill` 全局数据；Tauri 使用 `panpan-prompt-skills-v1` kv，Web 使用 localStorage；不保存 Key/路径/参考图。
- 左侧技能库入口打开画布区域内的技能库视图：搜索、分类/标签、最近/置顶/名称排序、新建、卡片使用/编辑/删除/置顶、空状态。
- 保存入口：输入台“存为技能”、画布任务右键/操作栏“保存为技能”；可编辑名称/标签/分类/提示词，参数可选。
- 使用技能：当前提示词非空先确认，替换提示词并应用尺寸/质量/数量/可匹配模型；不自动提交、不改参考图。
- 共享工具栏新增模型筛选，和搜索/状态/收藏组合；画布与九宫格一致，参考图节点始终可见。
- 首次画布使用提示（拖图/参考图/技能库）只显示一次，可关闭；批量下载显示 done/total 并禁用重复点击。
