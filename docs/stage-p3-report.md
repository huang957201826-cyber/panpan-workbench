# P3 双输入台 · 阶段报告

- 阶段：P3（双输入台与完整参数）
- 分支：studio
- 日期：2026-11-05
- 依据：`盼盼工作台执行方案.md` v1.4、`docs/studio-p1-contracts.md`

---

## 1. 本阶段交付

### 1.1 双输入台

- 右侧 `RightGeneratorDrawer` 与底部 `BottomPromptBar` 共用同一个 `useStore` composer。
- 默认右侧；`inputDockPosition` 随 workspace 持久化。
- 右侧停靠按钮 → 底部；底部停靠按钮 → 右侧。
- 底部浮岛设置 `data-input-bar`，并维护 `--input-bar-clearance`，CanvasBoard 的 fit/底部工具条自动避让。

### 1.2 完整参数

右侧「参数配置」：

- API 配置选择（真实 `settings.profiles`）；
- 模型（当前 API 配置的真实模型列表）；
- 尺寸 auto / 1:1 / 3:2 / 2:3；
- 画质 auto/low/medium/high/xhigh/max；
- 输出格式 PNG/WebP/JPEG；
- 数量 1/2/4；
- 透明背景；
- 内容审核 auto/low；
- JPEG/WebP 压缩质量。

底部快捷胶囊：

- 模型、尺寸、质量、数量、更多（格式/透明/审核）；
- 无假参数、无假进度。

### 1.3 参考图 / 批量 / 遮罩 / @图N

- 两处输入台都支持真实参考图上传：`addImageFromFile` → `createInputImageFromFile` → 真实 hash ID。
- 参考图删除/排序走 `removeInputImage` / `reorderInputImages`，保留遮罩主图与 `@图N` 重映射。
- 右侧和底部都有「遮罩」入口，打开现有 `MaskEditorModal`。
- 右侧和底部都有批量开关：写真实 `settings.showBatchPrompt/batchPromptEnabled`，复用现有 `splitBatchPrompts`。
- `@图N` 普通文本解析已在 P-1 完成；textarea 输入、参考图点击插入、提交时解析。
- `isGenerating` 仍表示“提交中”，其他任务 running 不阻塞新提交。

### 1.4 P2 复审非阻塞加固

- `switchCanvas` 串行队列；恢复 snapshot 在每个 await 后校验 generation/active。
- 新建项目/画布走同一 workspace queue。
- `deleteCanvas` 入口拒绝默认画布；UI 隐藏默认画布删除。
- 删除后总是恢复当前 active composer。
- `moveTasksToWorkspace` DB-first；失败任务保持源画布。
- 删除画布/项目后立即 `cleanupUnreferencedImages`。

---

## 2. 验证

| 项 | 方式 | 结果 |
|---|---|---|
| 编译 | `npx tsc -b` | 通过 |
| 构建 | `npm run build` | 通过 |
| 单测 | `npm test` | 69 files / 933 tests passed |
| 底部 Dock | Tauri dev（副本数据） | 底部浮岛显示，参考图/提示词/参数/生成/停靠右侧可见 |
| 右侧参数 | Tauri dev | API 配置、模型、尺寸、画质、格式、数量、透明、审核、压缩显示 |
| 遮罩/批量入口 | 代码 + 界面 | 两处输入台都有入口 |
| 参考图真实 ID | 单测 | 上传参考图后 task.inputImageIds 为 image store ID |
| 排序/删除 | 单测 | mask 主图第一、@图N 重映射 |

截图：`C:\Users\95720\生图软件二开\screenshots\p3-bottom-dock.png`。

底部 Dock 验证使用 `dev-data` 副本；验证后已恢复，真实数据未动。

---

## 3. 本阶段没做

- 九宫格搜索/筛选/多选/批量工具条：P4。
- 画布真实比例、resize、LOD、3000 压测、AI Studio 节点换肤：P4。
- 设置 6 Tab 壳、Agent 下线、工作流/技能库占位：P5。
- 底部输入台的 API 配置/压缩控件：底部保持快捷，完整参数在右侧详细参数 Tab；符合“右侧详细参数承担全部参数”的决策。

---

## 4. 已知边界

1. 底部快捷胶囊尺寸使用 `auto/1024x1024/1536x1024/1024x1536` 固定真实集合；模型特有的更多尺寸在 P4/P5 可继续补。
2. 遮罩编辑依赖现有 `MaskEditorModal`，需要至少一张参考图。
3. 批量拆分沿用现有 `splitBatchPrompts` 规则，未新增独立批量编辑器。
4. 底部 Dock 高度通过 CSS 变量避让，窄屏仍可能压缩画布；P5 响应式统一收口。

---

## 5. Gate 3 自检

- [x] 默认右侧；底部/右侧切换。
- [x] 两处共享 prompt/params/参考图/遮罩。
- [x] 右侧完整参数；底部快捷参数。
- [x] 参考图真实 ID、删除/排序。
- [x] 批量开关。
- [x] 遮罩入口。
- [x] @图N 解析。
- [x] 932 tests / build 通过。
- [ ] 独立审查通过（待 Gate 3）。

---

## 6. Gate 3 复审修订

1. **删除非当前画布/项目不再覆盖当前 composer**：`deleteCanvas` / `deleteProject` 在删除前调用 `saveActiveCanvasSnapshot()`，把当前 live prompt/params/参考图/mask 落回 active 画布，再无条件恢复；立即 GC 也能保护新参考图。补“删除其他画布后 active prompt/参考图不变且图片仍存在”的测试。
2. **底部停靠同步 CanvasBoard 避让**：dock effect 在底部时同时 `useCanvasViewStore.setBottomInset(el.offsetHeight + 12)`，右侧时归零；ResizeObserver 更新也同步。
3. **启动恢复进入 workspace queue**：挂载时的 `restoreActiveCanvasSnapshot` 改走 `enqueueWorkspaceAction`，避免恢复中新建/切换覆盖草稿。
4. **尺寸选项包含当前值**：`STUDIO_SIZE_OPTIONS` 不含当前 `params.size` 时，下拉追加“当前”项，避免无选中项。
5. **P3 回归测试**：新增删除非当前画布 composer 保留测试；933 tests 通过。

验证：`npm test` 69 files / 933 tests passed；`npx tsc -b`、`npm run build` 通过。
