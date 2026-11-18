# 交互矩阵（R7 / N52）

- 目的：确认“新建、重命名、删除、折叠、切换、搜索、筛选、多选、网格”在项目、画布、输入、卡片、设置之间不互相打架。
- 状态：1.2.1 候选实现；✅ 有 E2E/单测证据，🟡 部分覆盖或人工走查。
- 证据：`e2e/canvas-multi.e2e.ts`、`e2e/workflow.e2e.ts`、`e2e/home.e2e.ts`、`e2e/download.e2e.ts`、`e2e/params-dropdowns.e2e.ts`、`e2e/skills.e2e.ts`、`e2e/audit-interactions.e2e.ts`、`e2e/r9-layout.e2e.ts`。

| 区域 | 交互 | 期望 | 验证 | 状态 |
|---|---|---|---|---|
| 侧栏 | 点击项目 | 恢复该项目上次画布；无记录取第一个 | `canvas-multi` R2/N32 | ✅ |
| 侧栏 | 新建项目 | 底部按钮；创建后进入项目 | `workflow` U1 | ✅ |
| 侧栏 | 项目重命名 | 双击/右键；Escape 取消不提交 | `workflow` R2/N32 | ✅ |
| 侧栏 | 删除项目 | 确认；取消保留；删除后只剩一个项目 | `audit-interactions` 项目删除 | ✅（任务跨项目未单独造数） |
| 侧栏 | 折叠/展开 | 头部按钮；画布/卡片/首页都能展开 | `workflow` R1/N39 | ✅ |
| 侧栏 | 搜索 | 只搜项目名，不匹配画布名 | `audit-interactions` 侧栏搜索 | ✅ |
| 画布胶囊 | 单击 | 切换画布 | `canvas-multi` N50 | ✅ |
| 画布胶囊 | 新建 | 创建后直接进入命名态 | `canvas-multi` N50 | ✅ |
| 画布胶囊 | 双击 | 原地重命名；Escape 取消 | `canvas-multi` N50 | ✅ |
| 画布胶囊 | 右键 | 重命名/复制/删除 | `canvas-multi` N50 | ✅ |
| 画布胶囊 | 删除 | 走 deleteCanvas(move/delete)；最后画布拒绝；切相邻 | `canvas-multi` N50 | ✅ |
| 画布胶囊 | 溢出 | 横向滚动/箭头，不 slice 6 | `canvas-multi` N50 | ✅ |
| 画布 | 撤销 | 单任务/单素材移动、缩放、对齐/排列、删除共用栈 | `canvas-multi` R1/B06b | ✅ |
| 画布 | 撤销失败 | 保留条目、按钮恢复、不显示成功 | 单测/失败注入 | ✅ |
| 画布 | 搜索/筛选/多选 | 不在画布顶部；卡片视图头部 | 多选：`task-export` 批量 ZIP；筛选：人工 | 🟡 |
| 输入框 | 发送 | 有提示词或有技能即可 | `home`、`download`、`task-export` | ✅ |
| 输入框 | 质量/尺寸/数量/更多 | 独立胶囊；GIF/SVG 本地转换；GIF 2048px 提示 | `params-dropdowns`、`download`、`task-export` | ✅ |
| 输入框 | 遮罩/右侧停靠 | 独立图标 | 右侧停靠：`task-export`；遮罩：人工 | 🟡 |
| 输入框 | 卡片视图切换 | 右下角；右停靠也可见 | `workflow` R1/N39、R2/N40 | ✅ |
| 首页 | 参数 | 模型/尺寸/数量/格式/质量写回同一 GenerationParams | `home` 首页参数 | ✅ |
| 首页 | 技能 | 图标打开选择器；chip；空提示词可生成 | `home` 两个技能用例 | ✅ |
| 卡片视图 | 列数 | 3/4/5 列封顶；1024/1440 不溢出 | `download` R4 | ✅ |
| 卡片视图 | 下载/详情 | 下载走 localExportFormat；详情打开 DetailModal | `download`、`task-export`、`image-detail` | ✅ |
| 技能选择器 | 分类 | 左侧栏；搜索；固定框；长列表滚动；应用/编辑/多图 | `skills` N51、`r9-layout` N57 | ✅ |
| 设置 | 保存/取消 | 保存写回；实际无取消入口，关闭即提交 | `audit-interactions` 设置 | 🟡 |

## 已知边界

- 设置弹窗没有“取消”语义：关闭、遮罩、Escape 都会提交；E2E 只覆盖“关闭即保存 + 无取消按钮”，不新增取消功能。
- 遮罩编辑器没有专用 E2E，仍为人工走查。
- 项目删除已覆盖确认/取消和剩余项目，但未单独造“两个项目各有任务”的数据验证任务隔离。
- 旧 `CanvasWorkbench` 只删除三个死按钮，旧界面全路径未审计/未重构。
- 跨画布批量删除仍 Toast-only。
- 删除恢复取消时已写入的单条图片/任务不回滚。
- GIF 最长边 2048px；透明仅 1 位；SVG 为位图包装。
