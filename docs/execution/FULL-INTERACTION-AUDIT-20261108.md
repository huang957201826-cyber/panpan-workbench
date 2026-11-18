# 盼盼工作台 v1.0.0 全量交互审查报告

- 生成时间：2026-11-08
- 审查触发：用户实机反馈「输入框下面调分辨率、调出图张数都无法调整」
- 审查性质：**只测不改**。本轮未修改任何源码 / 配置 / 依赖 / 版本号，未重新构建，未重新发布，未改动公开仓与 Release。
- 结论一句话：**用户反馈属实，且比反馈的更严重——底部浮岛输入栏 5 个下拉里的 22 个选项，真实鼠标点击 100% 失效。** 这是 P5 把菜单改成 portal 时引入的回归，上一轮「全量审查」口径没有覆盖「点选项 → 值写回」这一步。

---

## 一、审查范围与方法

### 1.1 测试通道

| 通道 | 用途 | 结果 |
| --- | --- | --- |
| Playwright-core + Edge (headless) 访问本机 dev server `127.0.0.1:5173` | 逐按钮真实鼠标点击、DOM/计算样式/localStorage 对比 | 主通道，全程可用 |
| 注入 localStorage 进入 6 种界面状态 | 覆盖默认态、底部浮岛/右侧停靠 × 无限画布/九宫格、技能库、设置 | 全部生效 |
| 软件内置 MCP `--mcp-stdio` | 连接真实 1.0.0 程序，读取项目/画布/任务/设置 | **连接成功** |
| 检查 `dist/assets/*.js` 发布构建产物 | 确认打包版是否含同一段缺陷代码 | **确认包含** |
| 检查安装目录、`data.db`、注册表 | 真实安装环境核对 | 完成 |
| WebView2 CDP 直连（`--remote-debugging-port=9222`） | 试图直接在打包版 WebView2 内点击 | **未成功**（见 1.3） |

### 1.2 关于「直接连 MCP」

用户提示软件开了 MCP，实测情况需要如实说明：

- 软件内置 MCP **默认关闭**。真实 `data.db` 里 `mcp-config`、`mcp-token` 均未设置，默认端口 `7331` 未监听；WorkBuddy 侧也没有已安装的对应 connector。
- 但软件提供 `--mcp-stdio` 只读入口。我用它**真实连上了安装版程序**：
  - `serverInfo: { "name": "panpan-workbench", "version": "1.0.0" }`
  - 暴露 6 个工具：`project.list`、`canvas.list`、`task.list`、`task.get`、`image.get`、`settings.get`
  - 读到真实数据：2 个项目（默认项目、测试专用项目）、2 个画布、1 条含输出图的任务、2 个 API profile（激活的是「20261106-特惠API」，model `gpt-image-2.5`）
  - `settings.get` 脱敏正确：只返回 `baseUrlHost`（`api.openai.com` / `api.tehui.xyz`），不含密钥
- **能力边界**：MCP 是只读数据接口（HTTP 模式下另有 `task.create` / `image.attach` 两个写入工具，且必须主窗口 UI 确认），**不能驱动 UI 点击**。因此「每一个按钮都测」用浏览器自动化完成，MCP 用于数据层核对。

### 1.3 打包版验证方式与限制

- 尝试给真实安装包启用 WebView2 CDP 调试端口（先起第二实例、又重启主实例），端口均未启用，`http://127.0.0.1:9222/json/version` 无响应，未找到 `DevToolsActivePort`。因此**没有在打包版 WebView2 内直接点击**。
- 替代证据链（三条独立）：
  1. 发布构建产物 `dist/assets/App-JG0cG92k.js`（2026-11-08 04:39，安装包 04:40 打包）内含压缩后的缺陷代码：
     ```js
     const U=z=>{O.current&&!O.current.contains(z.target)&&y(!1)};
     return document.addEventListener("mousedown",U),...
     ```
     即 `dropdownRef.current.contains(e.target)` 判定 + `setActiveDropdown(null)`。
  2. dev server 与打包版是同一份源码、同一套构建配置；该缺陷是纯前端 DOM 事件顺序问题，与 Tauri/WebView2 无关。
  3. 通过 `--mcp-stdio`、安装目录、`data.db` 确认真实程序就是 1.0.0。
- 审查期间为尝试 CDP 重启过 2 次应用，**现已以正常参数恢复运行**（窗口标题「盼盼工作台」）。

### 1.4 覆盖统计

| 阶段 | 内容 | 交互次数 |
| --- | --- | --- |
| 2b | 6 种界面状态首屏按钮逐个真实鼠标点击 | 181 |
| 2c | 5 个下拉的 22 个选项 × 真实鼠标 / 直接 click 两种路径 | 44 |
| 2f | 右侧停靠「参数配置」tab 55 个按钮逐个点击 | 55 |
| 2f | 「设置图像尺寸」弹窗：3 个 tab、18 个按钮、确定/取消流程 | 12 |
| 4 | 技能库 33 个按钮 + 删除确认/取消专项 | 36 |
| 5 | 设置弹窗 6 个 tab 共 87 个控件 | 87 |
| 2d/2e/1b | 补测、根因三组对照 | 约 20 |
| **合计** | | **约 435 次控件交互** |

未覆盖/部分覆盖（如实列出，见第九节）：需真实 API key 的生成提交端到端链路、图片拖拽/画布节点右键菜单的真实鼠标轨迹、深色主题逐项视觉核对、卸载重装/干净虚拟机、其他 `mousedown + portal` 组合的同类隐患逐一验证、打包版 WebView2 内直接点击。

---

## 二、P0 核心缺陷：输入栏下拉选项全部点不动

### 2.1 复现结果（阶段 1）

注入 `inputDockPosition=bottom` 进入底部浮岛，逐个打开 5 个下拉并**真实点击选项**：

| 下拉 | 初始显示 | 选项数 | 真实鼠标点击后 | mousedown 后菜单是否还在 |
| --- | --- | --- | --- | --- |
| 模型 | `gpt-image-2.5-sunburst` | 1 | 值不变 | **否** |
| 尺寸 / 分辨率 | `尺寸 自动` | 5 | 值不变 | **否** |
| 质量 | `质量 auto` | 6 | 值不变 | **否** |
| 出图张数 | `数量 1` | 3 | 值不变 | **否** |
| 更多 | `更多 PNG` | 7 | 值不变 | **否** |

全程 **0 个 pageerror、0 个 console error** —— 静默失效，没有任何报错提示，用户只会觉得「点了没反应」。

### 2.2 每一个选项逐个点（阶段 2c）

| 下拉 | 选项 | 真实鼠标 | 直接 click |
| --- | --- | --- | --- |
| 模型 | `gpt-image-2.5-sunburst`（唯一项） | 无效 | 无效（当前值） |
| 尺寸 | 自动 / 1K 16:9 / 1K 9:16 / 2K 16:9 / 更多尺寸… | **0/5 生效** | 3/5 生效 |
| 质量 | auto / low / medium / high / xhigh / max | **0/6 生效** | 5/6 生效 |
| 张数 | 1 张 / 2 张 / 4 张 | **0/3 生效** | 2/3 生效 |
| 更多 | PNG / WebP / JPEG / 透明背景 / 审核 auto / 审核 low / 批量提交 | **0/7 生效** | 2/7 生效（其余为当前值或选中态在 class 上） |

**汇总：22 个选项，真实鼠标点击生效 0 个；绕过 mousedown 直接 click 生效 12 个。**

补充：「更多」面板里的透明背景、批量提交用直接 click 可切换（关闭→开启），内容审核 `low` 的选中态 class 也从 false→true —— 说明**写回逻辑本身是完好的**，坏的只是鼠标事件路径。

### 2.3 根因（已用三组对照钉死）

`src/studio/components/BottomPromptBar.tsx:149-157`：

```ts
useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setActiveDropdown(null);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

而 P5 把 `src/ui/Menu.tsx` 改成了 portal：

```ts
return createPortal(<div role="menu" data-overlay ...>{children}</div>, document.body)
```

菜单被挂到 `document.body`，**不在 `dropdownRef` 内**。事件顺序被破坏：

1. 用户按下鼠标 → 原生 `mousedown` 冒泡到 `document`
2. `handleClickOutside` 判定「点在 dropdownRef 外面」→ `setActiveDropdown(null)`
3. React 立即卸载 portal 菜单
4. 鼠标抬起后浏览器派发 `click`，**目标节点已经不存在** → 选项的 `onClick` 永远不执行

注意 `Menu` 容器上的 `onPointerDown={e => e.stopPropagation()}` 只拦 `pointerdown`（React 合成事件），拦不住原生 `mousedown`，所以补不上这个洞。

**三组对照（阶段 1b，以「质量」为例，初始 `auto`，目标 `high`）**：

| 实验 | 做法 | mousedown 后菜单 | 结果 |
| --- | --- | --- | --- |
| A | 绕过 mousedown，直接对选项派发 `click` | — | `auto → high` **生效** |
| B | 运行时在捕获阶段拦截 `mousedown`（模拟移除旧监听）后真实鼠标点击 | **仍存活** | `auto → high` **生效** |
| C | 当前版本真实鼠标点击（对照组） | **已消失** | 值不变 **复现** |

截图证据：`audit-clarify-sizepicker-DIRECT.png` 弹出了「设置图像尺寸」窗口，`audit-clarify-sizepicker-MOUSE.png` 什么都没弹 —— 同一入口，两种点击路径结果不同。

### 2.4 影响面

- 所有生成参数不可设置：模型、分辨率、质量、出图张数、导出格式、透明背景、内容审核、批量提交。
- 「更多尺寸 / 比例…」入口也打不开（真实鼠标路径），尺寸弹窗无法进入。
- 底部浮岛是用户主动切换到的模式；**默认安装态是右侧停靠**（见 P1-1），右侧「参数配置」tab 的 inline 参数控件是可用的（实测 55 个控件 25 个状态变化，尺寸/质量/格式/数量/审核/透明全部生效）。也就是说：**同一套参数，两套 UI，一套能用一套全废**，行为严重不一致。
- 右侧停靠的快捷胶囊使用同一个 portal `Menu`，但没有那个 mousedown 监听，实测「数量」快速胶囊能改值 —— 进一步佐证根因定位。

### 2.5 修复方向（本轮不实施）

1. 移除 `BottomPromptBar` 里遗留的 `mousedown` outside-click 监听，统一交给 `Menu` 的 `pointerdown` + `data-overlay` 浮层栈处理。
2. 或把监听改成 `pointerdown`，并同时排除 `target.closest('[data-overlay]')` 与触发按钮。
3. 顺带把 5 个下拉的选项改成 `MenuItem`（`role="menuitem"`），否则 `Menu` 的 ↑↓/Home/End/Enter 键盘模型找不到项目（当前 `menuItems()` 查 `[role="menuitem"]` 返回空）。
4. **同类隐患排查**：全项目至少 8 处 `document.addEventListener('mousedown', ...)` 的 outside-click 监听（`TitleBar.tsx:71`、`Select.tsx:115`、`InputBar.tsx:1194/1219`、`SearchBar.tsx:90`、`TaskGrid.tsx:251`、`HistoryModal.tsx:198`、`AgentWorkspace.tsx:251` 等）。凡是与 portal 浮层组合的都可能有同样的误杀，本轮只确认了 `BottomPromptBar`，其余需逐一验证。

---

## 三、完整缺陷清单

| 编号 | 级别 | 问题 | 证据 | 状态 |
| --- | --- | --- | --- | --- |
| **BUG-01** | **P0 阻断** | 底部浮岛 5 个下拉 22 个选项真实鼠标点击 100% 失效 | 阶段 1 / 1b / 2c；发布构建产物含同一段代码 | 待修 |
| **BUG-02** | **P1 需求缺口** | 新用户首次安装默认 `inputDockPosition: 'right'` + `viewMode: 'grid'`，与用户要求「输入栏在下面 + 无限画布」相反 | `workspaceState.ts:83-92`；阶段 1 Part A 实测：无 `[data-input-bar]`、右侧抽屉存在 | 待改（用户明确需求） |
| **BUG-03** | P2 功能受限 | 模型下拉只有 1 个选项，无法切换模型 | `modelOptions` 来自激活 profile 的单个 `model` 字段；MCP `settings.get` 佐证 | 待改 |
| **BUG-04** | P2 一致性 | 同一参数两套 UI：右侧「参数配置」tab 可用、底部浮岛全废 | 阶段 2f：55 控件 25 个状态变化；阶段 2c：22 选项 0 生效 | 待评估 |
| **BUG-05** | P2 体验 | 尺寸弹窗选完具体分辨率后，胶囊显示「尺寸 当前」而不是具体数值 | 阶段 2f：`尺寸 自动 → 尺寸 当前`；`aspectRatios.find` 未命中时回退到「当前」 | 待改 |
| **BUG-06** | P3 可用性 | 5 个下拉选项无 `role="menuitem"`，键盘 ↑↓/Enter 无法激活 | `Menu.tsx:113` 查 `[role="menuitem"]`；`BottomPromptBar` 用裸 `div`/`button` | 待改 |
| **BUG-07** | P3 同类隐患 | 全项目 8+ 处 `mousedown` outside-click 监听与 portal 组合可能同样误杀 | 静态扫描 | 未逐一验证 |
| **BUG-08** | P3 待复查 | 右侧停靠「参数配置」tab 打开时，quick model 胶囊点击超时 1 例（索引 50） | 阶段 2f | 需复查 |
| **OBS-01** | 观察 | 默认尺寸为 `auto`，尺寸胶囊显示「自动」，下拉首项为「当前」，文案不直观 | 阶段 2c | 建议优化 |
| **OBS-02** | 观察 | 设置弹窗为模态，背景控件被遮罩拦截（35/60 次点击超时） | 阶段 2b S6 | **预期行为，非缺陷** |

---

## 四、逐模块测试结果明细

### 4.1 首屏按钮（阶段 2b，真实鼠标，每个按钮独立重载页面）

| 场景 | 控件 | 成功点击 | 禁用跳过 | 点击失败 | 无可观察反应 | 控制台报错 |
| --- | --- | --- | --- | --- | --- | --- |
| S1 新用户默认（right + grid） | 36 | 33 | 2 | 0 | 0 | 0 |
| S2 底部浮岛 + 无限画布 | 38 | 35 | 2 | 0 | 0 | 0 |
| S3 底部浮岛 + 九宫格 | 34 | 31 | 2 | 0 | 0 | 0 |
| S4 右侧停靠 + 无限画布 | 40 | 37 | 2 | 0 | 0 | 0 |
| S5 技能库入口态 | 24 | 23 | 1 | 0 | 1（已在技能库页，属正常） | 0 |
| S6 设置弹窗 | 60 | 22（弹窗内） | 2 | 35（背景被模态遮挡，预期） | 0 | 0 |

**关键教训**：这 181 次点击「全部有反应」看起来很漂亮，但反应类型只是「菜单打开了」「对话框出现了」「文本变了」。**「菜单能打开」不等于「选项能选」** —— 这正是上一轮审查的盲区，也是本次 P0 被漏掉的直接原因。

### 4.2 右侧停靠「参数配置」tab（阶段 2f）

55 个控件逐个点击：**25 个状态变化、27 个无变化、1 个失败、0 控制台错误**。

- 生效的：3 个尺寸预设、5 个质量档、WebP/JPEG、2/4 张、透明背景、审核 low、从画布选择等。
- 27 个「无变化」绝大多数是点击当前已选中项（`auto`、`PNG`、`1`）或导航类按钮（新建方案、筛选、九宫格、参数配置 tab 自身），属预期。
- 1 个失败：quick model 胶囊点击超时（BUG-08）。

### 4.3 设置图像尺寸弹窗（阶段 2f）

- 通过直接 click 打开弹窗：初始 6 个按钮（自动 / 按比例 / 自定义宽高 / 取消 / 确定）；切到「按比例」后 18 个按钮（1K/2K/4K、9 种比例、自定义比例、取消、确定）。
- 点了 6 个尺寸/比例选项，点「确定」后胶囊从 `尺寸 自动` 变为 `尺寸 当前`（BUG-05）。
- 弹窗本身交互可用；**问题只在于用户用真实鼠标根本进不来**（BUG-01）。

### 4.4 技能库（阶段 4）

注入 2 条纯测试技能（用户已授权可随意删），33 个控件逐个点击：**0 失败、0 控制台错误**。

- 通过：分类/标签/收藏筛选、底模筛选菜单、新建技能弹窗、卡片打开 Inspector、复制配方、一键调用、收藏/取消收藏、删除按钮。
- 删除专项：确认框文案「删除「审查测试技能 A」后不可撤销…」→ 取消后技能数仍为 2 → 确认后技能数变为 1 → toast「已删除技能」出现。**删除功能正常**（上一轮补的删除按钮没有回归）。
- 5 个「无可观察反应」均为当前已选中筛选项、收起侧栏、搜索框聚焦，属预期。

### 4.5 设置弹窗 6 个 tab（阶段 5）

| Tab | 控件 | 无反应 | 失败 | 控制台错误 |
| --- | --- | --- | --- | --- |
| 通用 | 22 | 13 | 0 | 0 |
| 外观 | 7 | 1 | 0 | 0 |
| 技能 | 7 | 1 | 0 | 0 |
| API | 20 | 10 | 0 | 0 |
| 数据 | 17 | 9 | 0 | 0 |
| 关于 | 14 | 1 | 0 | 0 |
| 合计 | **87** | 35 | **0** | **0** |

「无反应」多为点击当前已选中项或纯展示控件；全程无报错。此阶段为运行时 `el.click()`（非真实鼠标），但阶段 2b 的 S6 已用 Playwright 真实鼠标验证过弹窗内 22 个控件全部可点，两条路径互补。

### 4.6 默认新用户态（阶段 1 Part A）

干净 context、不注入任何 localStorage：

```json
{
  "viewMode": "grid",
  "inputDockPosition": "right",
  "hasBottomFloatingBar": false,
  "hasRightDrawer": true
}
```

即首次安装是**右侧停靠 + 九宫格**，底部浮岛输入栏不出现。用户要求的「输入栏在下面 + 无限画布」需要改 `createDefaultWorkspace()` 的默认值（并处理 `normalizeWorkspace` 对旧数据的兼容）。

### 4.7 MCP 数据层核对（阶段 3）

- 连接成功，`serverInfo` 版本 1.0.0，6 个只读工具全部可列。
- `project.list` 2 项、`canvas.list` 2 项、`task.list` 1 条任务（含 params 与输出图 id）、`settings.get` 返回 2 个脱敏 profile。
- 佐证 BUG-03：激活 profile 的 `model` 是单一值，导致 `modelOptions` 只有 1 项。
- 结论：数据层与 MCP 通道健康，缺陷在前端事件层。

---

## 五、为什么上一轮「全量审查」没查出来（流程复盘）

必须说清楚，这不是运气问题，是**审查口径错了**：

1. **口径错配**：上一轮「全量审查」覆盖的是构建 / 测试 / 发布链路 —— `npm test`（88 文件 1058 用例）、Playwright 实机回归、`npm audit`、Tauri 编译与覆盖安装、Release 资产与更新端点、隐私扫描。这些**都不验证「用户真实鼠标点选 → 值写回 → 参数生效」**。于是「全绿」被误当成「能用」。
2. **UI-37 脚本的盲区**：`artifacts/ui37-verify.cjs` 只测了「菜单能否弹出 + computed fontSize + ↑↓/Home/End/Esc 焦点归还」，**从头到尾没有点击过菜单里的任何一个选项**。而缺陷恰好在「点选项」这一步。当时甚至记录过「模型下拉只有 1 项」，却没顺手点一下选项。
3. **回归同源未识别**：P5 把 `Menu` portal 化同时带来两个症状 —— ① 菜单文字继承 body 的 16px（UI-37，看得见，已修）；② outside-click 误杀选项（看不见，未修）。上一轮只修了看得见的那个，没意识到两者是同一个改动引入的。
4. **测试层级缺口**：单测全是纯函数（`adapters`、`exportZip`、`promptSkills`、`workspaceState`），没有组件级交互测试（无 React Testing Library / E2E 点击用例）。`mousedown` 与 `click` 的事件顺序、portal 与 `contains()` 的组合，纯函数测试永远测不到。
5. **评分口径**：上一轮给的 8.6/10 衡量的是「工程完成度」（代码量、测试数、发布链路、合规），不是「功能可用度」。用户主链路被阻断的产品不该拿 8.6 分。**本轮修正评分见第七节。**

**应当固化的检查项**（写进后续发布闸门）：
- 每个下拉必须验证「打开 → 点选项 → 显示值变化 → 持久化 → 生成请求里带上」的完整链路，而不是只看弹出与字号。
- 每个 portal 浮层必须与宿主组件的 outside-click 监听做联合回归。
- 组件级交互测试（至少覆盖 5 个参数胶囊、删除确认框、新建弹窗）纳入 CI，不能只跑纯函数单测。

---

## 六、用户需求登记（本轮不改代码）

> 「默认别人第一次安装的新用户输入栏要在下面，并且是无限画布的形式」

- 当前默认：`inputDockPosition: 'right'`、`viewMode: 'grid'`（实测确认）。
- 目标默认：`inputDockPosition: 'bottom'`、`viewMode: 'canvas'`。
- 改动点：`src/lib/workspaceState.ts:83-92` `createDefaultWorkspace()`；`normalizeWorkspace()` 第 144-145 行的兜底 `'canvas' ? 'canvas' : 'grid'` / `'bottom' ? 'bottom' : 'right'` 需一并调整，且要考虑老用户已有持久化数据不被强制覆盖。
- 关联：默认值改了以后，底部浮岛成为首屏主界面 —— **必须先修 BUG-01，否则新用户第一次打开就会撞上一整排点不动的参数按钮**，体验会更糟。建议两个改动同批交付、同批回归。

---

## 七、完成度重新评分

| 口径 | 上一轮 | 本轮修正 | 说明 |
| --- | --- | --- | --- |
| 相对 P0–P6 计划完成度 | 100% | **100%** | 计划项确实都做完了 |
| 工程完成度（代码/测试/发布/合规） | 8.6 | **8.6**（维持） | 这部分证据依然成立 |
| **功能可用度（真实用户能不能用）** | 未单独评估 | **6.0 / 10** | **核心参数控件全废，主链路阻断** |

**综合修正分：6.0 / 10**（上一轮 8.6 偏高，原因是把工程完成度当成了产品完成度）。

- 扣分主体：BUG-01（-2.0，阻断）、BUG-02 默认态不符（-0.3）、BUG-03 模型单选项（-0.2）、BUG-04/05/06 一致性与可用性（-0.3）、无 Authenticode、仅 Windows 验证、干净虚拟机未实测、CI 全自动发布缺 Secret（-0.2 沿用）。
- 修复 BUG-01 + BUG-02 并重新发版后，预计可回到 **约 8.2 / 10**。

分维度（本轮重评）：

| 维度 | 分 | 变化 |
| --- | --- | --- |
| 功能完整度 | 6.5 | ↓（原 9.0，核心参数不可用） |
| 工程质量 | 8.8 | 持平 |
| 测试与验证 | 5.0 | ↓（原 8.5，交互测试缺口暴露） |
| 安全与合规 | 8.0 | 持平 |
| 发布与文档 | 9.0 | 持平 |
| 跨平台适配 | 6.5 | 持平 |
| 运维可维护性 | 8.0 | 持平 |

---

## 八、发布影响与建议动作（本轮均未执行）

1. **已发布的 v1.0.0 Release 带此缺陷**。公开仓、tag、三件资产目前都不变（本轮未动）。
2. 建议修复顺序：BUG-01 → BUG-02（默认态）→ BUG-03/05/06 → 补组件级交互测试 → 本地全量回归 → 重新构建 + 重新签名 + 重生成 `latest.json` → 更新 Release 资产（或按用户此前拍板「最终 1.0.0 同号重建」处理；若发 `v1.0.1` 则需同步 `make-update-manifest.mjs` 的 URL 规则与 README）。
3. 注意 GitHub 会把 Release 资产名里的空格转成点（`PanPan Workbench_...` → `PanPan.Workbench_...`），上一轮已修进 `make-update-manifest.mjs`，重新生成清单时不要回退这条。
4. **本轮未改代码、未提交、未推送、未重新构建、未重新发版、未改动公开仓与 Release**，严格遵守「先不做代码调整」。

---

## 九、未覆盖项与后续建议

| 未覆盖 | 原因 / 建议 |
| --- | --- |
| 生成提交端到端（提交 → 请求 → 出图 → 重试） | 需要真实 API key；建议在测试环境用 mock provider 补一条 E2E |
| 图片上传/拖拽、画布节点右键菜单、缩放拖拽真实轨迹 | 需要构造图片素材与鼠标轨迹，建议单独一轮画布专项 |
| 深色主题逐项视觉核对 | 本轮只测浅色；建议主题切换后复跑 2b |
| 卸载重装、干净虚拟机、其它 Windows 版本 | 沿用上一轮已知限制 |
| 打包版 WebView2 内直接点击 | CDP 端口未启用；已用发布构建产物静态证据 + 同源码实测 + MCP 真实连接三条替代 |
| 其他 `mousedown + portal` 组合（8 处） | 建议按 BUG-07 统一排查，避免修完一处又冒出另一处 |
| 组件级交互测试纳入 CI | 当前 CI 只有纯函数单测 + 构建，建议加 Playwright 冒烟（至少覆盖 5 个参数胶囊） |

---

## 十、证据文件清单

所有脚本与原始结果位于 `C:/Users/95720/WorkBuddy/2026-11-07-22-12-27/artifacts/`：

| 文件 | 内容 |
| --- | --- |
| `audit-core-dropdowns.cjs/.json` | 5 个下拉核心复现 + 默认态 |
| `audit-rootcause.cjs/.json` | 根因三组对照（A/B/C） |
| `audit-enumerate.cjs/.json` | 5 场景控件静态枚举 |
| `audit-all-buttons.cjs/.json` | 6 场景 181 次真实鼠标点击全记录 |
| `audit-menu-options.cjs/.json` | 22 个选项 × 2 路径逐项结果 |
| `audit-extra.cjs/.json` | 右侧停靠、更多面板开关、尺寸弹窗初测 |
| `audit-clarify.cjs/.json` + `audit-clarify-sizepicker-*.png` | 尺寸弹窗截图证据、审核选中态 |
| `audit-deep-params.cjs/.json` + `audit-sizepicker-ratio-tab.png` | 尺寸弹窗完整流程、参数配置 55 控件 |
| `audit-skills.cjs/.json` + `audit-skills-final.png` | 技能库 33 控件 + 删除专项 |
| `audit-settings-tabs.cjs/.json` | 设置 6 tab 87 控件 |
| `audit-mcp-connect.cjs/.json` | MCP 连接与真实数据读取 |
| `audit-a-default-state.png` / `audit-b-menu-*.png` / `audit-enum-*.png` | 各状态截图 |

---

**最终结论**：用户实测反馈完全成立，且是 P0 级阻断缺陷；上一轮「全量审查」因口径错配漏检。本轮已完成约 435 次控件交互的全量筛查，定位到确切根因与 8 项缺陷 / 观察项，修正完成度评分为 6.0/10，并完成用户需求登记。**本轮没有做任何代码调整或重新发布。**
