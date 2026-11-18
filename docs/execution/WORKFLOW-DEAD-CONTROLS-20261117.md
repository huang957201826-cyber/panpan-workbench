# 工作流画布：假实现清单（N5b 依据）

- 日期：2026-11-17
- 对象：`src/studio/modules/workflow/ComfyWorkflowView.tsx`（2386 行，与 vendor 原件仅差 3 行 import）
- 入口：预览态 `Ctrl+Alt+W`；左栏「工作流」仍指向旧页
- 结论：画布、节点、参数控件是真的；**执行链路整段是假的**。

## 假实现

| 编号 | 位置 | 现状 | 目标 |
|---|---|---|---|
| WF-01 | `handleRunBatteryWorkflow`（约 600–680 行） | 四个 `setTimeout` 模拟 12%→…→100% 的进度，不请求任何后端 | 用现有 `comfyClient` 提交 API 工作流，进度来自真实队列事件 |
| WF-02 | 同上，输出节点 | 结果图取 `WORKFLOW_DEMO_ASSETS.renderedAtrium`（内置演示图） | 用真实提交返回的图片 |
| WF-03 | `handleDownloadOutput`（约 829 行） | 下载的是上一张 demo 图 | 下载真实产物；没有产物时按钮禁用并说明 |
| WF-04 | 输入节点默认值（约 115 行） | 默认填入 `WORKFLOW_DEMO_ASSETS.clayModel` | 默认空图 + 提示"上传或从画布选图" |
| WF-05 | 历史记录归档 | 运行后写入的"历史"来自假运行 | 来自真实任务记录（现有 projectWorkflows 保存） |
| WF-06 | 参数控件 | 控件能改值，但**不参与任何提交**（因为提交是假的） | 每个参数映射到 API 工作流对应字段 |

## 已经是真的（不用改）

| 项 | 依据 |
|---|---|
| 画布拖拽 / 缩放 / 全览 | `InteractiveDotGrid` + viewport 逻辑 |
| 节点选中、分组框、连线 | 组件内状态 |
| 遮罩画笔 | canvas `toDataURL` |
| 上传图片 | 文件选择 + 本地对象 URL |
| 导出工作流 JSON | `JSON.stringify` + 下载 |
| 返回大厅 | `onBackToGallery` |

## N5b 拆分

1. **N5b-1**：只接「无损放大」一条，把 WF-01/02/03 打通，参数从节点读取；
2. **N5b-2**：接其余三条（抠图 / 局部重绘 / 截图转效果图），复用同一提交函数；
3. **N5b-3**：WF-04/05/06 收尾（默认空图、历史来自真实任务、参数映射校验）。

每条验收：真跑一次、出图、下载可用；截图存 `docs/execution/evidence/`。

## 引擎前置（未决）

客户没装 ComfyUI 时，画布现在只会报「请先运行 scripts\fetch-local-engine.ps1」。
建议顺序：先 N5b 接通真引擎 → 再做 P0 引导（状态卡 + 官方下载链接 + 选择目录 + 一键启动）。P1 一键下载安装、P2 模型包另排。


## N5b-1 实施结果（WF-01 / WF-02 / WF-03 已完成）

- 运行：`handleRunBatteryWorkflow` 改为 async，删掉四个 `setTimeout`；「无损放大」走 `runWorkflow('qwen-upscale', { image, scale, model })`，`image` 是上传时留下的原始 `File`，`scale` 取控制节点滑杆（1–2），`model` 取节点下拉（默认 `RealESRGAN_x4plus.pth`）。
- 进度：只显示「上传原图… / 排队中… / 渲染中…」和一条不确定进度条，不再出现百分比。
- 出图：`fetchOutputImage` → `URL.createObjectURL` → 对比图右半；历史记录同步写入。失败时把引擎返回的原文显示在画布顶部，不吞错。
- 下载：「保存到本地」只在有真实产物时可用，下载 PNG 命名为 `panpan-<preset>-<ts>.png`。
- 默认演示图：初始输出不再预填 `renderedAtrium`；输入仍显示演示图，但未上传 `File` 时运行按钮禁用（WF-04 留到后续）。
- 另外三条：抠图 / 局部重绘 / 截图转效果图运行按钮置灰，文案「该流程尚未接通」。

### 预设 → manifest 映射（N5b-1 时点）

| 预览流程 | 原型预设 | manifest id | 引擎状态 |
|---|---|---|---|
| 无损放大 | `wf-upscale-ultrasharp` | `qwen-upscale` | 已接通，走 `runWorkflow('qwen-upscale')` |
| 抠图 | `wf-cutout-birefnet` | `matte-cutout` | 未接通，按钮禁用 |
| 局部重绘 | `wf-inpaint-fill` | `qwen-retouch` | 未接通，按钮禁用 |
| 截图转效果图 | `wf-model-single` | `qwen-su-render` | 未接通，按钮禁用 |

### 实测

- 引擎侧：`execution_start` 1794791399912 → `execution_success` 1794791409505，**9.6 秒**（提交到出图约 10 秒）。
- 产物：`panpan-qwen-upscale-1794895044772.png`，**1648×1648 / 801250 字节（约 782 KB）**，4 倍放大，不是演示图。
- 证据：`n5b1-real-run.png`（真实出图）、`n5b1-downloaded.png`（下载产物）、`n5b1-disabled.png`（其余流程禁用）。

### 仍为假实现（转入后续批次）

- WF-04：输入默认仍是演示图，未上传时禁用运行，但没有「从画布选图」。
- 项目工作流的新建/切换仍只存在宿主内存。
- 历史记录只存内存，刷新即丢。
- 遮罩画笔的 `toDataURL` 结果还没有作为 `mask` 上传。
- 「保存到本地」下拉里的另存 / 覆盖仍只导出 JSON。


## N5b-2 实施结果（表格驱动四条流程）

- 提交逻辑合并为一份：四条流程共用 `runWorkflow` + `fetchOutputImage`，参数与必填项按 `FLOW_SPECS` 表取，不再各写一套。
- 必填项缺失时按钮置灰并在旁边写明原因（例：「请先在图像上涂抹蒙版」「请先填写正向提示词」），不做假失败。

### 已验证

| 流程 | 结果 |
|---|---|
| 抠图 | **已验证**：引擎侧 10.0 秒，输出透明底 PNG；证据 `n5b2-cutout.png` |
| 蒙版链路 | **已修好**：关闭遮罩弹层后画布 ref 为空，改为用 `maskSnapshotUrl` 把橙色叠加层转成引擎要求的黑底白区 PNG，再包成 `File` 提交 |
| 缺蒙版禁用 | **已验证**：按钮置灰 + 「请先在图像上涂抹蒙版」；证据 `n5b2-mask-hint.png` |

### 未完成界面取证（known-limit，不算通过）

| 流程 | 现状 |
|---|---|
| 局部重绘 | 代码已接（原图 + 黑底白区蒙版 + 提示词 + denoise 0.55），界面出图截图待补 |
| 截图转效果图 | 引擎侧已证明可跑：应用提交的真实任务 `execution_success`，耗时 **947.1 秒**，写出 `su-render_*.png`；应用在截图前被重启，界面取证待补 |

### 性能事实

- qwen 系列（局部重绘 / 截图转效果图）在本机（RTX 4070 12GB）单次约 **15 分钟**，且当前 API 工作流一次写 8 张输出；批量 ×2/×4 的验证成本会成倍增加。
- 批量按钮 `×2` / `×4` 目前不参与提交，已按「空控件零容忍」置灰，只保留 `×1`（提交 `fix(workflow): 批量按钮未接通前禁用`）。


## N5c：切换入口（1.4.0）

- 左栏「工作流」改为渲染 `WorkflowHub`（`ComfyWorkflowView` + 四条流程表），旧 `WorkflowView` 文件保留，删除放 S7。
- 画布「返回大厅」改为**「返回工作区」**，切回 `projects` 活动；这是本批唯一改动的文案。
- 移除预览痕迹：`Ctrl+Alt+W`、`?workflow=prototype`、`WorkflowPrototypeHost` 与顶部预览提示条。
- 四条流程标签保留在画布左下角；已真跑通的两条可用，两条 qwen 流程可用但较慢，不置灰。
- 批量仍只 `×1`（`×2` / `×4` 置灰）。


## 1.5.0：引擎状态与演示图（WF-04 已完成）

| 项 | 处理 |
|---|---|
| 引擎状态会骗人 | `LocalEngineCard` 改为每 5 秒轮询 `probeEngine()`，页面隐藏时暂停；`window.focus`、`visibilitychange` 与运行失败（连接类错误派发 `panpan-engine-recheck`）都会立即重探；探到未运行自动展开引导卡片 |
| WF-04 加载图像默认演示图 | **已完成**：默认不填演示图，改为虚线上传占位；只有用户上传后才显示缩略图；出图对比区同样改为空态占位 |
| 预览残留 | `Ctrl+Alt+W`、`?workflow=prototype`、`WorkflowPrototypeHost` 与提示条已全部移除（App.tsx 一并提交） |

证据：`n5-150-engine-auto.png`（杀引擎后卡片自动展开）、`n5-150-empty-input.png`（加载图像空态）。
