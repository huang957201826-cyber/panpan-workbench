# REPORT-B04B — 1.0.3 底座与技能批

- 日期：2026-11-10
- 版本：`1.0.3`
- 提交：`f83e988f2f9b931f921849b1fec9bd5954d04378`
- 方案：`PLAN-B04B.md`，SHA256 `A7687CFB02862C694A4E6E7EBA91712C9DBD80ACBFC0F6365FC5DAE1DD4ADFE8`
- 结论：双视图选中/动作统一、技能库两 Tab、底部选用技能、chip 合并、v4 兼容导出、C1/C5/U1/U2 已完成；1.0.3 已安装验证。

## 1. 本批改动

### 双视图底座

- 任务选中统一到 `useStore.selectedTaskIds`；删除 StudioShell 本地选中与画布 selectionCommand。
- 素材选中新建 `useCanvasSelectionStore`，分 `selectedNodeIds`（节点 id）与 `selectedAssetImageIds`（素材 imageId）。
- `src/lib/selection.ts` 提供 `clearAllSelection()`，清任务 + 两个素材集合 + `selectionClearNonce`；画布/详情/收藏/切画布共用。
- 新建 `src/lib/taskActions.ts`：下载、删除任务/素材、重试、设为参考图、复用、编辑输出、详情、保存为技能；画布、九宫格、DetailModal、StudioShell 统一调用。
- parity 矩阵见 `B04B-PARITY-MATRIX.md`；ImageContextMenu 无任务映射标 N/A，旧主页 InputBar/Agent 不在 Studio 范围。

### 技能库

- 新增 `Skill`/`SkillSlot`/`SkillSlotValue`/`TaskSkillContext` 类型；`useCapabilitySkillStore` 存「我的技能」。
- `PromptSkill` 增加 `kind:'prompt'` 并进 normalize 白名单；旧数据不破坏。
- 技能库改为两 Tab：技能 / 提示词库；技能卡有纯色封面占位，我的技能可手动换封面。
- 底部输入栏新增「选用技能」，支持搜索、分类、槽位表单、图片槽和最终提示词预览。
- 应用后合并为一个 chip；`useStore.prompt` 仍是唯一用户文字，chip 存 `activeSkillId` + `skillSlotValues`。
- 提交时合并：技能基座 → 【本次输入】槽位 → 【用户补充】用户文字；超长阻止提交，不截断用户文字。
- `task.prompt` 保存合并文本，`task.skillContext` 保存槽定义、槽值、用户原文；复用恢复用户原文 + chip，重试不二次合并。
- 画布快照保存 `activeSkillId`/`skillSlotValues`，接入 normalize / 持久化 / merge / 导入变化检测 / 隐私快照；关闭“重启保留输入”时剔除。
- `clearInputAfterSubmit` 已实现；清空输入会同时清 chip。
- 导出保持 manifest version 4，新增可选 `capabilitySkills`；旧 v4 导入不产生能力技能，新包同 ID 覆盖、内置不覆盖我的。
- `public/lovart-skill-kit` 改名 `public/skill-kit`，同步脚本改名 `sync-skill-kit.mjs`；删除旧 Lovart 页面与旧 fetch 路径，界面无 Lovart 文案。

### 可用性 Round 1

- C1：compact 模式补“生成中”虚化遮罩；低倍 canvas 占位对运行中任务使用 blur + 半透明。
- C5：新任务插入位置把画布素材节点一起纳入，避免压在参考图上。
- U1：项目树行内按钮改为悬停「…」+ 右键菜单（重命名、新建方案、删除）。
- U2：画布框选任务与素材；九宫格保留显式多选；跨视图选中由 store 保持。

## 2. 门禁

| 项 | 结果 |
|---|---|
| `npm run gate:dev` | 通过；93 文件 / 1085 测试；release-check 1.0.3 |
| `npm run e2e` | 11 条通过（新增技能 E2E、跨视图选中） |
| `cargo test` | 105 条通过 |
| 签名构建 | 通过，`.sig` 448 B |
| 安装 | 静默安装退出码 0；注册表与 exe 均为 1.0.3 |

## 3. 失败注入

- 让 `clearAllSelection` 只清任务不清画布素材 → U6 E2E 红；恢复后绿。
- 让提交跳过技能合并 → 技能 E2E 红；恢复后绿。
- 证据：`docs/execution/evidence/b04b-failure-injection.log`。

## 4. 数据

- 安装前备份：`E:\02-RUANJIAN\67-盼盼工作台\backups\b04b-pre-install-20261110`（data + app + 1.0.2 安装包 + `.sig`）。
- 安装前/后：12 任务 / 15 图片，`quick_check=ok`。
- 安装版技能选择器加载 27 条内置技能，分类与封面占位正常；证据 `b04b-installed-skill-picker.png`。

## 5. 产物

- 安装包：`PanPan Workbench_1.0.3_x64-setup.exe`，10,530,675 B，SHA256 `A3DA499B1FF8BF41C2955F228FAF131C6D46D33549FCBE8A23888213A729B14B`。
- 签名：448 B，SHA256 `0A71F9D3B538D154C95FB6B3A5C129161D76A5C080BE3F35064321764E2AA636`。
- 回滚包：1.0.2，SHA256 `8A3C2B6E840A1B8A4CA68007F5CAD0B3888B9853A89298A9C53F27400A05382A`，已复制到备份目录。

## 6. 已知限制

- 27 条技能的内容与封面精修在 B05；本版只做交互、迁移和纯色占位。
- 内置技能封面只读，手动换封面只对「我的技能」生效。
- 批量提示词提交暂不支持技能合并，会提示先关闭批量。
- 仅选用技能、不填用户文字时提交按钮仍禁用，需输入至少一个字；B05 修复。
- 旧 v4 导入、封面重启保留、隐私进入/退出已有单测覆盖，但未在安装版逐个点击。
- C1/C5 未做截图对比，U1 未单独 E2E；由构建与现有回归覆盖。
- 系统保存对话框仅 Windows；安装包未做 Authenticode 签名。

## 7. 回滚

1. 关闭应用。
2. 运行 `backups\b04b-pre-install-20261110\PanPan Workbench_1.0.2_x64-setup.exe /S`。
3. 需要时把 `backups\b04b-pre-install-20261110\data` 覆盖回安装目录 `data`。
4. 启动后检查版本 1.0.2、`quick_check=ok`、任务/图片计数。
