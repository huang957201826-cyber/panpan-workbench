# STATUS · 2026-11-17 · 三页 UI 回退（1.3.3）

## 结论

按指令回退到 `dd11859` 之前的三页 UI，保留本地引擎与 ComfyUI 后端能力；1.3.3 已覆盖安装。

- BASE：`1c6a925`（`docs: 设置向导阶段记录`，即 `dd11859` 的父提交）
- 恢复方式：`git checkout 1c6a925 -- <path>`，未手写、未重生成

## 恢复与删除

| 文件 | 处理 |
|---|---|
| `src/components/SettingsModal.tsx` | 从 BASE 恢复（六栏、DPAPI、导入导出、MCP、更新、备份） |
| `src/studio/components/WorkflowView.tsx` | 从 BASE 恢复（按项目工作流 + 三节点画布 + 真实运行） |
| `src/studio/components/AppSidebar.tsx` | 从 BASE 恢复（去掉工作流/技能分类抽屉） |
| `src/studio/components/CapabilitySkillLibrary.tsx` | BASE 技能页入口，保持原样 |
| `src/App.tsx` | 设置弹窗导入改回 BASE 的 `components/SettingsModal` |
| `src/studio/StudioShell.tsx` | 技能页改回 `CapabilitySkillLibrary`，恢复侧栏折叠条件；移除 `modules/*` 引用 |
| `src/studio/modules/**` | 整目录删除（workflow 与 ported） |
| `e2e/**` | 恢复 BASE 用例（与新 UI 不再匹配的后续断言一并回退） |
| `src-tauri/**`、`src/lib/comfy*`、`src/studio/workflows/**`、`projectWorkflows` | 未动 |

## 逐页点验（安装版 1.3.3）

### 设置

- 六栏均在：API / 通用 / 外观 / AI 工具集成 / 数据 / 关于。
- API：已保存配置下拉、导入配置码、配置名称、服务商类型、API URL、API Key、测试连接、模型 ID、保存；均绑定原有处理逻辑。
- 数据：导出所选数据、从 ZIP 导入、清空所选数据、备份/恢复入口均在。
- 关于：版本、更新检查、第三方许可入口在。
- 未发现“点了完全无反应”的控件；本轮只做入口与渲染点验，未执行真实导入/导出文件写入。

### 技能库

- 可用：搜索、分类筛选、收藏、新增技能、技能卡打开、选用技能（顶部与底部）。
- **不可用/已随回退移除**：卡片上的「复制 / +追加 / 替换」三动作；BASE 技能页没有这三个按钮，1.3.2 的纯文指令卡也一并移除。

### 工作流

- 可用：进入工作流页、左侧按项目分组、点技能新建工作流、进入三节点画布、点「运行」触发校验、返回项目。
- 点「运行」在未选原图时提示「请先选择「原图」」——这是 BASE 的既有校验，不是失效按钮；真实出图需先在素材节点选图。

## 门禁与安装

- `npm run build`：通过
- `npm test`：1129 条通过
- `npm run gate:dev`：通过（SAST、release-check 1.3.3）
- 安装包：`PanPan Workbench_1.3.3_x64-setup.exe`（12.50 MiB）
- SHA256：`B1872F8E2163EA31C82EC73D907456387A17DB66B266CC3C2F6E63CC1CF70347`
- 覆盖安装后注册表 `1.3.3`，实机启动并逐页点验。

## 已知限制

1. 技能页恢复为能力技能库，不再有纯文卡的复制/追加/替换。
2. 设置恢复为六栏旧版式，不再有 820×660 五栏、API 三步、推荐折叠与未保存底栏。
3. 工作流恢复为三节点画布，不再有大厅两段式与真实节点分组。
4. 未 push、未打 tag；`tauri.conf.json` 仍 `createUpdaterArtifacts: true`。

## 回滚

- 安装包：`PanPan Workbench_1.3.2_x64-setup.exe`
- 数据：`backups\20261117-1.3.3-a`
