# 盼盼工作台 / PanPan Workbench

盼盼工作台是一款面向设计素材与图像生成的 Windows 桌面工作台：在无限画布上管理参考图、生成结果与历史任务，用底部输入台选择本次参考图并提交生成。

![盼盼工作台 · 无限画布与底部输入台](docs/preview/panpan-workbench-v1.0.0.png)

**下载最新版**：<https://github.com/huang957201826-cyber/panpan-workbench/releases/latest> —— 下载 Windows 安装包（`.exe`）后直接运行安装。

> 安装包未做 Authenticode 代码签名，首次安装 Windows 可能提示 SmartScreen；选择「更多信息 → 仍要运行」即可。Release 页提供 SHA256 供校验。
>
> `v1.2.1` 已于 2026-11-12 更新：底部输入框加宽、画布缩放/全览移至右下角、技能选择器固定尺寸。升级前建议先备份数据。

## 功能

- **无限画布**：图片素材与生成结果都是画布节点，可拖动、缩放、选中、删除和右键设为参考图。
- **参考图选择器**：输入台只负责本次生成要用的素材；输入台删除不删画布，画布删除会让输入项显示缺失并禁止提交。
- **生图任务**：支持多模型配置、尺寸/质量/数量/格式、遮罩、批量提示词与历史复用。
- **技能与配方**：三栏技能库，支持分类、收藏、置顶、常用、参数槽与负向提示词；可一键注入输入框，也可编辑、删除任意已存配方。技能随 ZIP 备份一起导出与恢复。
- **Lovart 技能库**：内置 27 条空间、建筑、室内视觉与电商技能；按分类/优先级/关键词筛选，按输入契约生成表单，确认交付规格后一键填入输入台，不自动提交。技能包为构建时只读快照。
- **历史与收藏**：任务卡片、九宫格历史、收藏夹、下载与配置复用。
- **MCP 本机服务**：默认关闭，可按需开启只读查询与经确认的写入。
- **自动更新**：客户端检查 GitHub Releases，确认后下载、校验 Tauri updater 签名并安装。

## 安装

1. 从 [Releases 最新版](https://github.com/huang957201826-cyber/panpan-workbench/releases/latest) 下载 Windows 安装包（`PanPan.Workbench_<版本>_x64-setup.exe`）。
2. 运行安装程序，按提示安装到当前用户目录。
3. 首次启动需要系统已安装 WebView2。Windows 10/11 通常已自带；缺失时请先安装 Microsoft Edge WebView2 Runtime。

升级时直接运行新版本安装包覆盖安装。卸载默认保留应用数据；卸载程序中的“删除应用数据”复选框才会删除数据目录。

## 首次配置

打开“应用 → 偏好设置 → API”，填写自己的 OpenAI 兼容接口：

- `Base URL`：例如 `https://api.openai.com/v1` 或兼容服务地址。
- `API Key`：只保存在本机，使用 Windows DPAPI 加密，不写入导出备份。
- 模型：填写服务商支持的图像模型名称；**多个模型用英文逗号分隔**，即可在输入台的「模型」下拉里切换。下拉底部的「管理模型列表…」可直接回到这里修改。

仓库预置了「特惠 API」配置，可直接使用其注册入口获取 Key：

- 注册（**含返利**）：<https://api.tehui.xyz/sign-up?aff=rf9W>
- Base URL：`https://api.tehui.xyz/v1`
- 模型：`gpt-image-2.5`

预置中的 Key 为空，需要自行注册后填写。第三方服务的可用性、计费与数据处理以其条款为准。

## MCP（本机）

MCP 默认关闭。在“偏好设置 → 通用 → MCP”中开启，设置本机端口并生成/复制 token。

- 只绑定 `127.0.0.1`，需要 Bearer token。
- 只读工具：`project.list`、`canvas.list`、`task.list`、`task.get`、`image.get`、`settings.get`。
- 写入工具：`task.create`、`image.attach`，默认关闭；每次写入都需要在主窗口确认。
- `canvas.list` 只返回画布摘要与图片节点数量/ID，不返回本机路径。
- 不要把端口或 token 暴露到公网；token 泄露后请立即在设置页轮换。

客户端配置示例：

```json
{
  "mcpServers": {
    "panpan-workbench": {
      "url": "http://127.0.0.1:7331/mcp",
      "headers": {
        "Authorization": "Bearer <在设置页生成的 token>"
      }
    }
  }
}
```

## 数据目录与备份

默认数据目录在用户目录下，可在“偏好设置 → 数据管理”查看和更改。升级、重装或回滚前建议先导出备份。

- 数据库、图片、缩略图与索引都在数据目录中。
- API Key 使用 Windows DPAPI 加密；换用户或换机器后无法直接解密，需要重新填写或从备份恢复。
- “导出数据”生成的 ZIP 可恢复配置、任务、画布、图片、对话与**技能库（含封面图）**；导入按同 ID 覆盖、新 ID 追加，不会清空现有技能。
- 删除任务、画布或项目前会尝试写入删除快照，快照同样包含技能。
- **技能删除后不可撤销**，删除前建议先导出一次 ZIP 备份。

## 自动更新

- 更新源：<https://github.com/huang957201826-cyber/panpan-workbench/releases/latest/download/latest.json>
- 左下角显示当前版本，点击可检查更新；启动后也会延迟检查一次。
- 发现新版本会先询问，确认后才下载；下载完成并通过 Tauri updater 签名校验后，才提供“立即重启安装”。
- 网络失败、无新版本、下载失败都会在面板中显示状态。
- 更新清单 `latest.json`、安装包与 `.sig` 都由同一个 GitHub Release 提供；验签公钥内置在客户端，**签名私钥不随仓库分发**。
- GitHub 会把 Release 资产名中的空格转成点，因此资产名为 `PanPan.Workbench_<版本>_x64-setup.exe`；`npm run updater:manifest` 已按该规则生成下载地址。文件名变化不影响安装。

维护者发版时需同步两处地址：`src/lib/appUpdate.ts` 的 `UPDATE_ENDPOINT` 与 `src-tauri/tauri.conf.json` 的 `plugins.updater.endpoints`。

生成更新签名密钥（私钥不要提交）：

```powershell
npx tauri signer generate -w "$env:TEMP\panpan-updater.key"
```

把生成的 `.pub` 内容写入 `tauri.conf.json` 的 `plugins.updater.pubkey`。构建更新包时设置：

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "$env:TEMP\panpan-updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<私钥密码>"
npm run tauri:build
```

`bundle.createUpdaterArtifacts` 已开启，构建会生成安装包与 `.sig`。将安装包、`.sig` 和 `latest.json` 一起上传到 GitHub Release。构建后可用 `npm run updater:manifest` 生成 `latest.json`（输出到 `src-tauri/target/release/latest.json`）。

## 构建

要求：Node.js 20+、Rust stable、Windows 10/11、WebView2。

```powershell
npm install
npm run build
npm test
npm run test:interaction
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

`npm run test:interaction` 是 CI 的独立门禁：在 jsdom 里按真实浏览器的 `pointerdown → mousedown → click` 顺序点击下拉选项，断言菜单不会被提前卸载且参数确实写回，同时校验新用户默认视图。

仓库根目录的 `.npmrc` 固定了 `legacy-peer-deps=true`，用于绕开 npm 10.9.x 在解析部分可选 peer 时的已知缺陷，`npm install` / `npm ci` 行为一致。

`npm run tauri:build` 产物在 `src-tauri/target/release/bundle/nsis/`。第三方许可清单由 `npm run notices` 生成（需 cargo-about 0.9.2），结果提交在 `src/assets/third-party-notices.txt`。

内置界面字体为 **Noto Sans SC Subset**（SIL OFL 1.1 的子集衍生版，约 1 MiB）与 **Maple Mono NF CN Subset**（OFL 1.1）；许可全文见应用内“设置 → 关于 → 第三方许可”与 `src/assets/third-party-notices.txt`。

## 已知限制

- 仅验证 Windows 10/11 x64；macOS / Linux 未测试。
- 安装包没有 Authenticode 代码签名，可能出现 SmartScreen / 杀软提示。
- 自动更新依赖 GitHub Releases；无法访问 GitHub 时需要手动下载覆盖安装。
- 错误提示尚未按类型细分，部分失败只显示原始信息。
- `npm audit` 仍有 **7 条 low**，全部来自 KaTeX 原型污染公告 [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7)（影响 `katex < 0.18.2`）及其在 `@streamdown/math`、`mermaid` 渲染链上的传递告警；上游尚未发布兼容修复，为保留数学公式与图表渲染未做功能裁剪。**critical / high / moderate 已全部清零。**
- KaTeX 同时打包 woff2 / woff / ttf 冗余副本约 0.6 MiB，不影响功能。
- 旧画布中未迁移的参考图不会自动变成画布图片节点。
- 侧边栏「工作流」为 Lovart 技能/路线图入口，不再是占位页；无限画布、项目/收藏、技能库等核心模块已完成。
- 模型下拉的可选项取决于你在 API 配置里填写的模型列表；只填一个模型时下拉只有一项，可用「管理模型列表…」增补。
- 本版为 `v1.2.1`；升级前建议先备份数据。
- Windows 10 的深色标题栏、部分 DPI / 输入法组合可能仍有细节差异。

## 安全

如发现漏洞，请不要公开提交 Issue，使用 [GitHub 私有漏洞报告](https://github.com/huang957201826-cyber/panpan-workbench/security/advisories/new)，详见 [SECURITY.md](SECURITY.md)。

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可

本项目以 MIT 许可发布，详见 [LICENSE](LICENSE)。

本项目基于 [CookSleep 的 GPT Image Playground](https://github.com/CookSleep/gpt_image_playground) 修改而来，保留上游 MIT 版权声明，并在其基础上加入盼盼工作台自己的修改与发布材料。感谢上游作者与所有第三方依赖作者；完整第三方许可见应用内“设置 → 关于 → 第三方许可”。
