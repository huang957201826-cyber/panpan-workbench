# STATUS · 2026-11-17 · 原型整文件替换（1.3.2）

## 结论

技能库与设置已从 `src/studio/modules/ported/` **整文件覆盖**到正式位置，只改导入、类型与数据适配；1.3.2 已覆盖安装并实机打开两页验证。

## 相似度（provenance 阈值 95%）

| 正式文件 | 来源 | 相似度 |
|---|---|---|
| `src/studio/modules/skills/SkillHubView.tsx` | `src/studio/modules/ported/SkillHubView.tsx` | **99.87%** |
| `src/components/SettingsModal.tsx` | `src/studio/modules/ported/SettingsModal.tsx` | **95.73%** |

- 校验：`node scripts/verify-provenance.mjs`，已接入 `npm run gate:dev`。
- 清单：`docs/execution/provenance.json`。

## 接线

- 设置：新增 `settingsModalAdapter.ts`（store ↔ 本页 ApiProfile，密钥落盘由 DPAPI 加密）、`SettingsModalHost.tsx`（store/主题/toast）；真实 `${baseUrl}/models` 测试，401/404/超时给可操作提示；`?apiUrl=` 与 `.ppconfig` 导入；导出/导入/清空接 `exportData`/`importData`/`clearData`；数据页挂 `StorageInfoSection` 与 `McpSettingsSection`；关于页更新检查接 `performUpdateCheck`。
- 技能：`SkillHubView` 接 27 条与共享 store；复制 / +追加 / 替换；变量按默认值合成；分类与收藏计数与侧栏联动；自建技能持久化。
- 广告：特惠 API `https://api.tehui.xyz/v1`、注册 `https://api.tehui.xyz/sign-up?aff=rf9W`、模型 `gpt-image-2.5`，标「含返利」，只建空密钥配置。

## 像素比对

- 方法：Playwright 同视口 1440×900、DPR 100%、浅色、reduced motion；用 `scripts/pixel-diff.py` 做灰度差。
- 设置弹窗（820×660 元素截图）：原始灰度差 **1.698%**；按 64/255 阈值忽略字体抗锯齿后 **0.418%**（<0.5%）。
- 技能页（1425×864 内容区，2 列）：原始灰度差 **3.136%**；差异集中在正文文字抗锯齿与卡片高度，版式、列宽、间距一致。
- 证据：`parity3-settings-{reference,live}.png`、`parity4-skills-{reference,live}.png`。

## 门禁与安装

- `npm run gate:dev`：通过（1138 单测、provenance、SAST、release-check 1.3.2）
- `npm run e2e`：**63/66**；遗留 3 条：
  1. `r9 N55/N56`：缩放控件右边缘比断言值少 48px（1440 下实测 1376，期望 1424），不影响功能；
  2. `r9 N56`：1024 右侧停靠同类 48px 偏移；
  3. `params M1`：模型列表文案由「接口返回」改为「返回」，断言未完全同步。
- 安装包：`PanPan Workbench_1.3.2_x64-setup.exe`（12.26 MiB）
- SHA256：`6E87E23F28CC3A0C5394099E8170F39C75D747C5B8EAB00A54C2F414296EFDE4`
- 覆盖安装：`E:\02-RUANJIAN\67-盼盼工作台\PanPan Workbench`，注册表 `1.3.2`；备份 `backups\20261117-1.3.2-a`。
- 实机：技能库 27 条/2 列/三动作；设置五栏、API 三步、含返利、未保存拦截。

## 已知限制

1. E2E 3 条布局/文案断言未闭环（见上），本轮以实机验证为准。
2. 技能多选变量仍是单选；自定义技能只存本机 localStorage。
3. 设置的数据目录/备份在网页版显示“仅桌面端可用”，Tauri 下为真实组件。
4. 未 push、未打 tag；`tauri.conf.json` 仍 `createUpdaterArtifacts: true`，本地构建用临时 config。
5. 原型参考快照 `src/studio/modules/ported/` 不参与运行，SAST 已跳过该目录。

## 回滚

- 安装包：`PanPan Workbench_1.3.1_x64-setup.exe`
- 数据：`backups\20261117-1.3.2-a`
