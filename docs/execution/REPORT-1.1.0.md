# REPORT — 1.1.0 UI 重塑与尾巴收口（2026-11-11）

## 范围

- UI：AI Studio 风格 Token、36px 顶栏、56px Rail、256px 抽屉、默认首页、画布悬浮分支胶囊、输入岛、设置/详情/九宫格/工作流换皮。
- 技能：删除提示词库并迁移旧 PromptSkill；内置技能可编辑基座提示词/恢复默认；主图 + 多参考图。
- 生图：默认 2.6；Gemini provider；2K/4K 能力表；GIF/SVG 真文件导出。
- 工程：第三方许可重生成、版本与发布材料。

## 验证

| 项 | 结果 |
|---|---|
| `npm run gate:dev` | 通过 |
| 单测 | 97 文件 / 1099 通过 |
| E2E | 22 通过 |
| Rust | 105 通过 |
| SAST | 通过 |
| 签名构建 | 通过 |
| 静默安装 | 通过，注册表 1.1.0 |
| 安装后数据 | 12 任务 / 15 图片；quick_check=ok |

## 独立审查

- 第一轮：`REJECT`，2 个数据语义阻塞：
  - 旧提示词变量占位符未展开；
  - 迁移清理条件可能让旧数据复活。
- 修复：`composeSkillPrompt` 展开 `{{key}}`/`{{label}}`；旧库存在条目即清空；补单测。
- 第二轮：`CODE_REVIEW=APPROVE`。

## 安装与回滚

- 安装包 SHA256：`AE6B0620736B384560571DD119CFA206F6B0953920B09CF8E42CA9B2D910B581`
- 双备份：`E:\02-RUANJIAN\67-盼盼工作台\backups\20261111-1.1.0-a`、`20261111-1.1.0-b`
- 回滚：重装 1.0.8 + 还原备份 data/app。

## Known limits

- Gemini / 2K / 4K 没有真实 Key/中转站，未 live 验证。
- SVG 是位图包装的真 `.svg`，不是矢量描摹。
- GIF 量化在主线程，超大/多图会短暂卡顿。
- 迁移不保留 `pinned`/`usageCount`/`author`/`sourceTaskId`。
- 内置技能编辑 UI 只开放 `basePrompt`，`name`/`description`/`slots` 仅有覆盖 schema。
- `ExportData.capabilityOverrides` 类型仍为旧三字段，新字段运行时透传。
