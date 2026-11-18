# B02 全量 UI/交互审查（只读，先不改代码）

- 日期：2026-11-07
- 范围：`8f83c20..HEAD`（B02-1B/2/3/4）对用户可见 UI、拖拽、画布、输入台、托盘、设置的影响
- 方法：git diff + 源码逐路径核对 + 已有截图/实测记录；未新增代码改动
- 结论：用户反馈 5 条全部复现/定位；另有 10 条同批风险、4 类删除需确认、9 项 known-limits

## P0：会导致卡死/丢输入/无法退出

### P0-1 拖拽图片进入画布会重复处理同一文件，卡死风险高
- 证据：
  - `src/components/CanvasBoard.tsx:371-400`：画布 `handleDrop` 对 `Files` 执行 `Promise.all(files.map(addImageFromFile))`，且**只对自定义 `application/x-studio-image` 分支 `stopPropagation`，文件分支没有阻止冒泡**。
  - `src/studio/StudioShell.tsx:164-171`：window 级 `drop` 又对同一批文件执行 `for (file) void addImageFromFile(file)`。
  - 结果：拖一张图进画布，至少两次 `addImageFromFile`；多张图时 `Promise.all` 并发 + window 处理器再并发一轮。
  - `src/store.ts:6162-6195`：每张图依次做 `createImageBitmap`、`fileToDataUrl`、`storeImage`；`src/lib/db.ts:127-171` 再做 SHA-256、缩略图 canvas、`putImage`；`src/lib/dbTauri.ts:66-74` 把 dataURL 解码成字节后走 Tauri IPC。
  - 20MB 上限内的一张图会产生约 27MB base64 字符串，重复解码/哈希/缩略图/IPC 两次，WebView 主线程容易长时间无响应。
- 判定：高概率是“卡死”的直接原因；需用大图 + 多图复现确认，但重复处理是确定的。
- 修复方向（待确认后做）：只保留一个 drop 入口；文件分支 `stopPropagation`；串行处理并显示 pending/进度；处理完成前禁用提交。

### P0-2 文件拖入路径没有进入 pending 保护，可能在图片未入库时提交
- 证据：
  - `CanvasBoard.tsx:390-400` 等待文件入库后只调用 `onImageDrop({}, world)`，**没有增加 `pendingInputs`**。
  - `StudioShell.tsx` 的 `onImageDrop` 只有在 `payload.imageId` 分支才 `pendingInputsRef.current += 1`；文件分支直接 toast“已加入参考图，提交时按落点放置”。
  - `src/studio/components/BottomPromptBar.tsx` / `RightGeneratorDrawer.tsx` 的提交按钮只根据 `submitting || pendingInputs > 0` 禁用。
- 判定：拖入图片后立刻点生成，可能任务里没有这张参考图；与用户反馈“拖进去卡死/不对”属于同一链路。
- 修复方向：文件 drop 也纳入 pending；提交前等待所有 pending 完成。

### P0-3 卡死时缺少可退出的兜底
- 证据：
  - `src/studio/StudioShell.tsx:806` 的 `DragUploadOverlay` 是 `pointer-events-none`，不会挡住点击；真正无响应来自主线程重活。
  - `src-tauri/src/lib.rs` / `tauriStorage.ts`：关闭窗口只隐藏到托盘；退出只由托盘“退出”触发，前端 flush 后 `exit_app`，Rust 15 秒兜底。
- 判定：如果 WebView 主线程被拖拽处理卡住，关闭按钮/Alt+F4/tray 退出都可能延迟；用户会感觉“无法退出”。
- 修复方向：拖拽重活移出主线程/分批；托盘退出保留独立兜底；UI 增加“正在处理图片”的明确状态。

## P1：用户可见回归（已确认）

### P1-1 最左侧三个大功能按钮只剩一个
- 证据：
  - `src/studio/StudioShell.tsx:574` 明确传 `enabledActivities={['projects']}`。
  - `src/studio/components/AppSidebar.tsx:59` 默认也只 `['projects']`；`137` 和 `160` 分别用 `enabledActivities.includes('workflow')` / `('skills')` 包住两个按钮。
  - 原默认是 `['projects','workflow','skills','models','engine']`（见本文件 diff）。
- 结论：工作流、技能库两个“开发中”按钮被完全隐藏，不是样式问题。
- 备注：`B02-CHECKLIST` 的 P1-42 原本要求“移除假入口”，开发窗口按清单执行；现在需求变为“保留占位按钮”，需要反向调整清单。

### P1-2 左上角整体右移，标题栏多了 C logo
- 证据：
  - `src/studio/components/TitleBar.tsx:84-87` 在侧栏折叠按钮**之前**插入 22px C logo；原左起顺序是 `[折叠][应用][编辑]`，现在是 `[C][折叠][应用][编辑]`。
  - 22px + `gap-1.5`（6px）使左侧所有菜单整体右移约 28px。
  - `src/studio/components/AppSidebar.tsx:114` 的 logo 从 `size={16}` 改为 `size={22}`。
- 结论：用户看到的“左上角 UI 位置被改了很多”主要来自这两处。
- 待确认：C logo 是否必须放在最左；若保留，可移位到菜单右侧或只保留侧栏 logo。

### P1-3 右下角缩放百分比/全览按钮被抬高，不在最底部
- 证据：
  - `src/components/CanvasBoard.tsx:507-509`：工具栏 `absolute right-4`，`bottom: calc(1rem + ${bottomInset}px)`。
  - `src/studio/StudioShell.tsx:84-87`：`bottomInset = 底部输入栏 offsetHeight + 12`。
  - `src/studio/StudioShell.tsx:694-698`：底部输入栏本身 `absolute bottom-1.5`（6px）。
  - 实际偏移 = 16 + (输入栏高度 + 12) = 输入栏高度 + 28px；比输入栏顶部还高约 22px，所以看起来悬空。
- 结论：这是 B02-2 为避免输入栏遮挡而加的 inset；行为本身可解释，但视觉上确实不在最底部。
- 待确认：期望是“输入栏上沿紧贴”还是“画布容器右下角固定”。两种修法不同。

### P1-4 字号没有按清单放大
- 证据：`docs/execution/B02-CHECKLIST.md:90` 明确 `[-] P1-31/P1-36`，未做。
- 当前仍有大量小字号：
  - `text-[9px]` 5 处、`text-[10px]` 18 处、`text-[10.5px]` 11 处、`text-[11px]` 8 处（`src/**/*.tsx` 统计）。
  - 例：`TitleBar.tsx:80` 12px；`BottomPromptBar.tsx:441` 12px、`:462/:493` 10.5px；`CardGridView.tsx:221` 11.5px、`:224` 10px；`AppSidebar.tsx` 方案时间 9.5px。
- 清单目标：9/9.5→11.5/12，10/10.5→12，11→12.5，11.5→13，12→13.5；正文 13、标签下限 11。
- 结论：确实完全没做，不是“看起来没变”。

### P1-5 按钮/图标尺寸没有按清单放大
- 证据：`B02-CHECKLIST.md:91` `[-] P1-37`。
- 当前例子：
  - `TitleBar.tsx:92` 折叠按钮 26×26（清单目标 30–32）。
  - `BottomPromptBar.tsx:462/:493` 胶囊按钮高 26px。
  - `AppSidebar.tsx` 重命名/删除图标 `w-2.5 h-2.5`（10px）。
  - `CanvasBoard.tsx` 工具栏按钮 32px（这一处达标），但图标仍 14px。
- 清单目标：12→14、14→16、16→18、主工具栏 20→22；按钮 24→30–32、触屏 44。
- 结论：没有系统性调整。

### P1-6 视图切换位置/两套切换器不一致
- 证据：
  - 画布视图切换在 `StudioShell.tsx:666`：`absolute right-3 top-3`，高 32px。
  - 九宫格视图里 `CardGridView.tsx:242-245` 又有一个 `absolute bottom-3 right-3` 的悬浮切换器。
  - 缩放/全览在 `CanvasBoard.tsx:507` 底部。
- 结论：画布模式在右上、九宫格模式在右下、缩放全览在右下偏上，三套位置不统一；用户看到“位置很奇怪”。
- 待确认：统一到右下，还是保留右上。

### P1-7 失败/无图节点卡片变小
- 证据：B02-2 P2-01 将无图节点改为 280 宽、失败 150 高、其它 140 高。
- 影响：原有 360×280 的视觉密度变化，用户可能感觉“画布变空/节点变小”。
- 待确认：是否保留新尺寸，或只对失败/排队节点缩小。

### P1-8 拖图入画布的语义变了
- 证据：`StudioShell.tsx` 的 `onImageDrop` 对文件只记录 `pendingDropRef`，图片加入参考图；下一次提交的任务节点按落点放置。不是“立即在画布上生成一个图片节点”。
- 用户预期可能是“拖进去就放到画布上”；当前是“加入参考图 + 下次任务定位”。
- 待确认：这是产品语义选择，不是崩溃，但会造成“拖了没反应”的感受。

### P1-9 Studio 输入台的 @ 只是纯文本
- 证据：known-limits 已记录：`P1-03 Studio 输入台为纯文本 @图N 插入，没有 contentEditable 胶囊；旧布局仍保留胶囊`。
- 影响：三套输入台不一致，用户会看到不同交互。

### P1-10 关闭窗口不再询问，直接隐藏到托盘
- 证据：`src/hooks/useCloseConfirm.ts` 已删除；`App.tsx` 移除 `useCloseConfirm`；Rust `CloseRequested` 只 hide。
- 影响：用户点 X 后窗口消失但进程还在，若不知道托盘，会以为“关不掉/卡死”。
- 待确认：是否加“首次关闭提示：已隐藏到托盘”。

### P1-11 窗口每次居中，不恢复上次位置/大小
- 证据：B02-3 known-limits 明确；默认 80% 工作区、上限 1440×920、下限 960×640。
- 影响：用户会感觉“窗口位置和以前不一样”；P1-35 多屏恢复未做。

### P1-12 低倍 <15% 时真实节点全部隐藏
- 证据：`CanvasBoard.tsx:212-216`：`lowZoom = viewport.k < 0.15`，`renderedNodes=[]`，只画 placeholder canvas。
- 影响：缩到很小时用户可能看到空白/无法点节点；P1-07 低倍工具条也未做。
- 待确认：placeholder 是否足够可见。

### P1-13 三套输入台仍有差异
- 证据：B02-2 只统一了 `@`、composition、快捷键、长度、拾取、排序；Studio 底部用 `BottomPromptBar`、右侧用 `RightGeneratorDrawer`、旧布局用 `InputBar`，三份实现仍有重复。
- 影响：同一操作在不同布局下表现不同；用户反馈“诸如此类的小问题”很可能来自这里。

## P2：删除/改动需确认（不一定是 bug）

### P2-1 公告相关整体删除
- 删除：`src/components/AnnouncementModal.tsx`、`src/hooks/useAnnouncements.ts`、`src/lib/announcements.ts`、`public/announcements.json`。
- 现状：无残留引用，构建通过；若用户曾用公告/活动入口，会永久消失。

### P2-2 更新相关整体删除
- 删除：`UpdateModal.tsx`、`useReleaseUpdates.ts`、`useClientUpdate.ts`、`releaseUpdates.ts`、`clientUpdate.ts`。
- Header 的 NEW/上游 Releases/客户端下载入口移除。
- 现状：无残留引用；应用内不再有“检查更新”。若需要自更新，要另做。

### P2-3 Studio 原型/占位功能文件整体删除
- 删除：`src/studio/App.tsx`、`ComfySidebar.tsx`、`ComfyWorkflowView.tsx`、`SkillHubView.tsx`、`Taskbar.tsx`、`studio/data/mockSkills.ts`、`mockWorkflows.ts`、`src/studio/main.tsx`、`src/studio/components/SettingsModal.tsx`。
- 影响：工作流/技能库两个大按钮失去原页面；用户现在要求保留入口，需要决定是恢复按钮+占位面板，还是只恢复按钮（禁用）。

### P2-4 Zen/权重滑杆删除
- B02-2 P1-14/P1-15：Zen 死入口、未接线权重滑杆已删。若用户曾用这些入口，会消失。

### P2-5 设置页新增 MCP 区块
- `src/components/settings/McpSettingsSection.tsx` 新增 237 行；设置页导航/内容变长，可能改变用户熟悉的设置位置。

### P2-6 安装/快捷方式命名
- 显示名“盼盼工作台”，但 exe/进程/安装目录仍是 `PanPan Workbench`；桌面/开始菜单快捷方式已手工改中文名。
- 重新安装可能重新生成英文快捷方式，需覆盖安装验证。

### P2-7 发布版移除 DevTools
- `P2-21` 已做：发布构建无 devtools、无 `core:webview:allow-internal-toggle-devtools`。若用户平时用 F12 调试，会不可用。

### P2-8 配置导入不再自动读剪贴板
- `P1-43`：显式导入、host 展示、非 HTTPS/未知 host 二次确认。原来“复制配置后自动识别”的流程变了。

### P2-9 无障碍/密度/对比度全部未做
- `P2-14/P2-15/P2-16/P2-17/P2-10` 均 `[-]`：无 UI 密度设置、9–10px 对比度未复核、无 focus-visible 专项、滚动条/边框/禁用态未复核、hover-only/触屏未补。

### P2-10 界面缩放设置未实现
- `PLAN-B02.md` §4 提到“界面缩放设置（跟随系统/100/110/125/150）”，但清单没有对应 ID，代码也没有 `uiScale`/`setZoom` 实现。
- 影响：用户现在只能靠系统 DPI，无法在应用内放大 UI。

## 测试缺口（本次审查确认）

- 没有 E2E/真实拖拽自动化；现有测试覆盖的是 store 逻辑，不是 DOM 双 drop 路径。
- 没有真实“拖图 → 立即提交”的回归用例。
- 没有真实“删除任务 → 快照恢复”的 UI 用例。
- 没有真实生成一张图的回归（避免消耗 Key）。
- 没有旧 UI/新 UI 的逐元素对照；本次审查只按 diff 和源码定位。
- 没有覆盖安装/卸载重装/快捷方式重建/DevTools 不可用等安装态验证。

## 建议修复顺序（只列顺序，未改代码）

1. P0-1/P0-2：拖拽单入口、串行处理、pending 保护、失败提示；先复现大图/多图。
2. P0-3：卡死兜底/托盘退出提示。
3. P1-1：恢复工作流/技能库两个占位按钮（先确认 disabled 还是可点）。
4. P1-2/P1-3/P1-6：左上角顺序、底部工具栏/视图切换位置统一。
5. P1-4/P1-5：字号/按钮/留白按清单统一放大。
6. P1-10/P1-11：关闭到托盘提示、窗口位置恢复。
7. P2-1~P2-8：逐项确认删除是否符合预期。
8. 最后做真实 UI 回归：拖拽、@、三套输入台、删除恢复、托盘、安装覆盖。

## 需要你确认的口径

1. 工作流/技能库按钮：恢复为“禁用 + 开发中”，还是可点击进入占位页？
2. 缩放/全览/视图切换：统一放右下角，还是保持现在右上？
3. C logo：保留在标题栏最左，还是移回侧栏/菜单右侧？
4. 字号/按钮：按清单全局放大，还是只做应用内“界面缩放”设置？
5. 公告/更新/Studio 原型/Taskbar：哪些要恢复？
6. 生成图片回归：是否允许用当前真实 Key 跑一张最小测试图（会消耗额度）？

---

# 附：软件 MCP 实机测试记录（2026-11-07）

## 连接方式

- 软件自身 MCP：`http://127.0.0.1:7331/mcp`
- Bearer token 来自测试副本 `mcp-token`（DPAPI 密文）
- 使用工具：`project.list`、`canvas.list`、`task.list`、`task.get`、`image.get`、`settings.get`
- 测试数据：`E:\02-RUANJIAN\67-生图工作台-u2\panpan-b02-1b-migration-data`，真实数据未动

## 基线

- `project.list`：1 个项目（默认项目）
- `canvas.list`：2 个画布
  - 画布 1：`referenceImageIds` 5 张（测试中途从 4 变 5）
  - 画布 2：测试前 0 张参考图
- `task.list`：14 个任务（10 done / 4 error）
- `settings.get`：2 个 API 配置，只返回 `baseUrlHost`，无 Key、无路径

## 生成一张图

- 操作：切到画布 2（空），输入“生成一个红色圆形，白色背景，简洁图标”，点生成
- 结果：任务 `mw67d7yo1i6bb`，状态 `done`，1 张输出图
- MCP `image.get`：`image/png`，1,459,896 字节；响应无绝对路径、无 `sk-`
- UI：画布 2 出现红色圆形节点，生成成功
- 观察：画布 2 的 `referenceImageIds` 从 0 变 1，输入框内容自动追加 `@图1`。需确认这是否是“生成后自动作为参考图”的预期行为；若是，会导致下一张默认带上一张输出。

## 参考图与画布

- 画布 1 的 5 张参考图存储在 `canvas.referenceImageIds`，但 UI 只显示在底部输入台缩略图，**没有作为画布上的可移动节点/图片元素**。
- 这与用户要求“参考图也要存放在画布中，拖进去就在画布上”不一致；当前是“画布级参考图列表 + 输入台缩略图”，不是“画布元素”。
- 画布任务节点只来自生成任务；参考图没有独立坐标/尺寸/层级，不能像生成图一样移动、缩放、持久化位置。

## 拖拽遮罩卡死（P0 复现）

- 从文件资源管理器拖图片到应用画布，拖拽进入应用后取消/未完成 drop：
  - 应用出现全屏“释放以上传图片”虚化遮罩。
  - 遮罩一直不消失；`Esc` 无效；进程仍 `Responding=True`，但界面持续虚化。
  - 只有重启应用才能清除。
- 证据：`docs/execution/evidence/drag-overlay-stuck.png`
- 代码位置：
  - `StudioShell.tsx:154-171` 只靠 `dragCounterRef` 的 `dragenter/dragleave/drop` 平衡；取消拖拽、拖出窗口、drop 未命中时没有 `dragend`/窗口失焦/超时兜底。
  - `DragUploadOverlay` 是 `fixed inset-0 z-[100]`，`pointer-events-none`，视觉上完全盖住应用。
- 结论：这直接对应“拖拽图片进去卡死、无法退出”的用户反馈；不是 GPU/进程崩溃，而是遮罩状态卡死。

## 其他 UI 实测

- 左侧只有“项目”一个功能按钮；工作流、技能库按钮不存在（代码已定位）。
- 标题栏最左多出 C logo，折叠按钮和“应用/编辑”整体右移。
- 底部缩放/全览工具栏悬在输入台上方，不在画布最底部。
- 字号/按钮仍偏小（9–12px 文本、26px 按钮等）。

## 测试限制

- 外部文件 drop 的最终“加入参考图”未完成：拖拽过程中遮罩卡死，无法继续验证文件是否入库；该现象本身已记录。
- 没有真实点击 MCP 写入确认（`task.create`/`image.attach` 默认关闭）。
- 生成只跑 1 张，符合用户授权额度。
