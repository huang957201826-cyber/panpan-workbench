# REPORT-B03 — 交付安装批

- 日期：2026-11-10
- 版本：1.0.1
- 结论：**完成并已安装**；数据无损，Lovart 技能页在安装版可用。

## 1. 交付内容

- **S1 制度执法**：`WORKFLOW_STATE` 状态块、`workflow-state` / `review-packet` / `pre-push` 钩子。
- **S2 应用修复**：错误分类提示（超时/无 Key/余额不足/鉴权/限流/网络/服务端/审核）；侧栏「工作流」占位替换为「Lovart 技能」。
- **S3 Lovart 技能包**：27 条技能只读快照、MANIFEST 索引、分类/搜索/优先级筛选、image/enum/text/number/multi/bool 表单、必填校验、交付规格确认、一键填入输入台。
- **S4 验收**：参数下拉 5 条、Lovart 1 条、画布缩放/平移/拖动不跳动 1 条 E2E；1077 单测；105 Rust；1.0.1 签名构建。
- **S5 安装**：备份 → quick_check → 静默覆盖安装 → 启动 → 数据核对。

## 2. 门禁与证据

| 项 | 结果 |
|---|---|
| `npm run gate:dev` | 通过（1077 单测 + 构建 + release-check） |
| `npm run e2e` | 7/7 通过 |
| `cargo test` | 105 通过 |
| 安装包 | 10,526,164 B，SHA256 `4B2708F0008013D64839FDF995F517C127F53FCDE77DAE752438F991AC964403` |
| 安装 | 注册表 `DisplayVersion=1.0.1`，路径 `E:\02-RUANJIAN\67-盼盼工作台\PanPan Workbench` |
| 数据 | 安装前/后均 12 任务 / 15 图片；`quick_check=ok` |
| Lovart | 安装版 27 条可加载，`space.commercial-photo` 可打开 |

证据：

- `docs/execution/GATES-B03.json`
- `docs/execution/evidence/b03-pre-install-data.json`
- `docs/execution/evidence/b03-post-install-data.json`
- `docs/execution/evidence/b03-lovart-skills.png`
- CI 终态：<https://github.com/huang957201826-cyber/panpan-workbench-dev/actions/runs/42671302913>（6 passed / 1 skipped，Lovart 无源包跳过）。

## 3. 数据与回滚

- 备份：`E:\02-RUANJIAN\67-盼盼工作台\backups\b03-pre-install-20261110`
  - `data\`：安装前数据，quick_check ok，12 任务 / 15 图片。
  - `app\`：1.0.0 的 exe/uninstaller/bin/skills。
- 1.0.0 回滚包：`PanPan Workbench_1.0.0_x64-setup.exe`，10,448,444 B，SHA256 `49DD2D3A3A0E31B996248A1B5BAEB00DF09FD9FBF298540391706CC01626EB98`，`.sig` 存在。
- 不重建同号 1.0.0。

## 4. 已知限制（本批未做）

- N-04 全局 `workflow-gate` 插件：无人值守改全局 OpenCode 插件/权限风险高，下一批；本批用 pre-push + 状态块 + 审查包替代。
- N-22 干净虚拟机安装/卸载：无独立环境，未实测。
- N-23 真实 API 出图：夜间不消耗真实额度，使用 mock provider。
- N-24 公开发布仓/Release：本批只做本机安装；公开仓仍是 1.0.0。
- N-25 Authenticode：未做代码签名；Tauri updater 签名已完成。
- N-21 打包版逐控件点击：本批只做启动、数据、Lovart 页冒烟；`tauri-driver` 下一批。
- Lovart 是构建时快照：源包更新后需重新构建；CI 无源包时 Lovart E2E 自动跳过，安装包仍可启动但技能页为空。

## 5. 下一批（B04 候选）

- N-04 全局 workflow-gate 插件；N-21 tauri-driver；N-22 干净虚拟机。
- N-07 错误分类已做，可继续补真实 API 错误样本。
- N-08/N-10/N-11/N-12/N-14/N-15/N-16/N-17/N-18/N-30 等产品缺口见 `LEDGER.md`。
