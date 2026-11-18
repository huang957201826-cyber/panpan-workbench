# 盼盼工作台 · 主问题总表（MASTER ISSUES）

- 日期：2026-11-06
- 当前版本：`0.1.1`（构建源码 `ba60268`，文档 HEAD `cb654e2`）
- 当前实际安装：`E:\02-RUANJIAN\67-生图工作台\PanPan Workbench`
- 当前真实数据：`C:\Users\95720\AppData\Local\PanPan Workbench\data`（孤儿，未被当前快捷方式使用）
- 用途：把用户反馈、方案/代码复审、自查审计合并为唯一总表；后续修复只认这里的 ID。
- 说明：本表只记录，不代表已修复。状态口径：`已修待复审` / `已修已验证` / `部分` / `未做` / `阻塞` / `不做`。

## 来源

| 来源 | 内容 |
|---|---|
| 用户反馈 A | 拖图入画布/输入框、参考图来源、原版尺寸比例、画布行下插入、节点动作、选择工具、拖动跳动、切换卡顿、数据目录 |
| 用户反馈 B | Rummage/GitHub 弹窗、50 图赞助、关于页赞助/Issues |
| 用户反馈 C | 拖图入画布、从画布拾取参考图、@图/拖入虚化/排序重编号、右下角常驻 |
| 用户反馈 D | 图标不彻底（缩略图/左上角/桌面）、画布右下角缩放/适应全部、全量基础问题 |
| 方案复审 | `PLAN_REVIEW=APPROVE`；20 条 P0/P1/P2 |
| 代码复审 | `CODE_REVIEW=REJECT`；4 条数据安全阻塞 |
| 自查审计 | 画布/输入台/外壳/安装/品牌 30+ 条 |
| 补充排查 | 单实例/日志/托盘/密钥/崩溃/剪贴板/上游残留/假入口/并发/磁盘/数据库完整性 |

## P0（会丢数据 / 数据不可见 / 严重误导）

| ID | 问题 | 来源 | 证据 | 状态 |
|---|---|---|---|---|
| P0-01 | 双安装/双数据：E 盘安装加载测试数据，C 盘真实任务数据无 exe 可加载；桌面快捷方式指向 E 盘 | 用户 D + 自查 | `U2-B02-1A.md`、`B02-1A-CONTROL-EVIDENCE.md` | 已修已验证 |
| P0-02 | `saveTaskCompletion` 等待写库期间没有 execution/revision 保护：stop/delete/drag 会被迟到完成覆盖 | 代码复审 | `store.ts` 队列/epoch；`REPORT-B02-1A.md` | 已修已验证 |
| P0-03 | fal/custom 恢复完成仍先提示成功再写库（`updateTaskInStore`） | 代码复审 | `REPORT-B02-1A.md`、`U2-B02-1A.md` | 已修已验证 |
| P0-04 | stop/error/watchdog 终态仍 fire-and-forget；写库失败重启后可能被当作可恢复任务继续 | 代码复审 | `REPORT-B02-1A.md`、`U2-B02-1A.md` | 已修已验证 |
| P0-05 | custom 恢复没有 AbortSignal/真正绝对截止；30 分钟上限只存在进程内 Map，重启重置 | 代码复审 | `REPORT-B02-1A.md`、`U2-B02-1A.md` | 已修已验证 |
| P0-06 | 右下角 `−`/`+`/`适应全部` 被“画布/九宫格”切换覆盖；点“适应全部”实际切到九宫格 | 用户 D + 实测 | `CanvasBoard.tsx:435` vs `StudioShell.tsx:580-596` | 未做 |
| P0-07 | 画布工具栏点击会冒泡触发框选并清空选择 | 自查 | `CanvasBoard.tsx` 根 `onPointerDown`、工具栏无 stopPropagation | 未做 |

## P1（核心交互/原版能力缺失/安装品牌）

| ID | 问题 | 来源 | 状态 |
|---|---|---|---|
| P1-01 | 图片不能拖入无限画布；全局 drop 只加进输入框，拖到画布也跑到输入框 | 用户 C | 未做 |
| P1-02 | 输入台不能“从画布拾取参考图”；`+` 只有本地/链接 | 用户 C | 未做 |
| P1-03 | 没有 @图 候选菜单、mention 胶囊、键盘选择；只有点击缩略图插文本 | 用户 C | 未做 |
| P1-04 | 拖入虚化遮罩 `DragUploadOverlay` 未接入 Studio 输入台 | 用户 C | 未做 |
| P1-05 | 拖动参考图排序后 @ 自动重编号未实机回归；纯文本 mention 不可见 | 用户 C | 部分 |
| P1-06 | 切换画布后 `didFitRef`/`userInteractedRef` 不重置，新画布可能停在旧视口/原点 | 自查 | 未做 |
| P1-07 | 低倍 `k<0.35` 节点没有选中工具条；右键菜单 portal 不渲染 | 自查 | 未做 |
| P1-08 | 无 `canvas` 坐标的旧任务，历史“画布”只切视图不居中 | 代码复审/自查 | 未做 |
| P1-09 | 新任务行下插入只有代码/单测，没有真实生成验证 | 用户 A | 部分 |
| P1-10 | Space/中键在节点上平移刚修，未复验 | 代码复审 | 待验证 |
| P1-11 | 真实撤销/重做没有实现；只移除了假按钮 | 用户 A/自查 | 不做（本批） |
| P1-12 | 多输出图任务只能默认取第一张作为参考图 | 自查 | 未做 |
| P1-13 | 底部/右侧/旧布局三套输入台行为漂移（Zen、权重、批量、遮罩不一致） | 自查 | 未做 |
| P1-14 | Zen 模式有弹层但无入口，是死功能 | 自查 | 未做 |
| P1-15 | 参考图权重滑杆未接线 `onUpdateReferenceWeight`，永远不出现 | 自查 | 未做 |
| P1-16 | 提交快捷键硬编码 Ctrl+Enter，设置里的 Enter 提交对 Studio 不生效 | 自查 | 未做 |
| P1-17 | URL 添加图片只校验 20MB，未校验 8192px；本地入口有校验 | 代码复审 | 未做 |
| P1-18 | 提示词无长度上限 | 自查 | 未做 |
| P1-19 | 弹窗打开时 Delete/Ctrl+A 仍可能作用于画布 | 代码复审 | 未做 |
| P1-20 | 底部停靠/窄窗时输入台 `z-30` 压住画布工具栏 | 自查 | 未做 |
| P1-21 | 批量部分失败时 `taskIds.length>0` 会一起清空输入，失败条目的提示词丢失 | 代码复审 | 未做 |
| P1-22 | 关闭窗口只关闭到托盘（不退出）；托盘菜单显示/退出；不做开机启动 | 用户 C | 未做 |
| P1-23 | AppLogo 是几何准星，不是统一品牌；标题栏没有品牌 logo。已选 `C · 折角入口`（黑底白标），待 B02-3 统一生成全套尺寸 | 用户 D/自查 | 已选 C、待接入 |
| P1-24 | 桌面快捷方式指向 E 盘、IconLocation=,0、Windows 图标缓存可能仍旧星芒；旧 C 盘安装残留 | 用户 D/自查 | 未做 |
| P1-25 | 产品名/界面名/exe 名/协议名/发布者/安装目录不统一 | 自查 | 未做 |
| P1-26 | 旧协议 `gpt-image-playground://` 仍注册 | 自查 | 未做 |
| P1-27 | 真实写操作 U2（3 任务/关闭重开/导出导入/写库失败注入） | 代码复审 | 已修已验证（U2 含 3 条操作偏差，见 `U2-B02-1A.md`） |
| P1-28 | 历史流卡片缺详情/编辑/删除/收藏/重试 | 审查窗口/自查 | 未做 |
| P1-29 | 收藏夹集合、评论标记、画板/草图等原版能力丢失 | 审查窗口/自查 | 未做 |
| P1-30 | 画布切换卡顿未完整修：参考图串行加载、workspace 整包序列化仍在 | 用户 A/自查 | 部分 |
| P1-31 | 字号尺度只有 9–12px，147 处小字号；1080P/2K/4K@100% 正文偏小或不可读 | 用户 E/自查 | 未做 |
| P1-32 | 默认窗口固定 1280×820、最小 800×600；4K 打开只占约 1/3，无按工作区比例/UI 缩放 | 用户 E/自查 | 未做 |
| P1-33 | 只有 900/1100 两个断点，无 2K/4K 大屏放大/限宽；右侧抽屉 360、输入台 896 固定 | 用户 E/自查 | 未做 |
| P1-34 | Studio 字体栈写 Geist/Space Grotesk/JetBrains Mono 但未打包，实际回退系统字体，跨机器观感不一致 | 自查 | 未做 |
| P1-35 | 窗口状态恢复未校验当前显示器边界；换屏/拔屏后可能恢复到屏幕外（需验证） | 自查 | 待验证 |
| P1-36 | 367 处固定字号中 313 处 ≤11.5px；正文 10–11px，低于桌面 13–14px 基准；字号阶梯有 8–17 共 14 档，0.5px 差异无意义 | 用户 E/自查 | 未做 |
| P1-37 | 图标 12–16px、按钮 24px、胶囊 26px；低于桌面 30–36px/触屏 44px 基准 | 用户 E/自查 | 未做 |
| P1-38 | 留白偏紧且不统一：卡片 10px、密集行 6px、gap 4/6/8/10 混用；4px 网格未形成节奏 | 用户 E/自查 | 未做 |
| P1-39 | Studio 底部/右侧输入台没有中文输入法组合键保护：按 Enter 选候选词会直接提交任务；旧 InputBar 已有 `isComposing`/keyCode 229 判断，两个新入口都没有 | 补充排查 | 未做 |
| P1-40 | 没有 React 错误边界：只有 `window.error`/`unhandledrejection` 写日志；任一渲染异常会整页白屏，只能杀进程 | 补充排查 | 未做 |
| P1-41 | 删除任务/画布/项目是永久删除：DB 行、状态、未引用图片一起清掉，没有回收站、没有删除前自动快照，误删不可恢复 | 补充排查 | 未做 |
| P1-42 | 侧栏仍暴露“工作流/技能库”入口，点开只显示“功能开发中”占位；真实 `ComfyWorkflowView`/`SkillHubView` 只存在于未接入的原型代码里 | 补充排查 | 未做 |
| P1-43 | 配置导入链接会自动读剪贴板：窗口每次获得焦点都 `readText()`，任意 `http(s)?apiUrl=` 链接可弹导入框；链接可覆盖 baseUrl/apiKey，存在钓鱼/密钥外送风险；上游域名 `cooksleep.dev` 仍在 | 补充排查 | 未做 |

## P2（体验/可维护性/发布基础）

| ID | 问题 | 来源 | 状态 |
|---|---|---|---|
| P2-01 | 失败/无图节点仍是 360×280 大空白卡，不能区分失败/排队/无输出 | 自查 | 未做 |
| P2-02 | 画布工具栏按钮 24px、无 tooltip/aria-label，触屏键盘可达性差 | 自查 | 未做 |
| P2-03 | 500+ 节点占位、低倍总览可点性、极端节点数 spread 已改但未全量验证 | 自查 | 部分 |
| P2-04 | 无 minimap/缩放至选中/全览快捷键 | 用户 D/自查 | 未做 |
| P2-05 | PWA 只有 SVG 图标，缺 192/512 PNG；apple-touch-icon 也是 SVG | 自查 | 未做 |
| P2-06 | C 方案需要专门的 32px 简化版；当前熊猫小图标细节多，任务栏/桌面缩略图辨识度一般 | 用户 D/自查 | 未做 |
| P2-07 | 旧布局 Header 仍有上游更新 NEW/UpdateModal 入口 | 自查 | 未做 |
| P2-08 | 发布者 `panpan`、URLInfoAbout/HelpLink 为空 | 自查 | 未做 |
| P2-09 | 未签名 NSIS、无 `.sig/latest.json`、无干净 VM（已知限制） | 发布 | 不做（本批） |
| P2-10 | hover-only 操作、可访问性、窄窗口/触屏适配不足 | 审查窗口 | 部分 |
| P2-11 | 没有发布前基础检查脚本（命名/图标尺寸/快捷方式/协议/安装路径/签名） | 自查 | 未做 |
| P2-12 | `announcements.json` 已清空但公告组件/媒体清理不彻底 | 自查 | 部分 |
| P2-13 | Web/PWA viewport 禁止缩放（`maximum-scale=1,user-scalable=no`），可访问性差 | 自查 | 未做 |
| P2-14 | 没有 UI 密度设置（紧凑/舒适）；触屏目标 24px，低于 44px 基准 | 自查 | 未做 |
| P2-15 | 9–10px 的 `text-slate-400`/opacity 文本对比度可能不足；需按小字 4.5:1 复核 | 自查 | 待验证 |
| P2-16 | 大量图标按钮只有 hover，没有 `focus-visible`；键盘焦点不可见 | 自查 | 未做 |
| P2-17 | 4px 滚动条偏细；高分屏 0.5px 边框可能发虚；禁用态 opacity-35 对比过低 | 自查 | 未做 |
| P2-18 | 原型死代码：`studio/App.tsx`/`main.tsx` 有 `setTimeout` 假生成、随机图、`window.prompt`、假任务栏；`studio/components/SettingsModal.tsx` 有假“ComfyUI 连接成功 200 OK 18ms”；`SkillHubView`/`ComfyWorkflowView`/`Taskbar`/mockSkills/mockWorkflows 均未接入 | 补充排查 | 未做 |
| P2-19 | API Key 明文落盘：settings 走 zustand persist → SQLite `kv`/localStorage，`apiKey` 未用 DPAPI/Windows 凭据管理器加密；原始数据库被复制即可读 Key | 补充排查 | 未做 |
| P2-20 | 上游残留：`RELEASE.md` 还是 v0.8.4；`deploy.yml` 硬编码 `CookSleep/gpt_image_playground`，docker/release/vercel 仍会在 `v*` tag 自动发布/部署，未按 fork 调整；`src-tauri/.env` 的 `VITE_WEB_APP_URL=https://gpt-image-playground.cooksleep.dev`；Header 仍链上游 Releases；`autoCheckUpdate` 开关因 `UPDATES_ENABLED=false` 实际无效；CSP 仍放行 `api.github.com` | 补充排查 | 未做 |
| P2-21 | 生产包带 DevTools：Cargo 默认启用 `tauri` 的 `devtools` feature，capability 允许 `core:webview:allow-internal-toggle-devtools`；发布版用户可打开开发者工具查看请求/Key | 补充排查 | 未做 |
| P2-22 | 没有“测试连接/模型校验”，也没有 HTTP 明文告警：自定义 baseUrl 可填 `http://`，API Key 会明文发出；真实设置页只有保存，没有验证入口 | 补充排查 | 未做 |
| P2-23 | 手动连续提交没有全局并发上限/队列：只有批量提示词走 `runWithConcurrency`，反复点生成会同时打满 API，易触发限流和超额费用 | 补充排查 | 未做 |
| P2-24 | 没有磁盘空间预检：生成/导出/写图前不检查剩余空间，磁盘满时任务失败并可能留下临时文件，提示不指向“磁盘不足” | 补充排查 | 未做 |
| P2-25 | 数据库启动只校验 schema 版本，没有 `PRAGMA quick_check`/自动修复；迁移前也没有自动 DB 快照，损坏时只能手工处理 | 补充排查 | 未做 |

## 功能需求（来自会话 `ses_e50ab6735ffeibzBgFyZbeDWzm`，非 bug）

| ID | 需求 | 解决方法 | 状态 |
|---|---|---|---|
| F-01 | API 下拉只保留两条预置：`默认` + `特惠 API`；删除 APIMart、摸鱼 AI、JuCodex、MaruCode、Sublyx 及 `custom-apimart` Manifest | 改根目录 `sponsor-presets.json`：`customProviders: []`；`profiles` 只留默认和特惠；`isDefault: true` 只放在默认上（多条时硬性要求，`apiProfiles.ts:649`） | 未做 |
| F-02 | `特惠 API` 是广告成品节点：名称/说明带“新用户注册送 10 刀”，点击说明里的链接打开 `https://api.tehui.xyz/sign-up?aff=rf9W`；baseUrl `https://api.tehui.xyz/v1`，模型 `gpt-image-2.5`；Key 留空由用户填 | 用现有预置 profile 的 `description` Markdown（`SettingsModal` 已渲染并走系统浏览器）；不新增 UI；示例见下方 JSON | 未做 |
| F-03 | 绝对不能把用户自己的 API 节点/Key 上传或内嵌：`api-sz-link.com`、JuCodex、真实 `apiKey` 不能出现在预置文件/安装包 | `sponsor-presets.json` 不写 `apiKey`、不写 JuCodex；在 `vite.config.ts` 的 `embedDefaultConfig` 增加构建前扫描：发现非空 `apiKey`、`api-sz-link`、`jucodex` 直接中止构建 | 未做 |
| F-04 | 香蕉/Gemini/其他生图 API 后续可接；评估已完成，本轮不实现 | 首选 OpenAI 兼容中转零改动；Gemini 原生需薄适配器（鉴权头、模型名进 URL、多参考图、aspectRatio/imageSize）；fal 需按模型映射参数；先补自定义 headers/path 变量/数组逐项展开 | 评估完成，未实现 |
| F-05 | MCP 本次必须交付，不再后置 | B02-4：本机 `127.0.0.1` + token，Streamable HTTP + stdio（官方 `rmcp` Rust SDK，不手写 JSON-RPC）；只读工具（project/canvas/task/image/settings 脱敏、分页），写入工具二次确认；设置页开关/端口/token/客户端配置/审计；Host/Origin 校验、限流、未授权拒绝、不泄漏 Key/绝对路径 | 待做 |

### F-01/F-02 目标 JSON（只记录，未落盘）

```json
{
  "customProviders": [],
  "profiles": [
    {
      "id": "gpt_image_playground-default-openai",
      "name": "默认",
      "provider": "openai",
      "baseUrl": "https://api.openai.com/v1",
      "model": "gpt-image-2.5-sunburst",
      "apiMode": "images",
      "isDefault": true
    },
    {
      "id": "tehui",
      "name": "特惠 API",
      "description": "**新用户注册送 10 刀**：[立即注册](https://api.tehui.xyz/sign-up?aff=rf9W)，注册后在下方填入 API Key 即可使用成品节点。",
      "provider": "openai",
      "baseUrl": "https://api.tehui.xyz/v1",
      "model": "gpt-image-2.5",
      "apiMode": "images"
    }
  ]
}
```

### 老用户升级行为（方案中已确认）

- 没改过、没填 Key 的旧广告配置：升级后自动消失。
- 填过 Key 的旧配置：保留为用户本地配置，不丢数据。
- 当前选中的配置被删除：回退到默认。
- 新“特惠 API”：升级后自动追加。
- 上线前必须验证：`https://api.tehui.xyz/v1/images/generations` 是同步 OpenAI 兼容；`gpt-image-2.5` 在特惠端真实存在；否则要改成异步 Manifest。



## 已修/已收紧（保留记录，避免重复修）

| 项目 | 状态 |
|---|---|
| 快捷参数菜单被 overflow 裁切 → FloatingMenu Portal | 已修已验证 |
| 原版 SizePickerModal（1K/2K/4K + 8 比例 + 自定义） | 已修已验证；8K 不做（模型未确认） |
| 画布节点复用参数/设为参考图/编辑输出/删除/重新生成/详情 + 右键 | 已修已验证 |
| 节点拖动 offset 按 scale 换算、松手跳动 | 已修 |
| 选择箭头、Shift/Ctrl 多选、Ctrl+A、Delete（基础） | 已修，弹窗保护未做 |
| 文件夹展开/收起、筛选清空隐藏选择、批量进度/停止、遮罩 chip | 已修 |
| 输入台文件拖入/粘贴/URL/16 张上限/本地 20MB+8192px | 已修；画布/历史来源未做 |
| 任务创建/完成 persist-first、取消链路、导入补偿、导出缺图/密钥清理 | 已修待复审（P0-02/03/04/05 仍阻塞） |
| Rust busy_timeout、导出/迁移 fsync | 已修 |
| Rummage/客户端公告、50 图赞助、关于页赞助/Issues、帮助页上游仓库 | 已清理，MIT 署名保留 |
| 设置 6 Tab、假撤销/重做/Ctrl+N/默认项目删除/更新死入口 | 已修 |
| OS 图标（窗口/任务栏/安装包/卸载器/favicon/PWA）换熊猫 | 已换；AppLogo/小尺寸/PWA PNG 未统一 |

## 已具备、不要重复造轮子（补充排查确认）

| 能力 | 现状 | 结论 |
|---|---|---|
| 单实例 | `tauri-plugin-single-instance` 已注册，第二实例会唤醒主窗口 | 保留，不重写 |
| 日志 | `tauri-plugin-log` 5MB 轮转、保留 2 份；`tauriLog` 已脱敏 Bearer/sk- | 保留，补错误边界即可 |
| 托盘基础 | Tauri 2 核心自带 tray API，不需要额外插件 | B02-3 直接用 |
| WebView2 | NSIS 已带 `downloadBootstrapper`，缺运行时自动安装 | 保留 |
| 卸载数据 | 卸载页有“删除应用数据”复选框 | 保留 |
| 导出密钥 | `exportZip` 会 `scrubApiKeys`，备份 ZIP 不含 Key | 保留，补 UI 明示 |
| Markdown/XSS | ReactMarkdown/Streamdown 均走 `safeUrl`，HTML 默认 sanitize | 保留，不新增库 |
| 异步轮询 | custom 轮询已有 20 次连续错误、429/408/5xx 重试、30 分钟下限 | 保留，补跨重启截止（P0-05） |
| HTTP/代理 | Rust `reqwest` + 系统证书 + 系统代理；URL 仅允许 http/https | 保留 |
| 存储 | SQLite WAL、`busy_timeout=5000`、写权限探测、迁移版本校验 | 保留，补完整性检查/快照 |
| 导入导出 | fflate 分卷、2GB 上限、manifest 校验、图片引用校验 | 保留 |
| 图片回收 | `deleteUnreferencedImageIds` 会清理未被任务/草稿引用的图片 | 保留，扩到回收站 |
| 搜索/虚拟网格/缩略图 | 已实现并有测试 | 保留 |
| 字体 | 已打包 HarmonyOS Sans SC / Maple Mono；Studio 另写 Geist 才回退 | 改 Studio 复用现有字体栈 |

## 统计

- 主表共记录：`7 P0 + 43 P1 + 25 P2 = 75 条`（含已修待复审项与已知限制）。
- 另有 `5 条功能需求` F-01–F-05（预置 API/特惠广告/防泄漏/香蕉 API/MCP），不计入 bug 数。
- 其中代码复审仍阻塞：`4 条`（P0-02/03/04/05）。
- 补充排查新增：`5 条 P1 + 8 条 P2 = 13 条`；均为此前 62 条未覆盖的实质问题。
- 用户本轮四条：`P0-06、P1-01、P1-02、P1-03/P1-04、P1-22`。
- 真正需要“新设计”的：画布素材节点/拖拽落点、参考图拾取态、@ mention 系统、托盘与品牌资产链、MCP。
- 其余大多是“回接原版/修布局/修状态/统一命名/补安全边界”。

## 建议修复顺序

1. **数据保命**：P0-01 双安装/双数据 → P0-02/03/04/05 复审阻塞 → P1-27 真实写 U2 → P1-41 回收站/删除前快照 → P2-25 数据库完整性检查。
2. **稳定性**：P1-40 错误边界 → P2-24 磁盘空间预检 → P2-23 全局并发队列。
3. **画布可用**：P0-06/P0-07 工具栏重叠 → P1-06/07/08 切换 fit/低倍动作/无坐标定位 → P1-09/10 行下插入与节点平移复验。
4. **输入台原版能力**：P1-01/02/03/04/05 拖入画布、画布拾取、@ 系统、虚化、排序重编号 → P1-12/13/14/15/16 多图/三套入口/死功能 → P1-39 输入法保护。
5. **外壳与托盘**：P1-22 托盘常驻 → P1-28/29 历史卡片/收藏夹/评论/画板 → P1-42 移除假入口。
6. **品牌与安装**：P1-23/24/25/26 + P2-05/06/07/08 统一 logo/命名/快捷方式/PWA/协议 → P2-09 发布链路 → P2-20 清理上游 RELEASE/CI/.env。
7. **安全加固**：P1-43 配置导入剪贴板/钓鱼 → P2-19 API Key 加密 → P2-21 关闭生产 DevTools → P2-22 测试连接/HTTPS 告警。
8. **MCP**：F-05 + B02-4 全部安全/测试项，不后置。

## 不在本表

- MCP：已并入 `F-05` 与 `B02-4`，不再作为 P7 后置项。
- 8K：模型能力未确认，不做假选项。
- 代码签名/updater：发布批次单独做，不在本表当 bug；但 `P2-20` 的上游 updater/CI 残留必须清。
