# P5 设置壳 / Agent 下线 / 占位与长稳 · 阶段报告

- 阶段：P5（设置 6 Tab、Agent 下线、工作流/技能库占位、长稳）
- 分支：studio
- 日期：2026-11-05
- 依据：`盼盼工作台执行方案.md` v1.4、`docs/studio-p1-contracts.md`

---

## 1. 本阶段交付

### 1.1 设置 6 Tab

- `SettingsTab` 收敛为 6 个：`general / appearance / skill / api / data / about`。
- 设置页左侧导航固定为：**通用 / 外观 / 技能 / API / 数据 / 关于**。
- 默认打开「通用」，保留原设置页的全部功能：
  - 通用：提交方式、清空输入、Studio 工作台开关、重启保留输入、参考图编辑、通知、更新等；
  - 外观：主题、字体、界面尺寸等；
  - 技能：桌面端保留现有 Skill 设置；Web 端显示“技能库仅在桌面端可用”；
  - API：配置、模型、代理、参数、供应商等全部原功能；
  - 数据：导出/导入/清空、备份、存储信息；
  - 关于：版本、更新、第三方许可、字体许可。
- 移除 Agent 设置 Tab 及其专用状态/提交逻辑；Agent 数据字段仍保留在设置结构里，保证旧任务和旧备份可读。

### 1.2 Agent 模式 UI 下线

- 设置页不再有「Agent 配置」。
- 旧布局顶栏移除「画廊 / Agent」切换；`App` 不再渲染 `AgentWorkspace`，启动时把持久化的 `appMode=agent` 拉回 `gallery`。
- 旧布局 `CanvasWorkbench` 顶栏的 Agent 按钮已删除。
- `Header` 的 Agent 历史/新对话入口、Agent 会话标题、移动端下拉提示已清理；`HistoryModal` 不再切换到 Agent。
- 通用设置里的「Agent 对话」段（自动滚动、公式提示）已删除。
- Studio 壳子不提供 Agent 入口。
- 旧 Agent 任务仍按 `canvasId` 显示在九宫格/画布（`useCanvasTasks` 不过滤 `sourceMode`）。
- Agent 相关的 store/API 代码保留，仅用于读取旧数据，不再产生新入口。

### 1.3 工作流 / 技能库占位

- 左侧活动栏的「工作流」「技能库」按钮启用，点击进入占位页。
- 占位页显示：
  - 图标；
  - 「工作流即将开放」/「技能库即将开放」；
  - “项目、画布、生成和设置不受影响。该模块会在后续版本开放。”；
  - 「返回项目」按钮。
- 非项目活动时左侧 230px 抽屉自动收起，只保留图标栏，避免露出 AI Studio 的 ComfyUI/Skill 演示内容。
- 右侧/底部输入台只在项目活动中显示。

### 1.4 长稳与内存

- 3000 任务、右侧历史流展开、画布手动 100% 视图，连续采样 60 秒：
  - 系统总内存（主进程 + 本应用 WebView2 子进程）：**728.5–729.3MB**；
  - 主进程：53.6–53.8MB；
  - WebView2：674.7–675.5MB，6 个进程；
  - 60 秒内无增长、无 OOM、窗口保持可用。
- 该组合此前在 P4 开发态出现过一次 OOM；本次按最终默认「首屏 fit + 卡片按需加载」复测未复现。
- 说明：3000 任务的 100% 视图仍会加载当前可见的 18 个节点缩略图和右侧 30 条历史大图，因此总内存约 0.7GB；这是当前取样口径下的稳定值。

---

## 2. 验证

| 项 | 方式 | 结果 |
|---|---|---|
| 编译 | `npx tsc -b` | 通过 |
| 构建 | `npm run build` | 通过 |
| 单测 | `npm test` | 71 files / 944 tests passed |
| 设置 Tab | Tauri dev + UIA | 仅 通用/外观/技能/API/数据/关于，无 Agent |
| 工作流占位 | Tauri dev | 「工作流即将开放」+ 返回项目，抽屉收起 |
| 技能库占位 | 代码路径 | 与工作流共用占位分支 |
| Agent 入口 | Tauri dev + 代码 | 设置无 Agent；旧布局无画廊/Agent 切换；CanvasWorkbench 无 Agent 按钮；App 不渲染 AgentWorkspace |
| 旧布局回归 | 关闭 Studio 工作台 + 画布模式 | CanvasWorkbench 正常渲染，UIA 无任何 Agent 文本/按钮 |
| 旧 Agent 任务 | 代码路径 | `useCanvasTasks` 不按 sourceMode 过滤，旧任务按画布显示 |
| 3000 长稳 | Tauri dev，60s | 总内存 728.5–729.3MB，稳定，无 OOM |
| 真实数据 | SQLite | 验证后恢复 13 tasks |

截图：

- `C:\Users\95720\生图软件二开\screenshots\p5-settings-6tabs.png`
- `C:\Users\95720\生图软件二开\screenshots\p5-workflow-placeholder.png`
- `C:\Users\95720\生图软件二开\screenshots\p5-3000-100-memory.png`

---

## 3. 本阶段没做

- P6 安装包/发布流程：待 P5 Gate 通过后执行。
- Agent 历史数据的删除/迁移：本期只下线入口，保留旧数据可读。
- 工作流/技能库真实功能：按方案先占位。
- 更长时间（10 分钟以上）的系统级内存趋势：当前 60 秒稳定；P6 打包后可再跑一次。

---

## 4. 已知边界

1. 设置页沿用原设置弹窗的结构和视觉，只做 Tab 收敛；没有重做 AI Studio 风格设置页。
2. 传统布局仍保留旧 Agent 组件文件与 store 数据，但设置、顶栏、CanvasWorkbench、HistoryModal 的入口已移除；旧 Agent 任务仍可读。
3. 3000 任务 100% 视图总内存约 0.7GB，主要来自历史流大图与可见节点缩略图；后续可把历史流也改成缩略图，进一步降低。
4. Web 端「技能」Tab 只显示桌面端提示，不加载 Skill 设置。

---

## 5. Gate 5 自检

- [x] 设置固定 6 Tab：通用/外观/技能/API/数据/关于。
- [x] Agent 设置 Tab / 顶栏切换 / AgentWorkspace / CanvasWorkbench 按钮下线。
- [x] 旧布局关闭 Studio 后画布模式无 Agent 文本/按钮。
- [x] 旧 Agent 任务仍按画布显示。
- [x] 工作流、技能库入口保留并显示占位页。
- [x] 非项目活动抽屉收起，不暴露演示工作流。
- [x] 3000 + 右侧历史流 + 100% 视图 60 秒总内存稳定，无 OOM。
- [x] 944 tests / build 通过。
- [ ] 独立审查通过（待 Gate 5）。
