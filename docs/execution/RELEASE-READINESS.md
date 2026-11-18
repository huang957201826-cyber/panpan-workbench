# 开源正式版发布前审查（2026-11-07）

- 结论：UI/交互意见已基本齐全；但以当前仓库直接开源会有硬阻塞，需先清理仓库与发布材料。
- 范围：代码、文档、截图、Git 历史、依赖许可、安装/升级、数据安全、MCP、发布流程。

## P0 发布硬阻塞

1. **真实用户图片进入 Git 历史**
   - `docs/execution/evidence/canvas1-references-only-input.png`、`canvas2-generated.png`、`drag-overlay-stuck.png` 是真实项目截图/任务画面，已提交（`f9e1b32`）。
   - 即使现在删除文件，历史里仍能取回。
   - 处理：发布前从工作区移除，并**重写历史或发布干净快照仓库**；不能只 `git rm`。

2. **README 仍是上游项目，且含 JuCodex/上游推广链接**
   - README 顶部品牌仍是 `GPT Image Playground`、上游徽章、`cooksleep.dev` 演示、GHCR 上游镜像。
   - 仍含 JuCodex 注册推广链接（`jucodex.com/register?aff=3JDW`），与“禁止内嵌 JuCodex”的口径冲突。
   - `README.md` 中 `jucodex|cooksleep|aff=` 命中 17 处，需整体重写为“盼盼工作台”自己的 README。

3. **第三方许可清单未覆盖新 Rust 依赖**
   - `third-party-notices.txt` 里没有 `rmcp`/`axum` 的条目（新增 MCP 依赖）。
   - `package.json` 没有 `license`、`author`、`repository` 字段。
   - `LICENSE` 目前只有上游 `Copyright (c) 2026 CookSleep`，需保留上游声明并补本 fork 版权。
   - 处理：`npm run notices` 重新生成；确认 `src-tauri/about.toml` 接受 `rmcp`/`axum` 的 MIT/Apache 许可；补 package 元数据。

4. **文档含本机真实路径/真实数据信息**
   - `GATES-B02-1A/1B/2/3/4` 等 6 个文件含 `C:\Users\95720\...` 真实路径。
   - 发布前统一替换为占位路径，或把 `docs/execution` 从公开仓库移除（内部执行文档不适合公开）。

5. **安装/升级/卸载未做干净环境验证**
   - 未做：干净虚拟机、覆盖安装、卸载重装、旧版本升级、快捷方式重建、WebView2 缺失、SmartScreen。
   - 安装器无签名；公开分发会触发 SmartScreen/杀软提示。要么接受并写进 README，要么补签名。
   - 卸载有“删除应用数据”复选框和 data 目录保护，但需实测默认不删数据、勾选才删。

6. **数据迁移是单向的**
   - API Key 已迁移为 Windows DPAPI 密文；回退旧版无法解密，必须靠备份还原。
   - 公开版需在 README/首次启动说明：升级前备份、回滚方式、数据目录位置。

## P1 功能阻塞（已确认要修）

- 拖拽遮罩卡死：`dragend`/失焦/超时/Esc 兜底；`CanvasBoard` 与 window drop 只保留一个入口；文件 drop 进入 pending。
- 左侧三个按钮恢复；工作流/技能库点开显示“正在开发，敬请期待”。
- 左上角回上一版（去掉 TitleBar C logo，AppSidebar logo 回 16px）。
- 缩放/全览固定右下，视图切换右上；去掉 `1rem + bottomInset` 双抬升。
- 全局字号/按钮/图标/留白放大 + 界面缩放 100/110/125/150；画布世界坐标不缩放。
- 参考图落画布：画布是素材/成品总库，输入框只是本次选择器；输入框删除不删画布，画布删除才让输入框显示缺失。
- 生图后输入框/参考图完全不变：不自动 `@图1`、不自动把输出设为参考图、不清空输入。

## P1 安全/隐私

- API Key：无明文落盘、导出不含 Key、日志不含 Key；已做 DPAPI，需在公开版保留说明。
- MCP：默认关闭、只绑 127.0.0.1、Bearer、Host/Origin 校验、无 CORS、限流、审计脱敏、写工具默认关闭+UI 确认；公开 README 需明确“本机端口/token/风险”。
- 配置导入：显式导入、host 展示、非 HTTPS 二次确认；已做，保留。
- 日志/诊断：脱敏 `sk-`/Bearer/路径；发布前再扫一次。
- 仓库/历史扫描：当前工作区未发现真实 `sk-` 明文；但发布前必须做 Git 历史扫描（`git log -G`/全历史 grep），确认没有真实 Key、真实用户图片、个人路径。
- `sponsor-presets.json` 的 `aff=rf9W` 是推广链接；公开版是否保留、是否披露，需要明确决定。

## P2 发布材料/工程

- `.github/workflows` 全部是 `.disabled`，公开仓库无 CI 构建/发布流程；需补最小 build workflow 或写清“仅本地构建”。
- 无签名、无 updater、无 `latest.json`；公开版更新方式需写清“手动下载覆盖安装”。
- README 需要：项目定位、截图（非真实用户数据）、安装、首次配置、MCP、数据目录/备份、已知限制、许可与上游致谢。
- 需要 `SECURITY.md`（漏洞/密钥泄露报告方式）、`CONTRIBUTING.md`（可选）、Issue 模板（可选）。
- 版本号/RELEASE.md 要基于发布前最终差异重写；不要保留内部开发过程。
- 许可证：保留上游 MIT 声明，补本 fork 版权；第三方 notices 同步。
- 平台：明确 Windows 10/11 x64、WebView2 依赖；macOS/Linux 未验证就写“不支持/未测试”。

## 发布前测试矩阵（必须）

1. 干净 Windows：安装 → 首次启动 → 新建任务 → 生成 1 张 → 重启可见。
2. 覆盖安装：旧版数据/Key 迁移 → 任务/画布/图片数量一致 → Key 可解密。
3. 卸载：默认保留 data；勾选删除才删；重装可恢复/或明确空白。
4. 拖拽：外部文件拖入、拖入后立即提交、取消拖拽、Esc、窗口失焦、遮罩消失。
5. 参考图：画布节点 + 输入框同时出现；输入框删除不删画布；画布删除输入框缺失；导出/导入包含参考图。
6. 生图：输入/参考图前后不变；无自动 `@图1`；无自动参考图。
7. 删除/恢复：任务/项目/画布删除快照、导入恢复、图片完整。
8. MCP：HTTP/stdio、未授权/错 token/Host/Origin、只读、写入确认、端口占用。
9. 界面：960 窄窗、125%/150% DPI、界面缩放、字号/按钮不溢出。
10. 托盘：关闭隐藏、托盘显示/退出、任务运行中退出。

## 自动更新的技术口径（已确认）

- “无签名”只指 **Windows 安装包不做 Authenticode 代码签名**；自动更新包仍需 **Tauri updater 签名**（一对密钥，私钥只在你手里，公钥写进应用）。
  - 原因：更新包如果能被任意替换，等于给所有用户开后门；Tauri 更新机制必须校验签名。
  - 这不是花钱的代码签名证书，是更新机制自身的密钥对。
- 更新源：**公开 GitHub 仓库的 Releases + `latest.json`**。
- 交互：**左下角版本入口**；启动时/点击时检查；发现新版本**先提示用户确认**，确认后下载安装并重启；无更新提示“已是最新”。
- 需要 GitHub owner/repo 名称才能写死更新地址；实现时使用可配置常量，发布前填入。
- `sponsor-presets.json` 的「特惠 API」预置保留（含注册链接），只删除上游/JuCodex 推广。

## 用户已确认（2026-11-07）

- 公开仓库：**重写历史/发干净快照**，不放项目记录、真实截图、内部执行文档。
- README：彻底改成“盼盼工作台”，删除上游演示、上游徽章、JuCodex 推广和 `cooksleep.dev` 链接。
- 公开版：接受 **无 Windows 代码签名**（安装时可能有 SmartScreen 提示）。
- 自动更新：需要；在**左下角**放版本/检查更新入口；检测到新版本可更新。
- `docs/execution`：**不进入公开仓库**；只保留在私有开发仓库。公开仓库只放用户文档、README、LICENSE、构建说明等。
- CI/SECURITY：补最小 CI（build/test）和 `SECURITY.md`。
- 特惠 API：保留预置和注册链接，其他上游/JuCodex 推广删除。


