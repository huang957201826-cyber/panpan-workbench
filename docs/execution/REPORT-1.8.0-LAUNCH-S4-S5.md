# REPORT — 1.8.0 S4+S5 合并批次

- 状态：`APPROVED`，独立定向 `CODE_REVIEW=APPROVE`
- 基线提交：`556dab1`（S2+S3）
- 范围：三栏 UI 一致、工作流拖动性能、MCP 只读诊断

## 交付

- 新增共享侧栏规格 `sidebarStyles.ts`，项目、工作流、技能三栏统一 240px 宽度、标题字号、36px 条目、图标按钮、列表间距和底部操作几何。
- 工作流节点拖动使用单个 `requestAnimationFrame` 合并样式写入；拖动节点使用 `transition-none`，松手后提交 React 状态落点。
- MCP 新增 `skill.list`、`workflow.list`、`workflow.get`、`diagnostics.get`、`backup.verify`，只读且分页上限 200。
- MCP 不返回技能正文/描述、工作流记录标题/摘要、提示词参数、日志原文、绝对路径、API Key 或 token。
- 工作流 `values` 只返回技术白名单字段；字符串统一清除路径、Bearer、`sk-*`、token/password/secret。
- Host、Origin、Bearer 和限流错误返回稳定 JSON 错误代码；stdio 继续不暴露写入工具。
- 技能名称/分类、工作流名称、预设/工具/分辨率等所有自由文本统一走完整字符串脱敏；含路径或密钥的整个字段替换为 `[redacted]`。

## 门禁

- `npm run gate:dev`：通过
- 前端：110 文件 / 1165 用例通过
- Rust：114 用例通过
- build、SAST、release-check、vendor、typography：通过
- Playwright：三栏几何 + 节点拖动 `2/2` 通过

## Known-limits

- 连线实时跟手继续留到后续批次，本批只保证节点落点、参数和撤销正确。
- `backup.verify` 只检查 SQLite/kv 类别和计数，不读取安装版 IDB 文件正文；真实安装版在 S7/U2 复验。
- `skill.list` 当前不含 `builtin:*` 和内置覆盖层，不是完整技能库快照。
- `backup.verify` 不覆盖 workspace、缩略图和工作流 IDB 图片正文。

## 结论

- 独立复审已通过；允许进入最后合并批次 `S6+S7`。

## 第一轮审查阻塞项

- 已修复 MCP metadata 路径/密钥泄漏：所有自由文本字段使用完整字符串检测，覆盖含空格路径、UNC、file URL、Bearer、`sk-*`、token/password/secret/authorization/cookie；新增恶意名称和记录元数据回归。
- 路径检测继续覆盖 `C:/...`、`C:\...`、`//server/share`、`\\server\share`、`/Users/...`、`/home/...` 和常见 POSIX 前缀；UUID、哈希、`wf-*`、`wfi-*`、`builtin:*` 保持原样。
