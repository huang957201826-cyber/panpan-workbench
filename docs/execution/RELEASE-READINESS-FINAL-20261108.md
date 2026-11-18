# 开源正式版 v1.0.0 全量审查与发布闭环（2026-11-08）

- 结论：**GO — 已发布**。全量审查是发布前硬闸门，本报告为最终放行记录。
- 最终可转发链接：<https://github.com/huang957201826-cyber/panpan-workbench>
- 下载/Release：<https://github.com/huang957201826-cyber/panpan-workbench/releases/latest>
- 阶段状态：**P6 是最后一个阶段，没有 P7**。代码收口 → 全量审查 → 最终构建与覆盖安装 → 干净快照公开 + tag + Release → 一致性收尾，全部完成。

## 1. 对照 2026-11-07《RELEASE-READINESS.md》逐项销项

| 原阻塞项 | 处理 | 状态 |
| --- | --- | --- |
| P0-1 真实用户截图进入 Git 历史 | **不转公开旧仓**，新建干净快照仓库（单提交、499 文件）；旧私有仓改名 `panpan-workbench-dev` 保留历史 | 已解决 |
| P0-2 README 仍是上游项目/含推广链接 | README 完全重写为「盼盼工作台」，含下载直链、功能、已知限制、致谢 | 已解决 |
| P0-3 第三方许可清单缺项 | `npm run notices` 重生成（Rust 336 / 前端 248），补 Noto OFL、Maple Mono、fastdom、strictdom、Tauri 插件兜底 | 已解决 |
| P0-4 文档含本机真实路径 | `docs/execution` 整体不进公开仓；快照扫描无 `C:\Users\95720`、无 `.env`/密钥 | 已解决 |
| P0-5 安装/升级/卸载验证 | 本机静默覆盖安装 + 注册表 1.0.0 复核；干净虚拟机/卸载重装列为已知限制（未实测） | 部分，已登记 |
| P0-6 数据迁移单向 | README 写明升级前备份、卸载默认保留数据、DPAPI Key 回滚需备份还原 | 已解决 |
| P1 功能阻塞 | P0–P5 全部完成并回归（收藏、九宫格、技能库、字号、键盘模型） | 已解决 |
| P1 安全/隐私 | API Key DPAPI、导出脱敏、MCP 本机只读默认关闭；快照 `forbidden_files: []` | 已解决 |
| P2 发布材料 | README / SECURITY.md / CONTRIBUTING.md / RELEASE.md / Issue 模板 / `tauri-release.yml` 恢复 | 已解决 |
| P2 更新链路 | 真实 owner endpoint + `latest.json` + `.sig` + exe 三件套，私钥不进仓 | 已解决 |
| 自动更新口径 | Tauri updater minisign 签名（非 Authenticode），公钥内置、私钥仅本机/CI Secret | 已解决 |

## 2. 代码与测试（发布前硬闸门）

- `npm test`：**88 个测试文件 / 1058 条用例全部通过**（10.08s）。含 K3 技能 ZIP 备份新增 9 条用例、UI-32 浮层键盘模型、MarkdownRenderer 净化链 9/9。
- `npm run build`（`tsc -b && vite build`）通过；`npm run tauri:build` 成功产出 NSIS 安装包。
- Tauri npm 插件版本与 `Cargo.lock` Rust crate 版本一致性检查通过（精确锁回 2.4.1 / 2.6.1 / 2.10.0 / 2.7.0 / 2.13.3）。
- `streamdown` 精确锁 `2.5.0`：升到 2.7.1 会让原始 HTML `id="root"` 被保留（DOM clobbering 风险），未放宽安全断言。

## 3. 依赖安全

- `npm audit` 最终：**0 critical / 0 high / 0 moderate / 7 low**。
- 7 条 low 全部来自 KaTeX 上游未修公告 `GHSA-238p-pmpm-9mq7` 及其传递告警（`@streamdown/math`、`mermaid`、`rehype-katex` 等），`fixAvailable: false`，已写进 README「已知限制」。
- `overrides.dompurify` 提到 `^3.4.17` 清掉 critical；vite / vitest / wrangler / postcss 等批量升级。
- 新建 `.npmrc` 固定 `legacy-peer-deps=true`，绕开 npm 10.9.7 的 arborist `edgesOut` 空指针，保证 `npm ci` 可复现。

## 4. 字体与许可

- 内置中文字体换成 **Noto Sans SC Subset（SIL OFL 1.1）**，变量字重 100–900，约 1 MiB；删除许可禁止修改的 HarmonyOS Sans SC 三个 TTF 及其 CSS/LICENSE。
- 子集化可复现脚本 `scripts/build-noto-subset.py`；按 OFL 第 3 条 RFN 改族名，第 2 条子集化合规。
- 安装包体积从 P5 的 23.68 MiB 降到约 **9.96 MiB**。

## 5. 实机回归

- **UI-37**（用户实机反馈）：浮岛输入栏 5 个下拉 portal 挂在 `body` 下继承 16px，与 12px 胶囊混排。修法 = `body` 全局兜底 `var(--type-body-sm)` + `Menu` 容器 `text-body-sm` + `BottomPromptBar` 局部补 `text-caption`。Playwright 实测 5 个菜单内 **0 处 16px**，body 13px / `.studio-root` 14px / 胶囊 12px / 标题 13px；键盘模型未破坏。
- **技能库删除**（用户补充）：`SkillCard` 长驻删除按钮 + Inspector 删除/编辑 + `SkillLibraryView.deleteSkill()` 确认框 + toast。实测取消不删、确认删除、toast、960 窄窗、深浅主题通过；技能库无内置预置配方，删除后重启不会复活。
- **K3 技能进 ZIP**：manifest v4 可选 `skills`，封面图随包，旧 ZIP 无该字段时行为零变化，同 ID 覆盖 / 新 ID 追加。

## 6. 安装包与签名

- `PanPan Workbench_1.0.0_x64-setup.exe`，**10,441,597 B（9.96 MiB）**。
- SHA256 `5E9964504CECC290297D8EB3FC2BA3C936775A09104F0E9E46F9CB9BF12B9F51`。
- 手动 `tauri signer sign` 生成 448 B `.sig`（密码文件 BOM 曾导致 `Wrong password`，已修正）；`tauri.conf.json` 的 `pubkey` 与 `.pub` 字符串 MATCH。
- 已静默覆盖安装到本机，注册表 `DisplayName: 盼盼工作台` / `DisplayVersion: 1.0.0`。

## 7. 发布链路与发布后验证

- 公开仓 `huang957201826-cyber/panpan-workbench`：`private=false`、`default_branch=main`、**1 条提交**、**499 个文件**、匿名 API 200。
- tag `v1.0.0`（sha `48bfc536...`）；Release `437837217`，正式版非草稿，`latest` 可解析。
- Release 资产 3 件：`latest.json` (760 B)、`PanPan.Workbench_1.0.0_x64-setup.exe` (10,441,597 B)、`.sig` (448 B)。
- 干净快照扫描：`forbidden_files: []`；60 张图片全部是 `assets/brand`、`public`、`src-tauri/icons` 下的应用图标/PWA 图标，**不含真实截图**；无 `docs/execution`、无 `node_modules`/`target`/`dev-data`、无 `.env`/签名私钥。
- 更新端点验证：`/releases/latest/download/latest.json` → 302 → `/releases/download/v1.0.0/latest.json` → 302 → Release 资产 CDN；清单正文匿名 GET 200，`version: 1.0.0`。
- **发布后修复**：GitHub 会把 Release 资产名中的空格替换为点（`PanPan Workbench_...` → `PanPan.Workbench_...`），首版 `latest.json` 仍写 `%20` 会导致自动更新 404。已修 `scripts/make-update-manifest.mjs`（`file.replace(/ /g, '.')`）、重生成并重传清单、同步 README 说明，公开仓用新的单条根提交重建；`updater_url_matches_release_asset: true`。
- 最终 `VERIFY: PASS`。

## 8. 已知限制（公开披露）

- 安装包**未做 Authenticode 代码签名**，首次安装可能出现 SmartScreen 提示；自动更新包另有 Tauri updater 签名。
- `npm audit` 剩余 7 条 low（KaTeX 链），上游未修。
- KaTeX 冗余字体副本约 0.6 MiB，未清理。
- 干净虚拟机全新安装、卸载重装未实测；本机覆盖安装已实测通过。
- 本机网络对 `github.com` 的 git smart HTTP 通道与 `release-assets.githubusercontent.com` 有屏蔽，故代码落库走 Git Data API、资产可达性以 API + 302 链验证；不影响终端用户下载。

## 9. 本地/远端一致性收尾

- 开发仓分支 `b02` = `a4a105d`（修正更新清单生成规则），已推送。
- `origin` 已从 `panpan-workbench.git` 改指 **`panpan-workbench-dev.git`**（私有），避免后续开发误推公开仓。
- 公开仓是独立的干净快照，与含内部文档历史的私有开发仓分离；**后续继续开发请在 dev 仓进行，发布时重新生成干净快照**。

## 10. 最终链接

- 开源主页（可直接转发）：<https://github.com/huang957201826-cyber/panpan-workbench>
- 最新版下载：<https://github.com/huang957201826-cyber/panpan-workbench/releases/latest>
- v1.0.0 Release：<https://github.com/huang957201826-cyber/panpan-workbench/releases/tag/v1.0.0>
