# 私人信息扫描与软件完成度评估（2026-11-08）

## 一、私人信息扫描结论

**总结论：公开仓与安装包里没有你的密钥、私人图片、本机路径、内部文档或私钥。**
扫描对象是「会被别人看到的东西」：线上公开仓 504 个文件、`v1.0.0` Release 的 3 件资产、以及安装包本身。

### 1.1 扫描口径与可信度

- 拉取线上公开仓 `main` 树的全部 blob sha，与本地干净快照按 **git blob 原始字节**（`sha1("blob <len>\0" + bytes)`）逐个比对：**504/504 完全一致，0 缺失、0 不一致**。因此下面的本地内容扫描等价于线上内容扫描。
- 注：第一次用 `git hash-object` 比对出现 94 处不一致，是 `.gitattributes` 的 `* text=auto eol=lf` 让 160 个 CRLF 文件被换行规范化导致的假警报；改按原始字节重算后全部一致。
- 可访问 git 历史只有 **1 条提交**。曾短暂存在的 bootstrap 提交 `29cc5cc8`（`chore: initialize repository`）只含一个占位文本文件，无私人内容，现已不可达。

### 1.2 公开仓内容扫描（499 → 补齐后 504 文件）

| 检查项 | 结果 |
| --- | --- |
| 真实本机路径 `C:\Users\95720` / `C:/Users/95720` / 本地目录名 | **0 命中** |
| 真实 API Key / `sk-` / `ghp_` / `github_pat_` / PEM 私钥 | **0 命中** |
| `.env` / `.key` / `.pem` / 签名私钥文件 | **0 个文件** |
| `docs/execution` 内部文档、`node_modules`、`target`、`dev-data` | **0 个文件** |
| 用户私人图片 | **0 张** |
| 手机号 / 真实姓名 / 内网地址 | **0 命中** |

命中的都是**假阳性**，逐条核实过：

- `README.md` 的 `$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<私钥密码>"` —— 占位符示例。
- `src-tauri/Cargo.lock` 与 `third-party-notices.txt` 的 `minisign-verify` —— Rust 依赖名，不是私钥。
- `scripts/preset-scan.test.mjs` 的 `sk-123456789012345678901234` —— 测试脱敏扫描器用的假 key。
- `src-tauri/src/data_dir.rs` / `files.rs` 里的 `C:\Users\me\AppData\...` —— 单元测试里的假路径（`me` 不是你的用户名）。
- `third-party-notices.txt` 里的 `@gmail.com` —— 第三方开源库作者的版权声明邮箱。
- `package-lock.json` 里被正则误匹配的版本号（如 `10.6.2`）。
- `huang957201826-cyber` —— 你的公开 GitHub 账号名，出现在仓库 URL 与更新地址里，属于公开标识，不是本机信息。

### 1.3 图片资产核查

公开仓共 **60 张图片**，全部是应用图标：

- 分布：`assets/brand/`（品牌 logo）、`public/`（PWA/favicon）、`src-tauri/icons/`（Windows/iOS/Android 图标）。
- 尺寸全部是正方形图标规格：512×512（6 张）、1024×1024（2 张）、64/192/40/32/72/48/96/144/58 等，最大文件 72,118 B。
- **没有** 1920×1080 之类的界面截图、没有真实任务画面、没有个人照片。

### 1.4 安装包核查

- 安装包 `PanPan Workbench_1.0.0_x64-setup.exe`（10,441,597 B）二进制 `strings` 扫描：**无** `C:\Users\95720`、**无** `sk-`、**无** 私钥起始串、**无** `data.db`/`images`/`thumbnails` 路径。
- 前端构建产物 `dist/`：**无** sourcemap、**无** 本机路径、**无** 凭证。dist 里只有 PWA 图标与 JS/CSS bundle。
- Rust release 二进制（`gpt-image-playground.exe`、CLI）：`strings` 无本机路径。
- NSIS 脚本 `installer.nsi`：安装时只写入 `data\download-dir.txt`，**不打包** `data.db` 与图片目录。
- 已安装目录 `E:\02-RUANJIAN\67-盼盼工作台\PanPan Workbench\data\` 里确实有 `data.db` 和 2 张 1254×1254 的 PNG（约 1.8 / 2.0 MB）+ 对应 webp 缩略图，但时间戳为 11-06 12:50 与 11-08 05:38，**晚于安装包构建时间 11-08 04:41**，是应用运行时生成的本机数据，不随安装包分发。

> ⚠️ **一个使用提醒**：这个版本的数据目录放在**安装目录内部**。不要把整个安装文件夹压缩发给别人，那会连带你的 `data.db` 和图片。对外只发 Release 链接或单独的 exe。

### 1.5 唯一带个人推广性质的公开标识

`sponsor-presets.json`、`README.md`、`scripts/release-check.mjs` 里有：

```
https://api.tehui.xyz/sign-up?aff=rf9W
```

这是「特惠 API」预置里的**返利码 `rf9W`**，README 已明确标注「注册（含返利）」。它不是密钥，也不是私人图片，但它是与你账号关联的推广标识，公开后所有人可见。若你不想公开，可以换成无 aff 参数的链接或删掉该预置（需同步改 `release-check.mjs` 的断言并重新发版）。

### 1.6 私有开发仓（未公开，仅供你知悉）

`panpan-workbench-dev`（`private=true`，默认分支 `b02`）里**确实有**私人/内部材料，这是刻意的、且没有进入公开仓：

- `docs/execution/evidence/` 下 3 张真实项目截图；
- `docs/execution/` 下 47 个内部执行文档（含历史里的本机路径、真实截图引用）；
- `.env.test`（值为空）与 `src-tauri/.env`（都是 `VITE_DEFAULT_*` 构建占位配置，无真实密钥）；
- 完整开发历史（含 `f9e1b32` 等历史提交里的真实截图）。

**这些没有出现在公开仓、安装包或 Release 里。**

## 二、本轮发现并已修复的发布缺陷

检查过程中发现上一轮「干净快照」白名单漏了 5 个源码依赖文档，属于真实缺陷，已修复：

- 缺失文件：`skills/gpt-image-playground/SKILL.md`、`references/{cli,custom-provider,settings}.md`、`docs/custom-provider-llm-prompt.md`。
- 影响：`src/lib/skillDocs.test.ts` 用 `?raw` 引用它们，别人 clone 公开仓后 `npm test` 会 `ENOENT`；公开仓 Actions 的 `build` workflow 两次都是红叉（`Test frontend` 失败，日志 `D:\a\skills\gpt-image-playground\references\custom-provider.md`）。
- 本地开发仓有这些文件，所以本机 88/88 通过 —— 这正是本地绿灯、线上红叉的原因。
- 处理：5 个文件已确认无敏感信息后补进快照，重建为**单条根提交** `f677df80`，公开仓文件数 499 → **504**，tag `v1.0.0` 同步更新，Release 资产不变。
- 重跑验证：`build` workflow（run `42417174806`）自动触发，`Install dependencies` / `Build frontend` / **`Test frontend` 均 success**（原先的 `ENOENT` 已消失），`Test Rust` 检查时仍在进行；公开仓整体 `VERIFY: PASS`（1 提交 / 504 文件 / 无禁止文件 / 更新地址匹配资产）。
- 另外确认：`Build Desktop Client` 的两次 `success` 是 `check` job 判断未配置 `TAURI_SIGNING_PRIVATE_KEY` Secret 后**跳过构建**的成功，不是真的在 CI 上出包；当前正式发布仍是本机手动签名 + 上传。

## 三、软件完成度评估

### 3.1 客观规模

| 指标 | 数值 |
| --- | --- |
| 源码总行数 | 约 98,547 行（393 个文本源文件） |
| TypeScript / TSX | 217 文件 47,864 行 / 101 文件 28,720 行 |
| Rust | 24 文件 9,583 行，73 个 `#[tauri::command]` |
| React 组件 | 101 个 `.tsx` |
| `src/lib` 业务模块 | 107 个 |
| 前端测试 | 88 个测试文件 / **1058 条用例全通过** |
| Rust 测试 | 101 个 `#[test]` |
| 依赖安全 | 0 critical / 0 high / 0 moderate，7 low |
| 发布物 | 安装包 9.96 MiB + `.sig` + `latest.json`，tag / Release / 自动更新链路闭环 |

### 3.2 分项评分

| 维度 | 得分 | 依据 |
| --- | --- | --- |
| 功能完整度 | **9.0** | 无限画布、九宫格、参考图选择器、技能库（增删改查/参数槽/负向词）、收藏、ZIP 备份（含技能与封面）、MCP 本机服务、CLI、代理、自动更新、主题/字号令牌/键盘模型全部落地；无「敬请期待」占位（唯一 `占位` 是 `aria-hidden` 的不可见布局撑高元素） |
| 工程质量 | **8.8** | TS + Rust 分层、Zustand persist、DPAPI 加密、浮层栈/焦点陷阱、设计令牌单一真源、73 个 Tauri 命令；扣分：单仓近 10 万行、模块边界较粗 |
| 测试与验证 | **8.5** | 1058 + 101 测试、Playwright 实机（UI-37 五个下拉、技能删除、960 窄窗、深浅主题）、本机覆盖安装回归；扣分：干净虚拟机/卸载重装未测、CI 曾失败（本轮已修） |
| 安全与合规 | **8.0** | critical/high/moderate 清零、OFL 字体合规、第三方许可清单可复现、MCP 默认关闭、导出脱敏；扣分：无 Authenticode、7 条 low 未修、DPAPI 迁移单向不可回滚 |
| 发布与文档 | **9.0** | README/SECURITY/CONTRIBUTING/RELEASE、干净单提交快照、tag/Release/三资产、更新端点 302 链验证、匿名可下载；扣分：发布 workflow 因缺 Secret 实际跳过、正式发布靠本机手动 |
| 跨平台与环境适配 | **6.5** | 仅 Windows 10/11 x64 验证；macOS/Linux 未测试；Win10 深色标题栏、部分 DPI/输入法组合仍有细节差异 |
| 运维与可维护性 | **8.0** | CI 齐备、许可生成器、发布检查脚本、更新清单脚本；扣分：错误提示未按类型细分、KaTeX 冗余字体 ~0.6 MiB、旧画布参考图不自动迁移 |

### 3.3 总分

**8.6 / 10（86 分）——「可正式开源、可日常使用的 1.0.0，距离商业级成品还有一段明确距离」**

两个口径要分开看：

- **相对 P0–P6 既定计划：100% 完成**（41 项任务全部 closed，发布链路闭环，无剩余阶段）。
- **相对一个成熟商业桌面产品：86 分**，扣分集中在「跨平台验证、代码签名、干净环境实测、CI 全自动发布」这四块，都属于工程成熟度，不是功能缺失。

### 3.4 主要扣分点（已写进 README「已知限制」）

1. 安装包无 Authenticode 代码签名，首次安装可能触发 SmartScreen / 杀软提示。
2. `npm audit` 剩余 7 条 low（KaTeX `GHSA-238p-pmpm-9mq7` 及其传递告警，上游未修）。
3. 仅验证 Windows 10/11 x64；macOS / Linux 未测试。
4. 干净虚拟机全新安装、卸载重装未实测（本机覆盖安装已实测）。
5. 自动更新依赖 GitHub Releases；无法访问 GitHub 时需手动覆盖安装。
6. 错误提示尚未按类型细分，部分失败只显示原始信息。
7. KaTeX 打包 woff2/woff/ttf 冗余副本约 0.6 MiB。
8. 旧画布中未迁移的参考图不会自动变成画布图片节点。
9. Windows 10 深色标题栏、部分 DPI / 输入法组合可能仍有细节差异。

### 3.5 若要冲到 9.5+，建议按此顺序

1. 配置 `TAURI_SIGNING_PRIVATE_KEY` / `..._PASSWORD` 两个 CI Secret，让打 tag 能全自动出包 + 上传（当前是手动）。
2. 干净虚拟机做一轮全新安装 / 覆盖安装 / 卸载保留数据 / 卸载删除数据 / 旧版升级。
3. 补 Authenticode 证书（或至少在 README 提供稳定 SHA256 校验入口）。
4. 错误提示按网络 / 鉴权 / 配额 / 参数分类。
5. 等 KaTeX 上游修复后再清掉 7 条 low，并去掉冗余字体副本。
