# 设计系统标准（Design System v1）

- 日期：2026-11-07
- 状态：**规范草案，未落代码**；确认后作为所有 UI 改造的唯一依据
- 目的：把现在"16 种字号 / 6 种圆角 / 3 套图标 / 3 套视觉语言"收敛成一套可执行的令牌 + 组件规范
- 约束：不改技术栈（Tailwind 3 + CSS 变量），不引第三方 UI 库，保持现有的黑白极简 + 蓝色单点缀的品牌感

---

## 0. 现在的问题（为什么必须做这套标准）

| 现象 | 证据 |
|---|---|
| 字号失控 | 全项目 16 种任意字号（8/8.5/9/9.5/10/10.5/11/11.5/12/12.5/13/13.5/14/15/16/17），`text-[10px]` 68 处、`text-[11px]` 59 处，9px 及以下 33 处 |
| **用 CSS 打补丁** | `studio.css:126-136` 直接改写类名：`.text-[9px]→12px`、`.text-[10px]→12.5px`… 靠覆盖层"把字放大"，组件本身没改 |
| 圆角/阴影无序 | `rounded / md / lg / xl / 2xl / 3xl / [px]` 混用；`shadow-xs → shadow-2xl` 无层级语义 |
| 图标三套 | 手写 SVG（AppSidebar/CanvasTaskNode）+ lucide（BottomPromptBar）+ **文字符号**（"↓"、"⌘↵"、"★"） |
| 控件三态缺失 | 无统一 `:focus-visible`；禁用态 `opacity-30/35/40` 三种写法 |
| 视觉语言三套 | Studio 玻璃拟态 / 设置页上游灰白 / 原生 `<select>`、原生 `title` tooltip |

> 这套标准的第一个动作，就是把 `studio.css` 那 11 行字号覆盖删掉 —— 但顺序必须是"先按令牌改组件，再删补丁"，否则字会集体变小。

---

## 1. 颜色（Color）

两套主题共用同一组语义变量，浅色值 / 深色值成对出现，**代码里禁止直接写 hex**。

| 语义 | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--bg` | `#fbfcfd` | `#0c0e14` | 画布/页面底 |
| `--surface` | `#ffffff` | `#141620` | 卡片、面板 |
| `--surface-2` | `#f6f7f9` | `#1a1d28` | 次级容器、输入框底 |
| `--surface-3` | `#eef0f4` | `#222634` | hover 底、选中底 |
| `--border` | `rgba(0,0,0,.07)` | `rgba(255,255,255,.08)` | 常规描边 |
| `--border-strong` | `rgba(0,0,0,.16)` | `rgba(255,255,255,.18)` | 悬浮/聚焦描边 |
| `--text-1` | `#0f172a` | `#f1f3f7` | 标题、正文主色 |
| `--text-2` | `#475569` | `#a9b1c2` | 次要文字 |
| `--text-3` | `#94a3b8` | `#6b7385` | 说明、占位 |
| `--brand` | `#2563eb` | `#60a5fa` | 唯一强调色（选中、链接、进度） |
| `--brand-soft` | `rgba(37,99,235,.10)` | `rgba(96,165,250,.14)` | 品牌浅底 |
| `--success` | `#10b981` | `#34d399` | 完成 |
| `--warn` | `#f59e0b` | `#fbbf24` | 提示 |
| `--danger` | `#ef4444` | `#f87171` | 失败、删除 |
| `--selection` | `rgba(37,99,235,.22)` | `rgba(96,165,250,.28)` | 文字选中（全局） |
| `--focus` | `rgba(37,99,235,.55)` | `rgba(96,165,250,.65)` | 焦点环 2px |

**玻璃层**（浮层、底部输入台、卡片操作条）：`background: --surface` 85% + `backdrop-blur(16px)` + `--border` 1px。

**用色规则**
1. 蓝色只做"当前状态/可点强调"，**不做装饰**。一屏内蓝色元素 ≤ 3 处。
2. 危险色只在删除/失败出现，且必须配图标或文字，不靠颜色单独表意。
3. 深浅主题必须逐一配对，不允许"深色下某个面板还是白的"。

---

## 2. 字体与字号（Typography）

**字体栈**（沿用现有，不再引外部 CDN）：

```
--font-sans: 'HarmonyOS Sans SC', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif
--font-mono: 'Maple Mono NF CN', 'Cascadia Code', 'Consolas', monospace
```

**5 档字号**（只有这 5 档，新增字号需要改这份标准）：

| 令牌 | 字号/行高 | 字重 | 用途 |
|---|---|---|---|
| `text-caption` | 11 / 1.4 | 400 | 角标、标签、参数值、极密信息 |
| `text-body-sm` | 12 / 1.5 | 400 | **默认 UI 文案**：菜单项、筛选、说明 |
| `text-body` | 13 / 1.55 | 400 | 正文、卡片描述、输入框 |
| `text-title` | 15 / 1.4 | 600 | 面板标题、卡片标题、按钮组标题 |
| `text-page` | 20 / 1.3 | 600 | 页面级标题（技能库、设置页大标题） |

- 数字/模型名/尺寸一律 `--font-mono` + `text-caption`（如 `2560×1440`、`GPT-Image-2.5`）。
- **禁用** 8 / 8.5 / 9 / 9.5 / 10 / 10.5px —— 这是现在 33 处"看不清"的根源。
- 字重只用 400 / 500 / 600；不用 700 以上（CJK 会糊）。
- 中文字间距 0；英文标题 `letter-spacing: -0.01em`。

**字体体积**：当前 `dist/assets` 34MB，其中字体 30MB（3 份 HarmonyOS Sans **TTF 各 7.9MB** + MapleMono 6.1MB）。规范要求：**统一转 woff2 + 子集化**，目标 ≤ 10MB。

---

## 3. 间距（Spacing）

只有 6 个值：`4 / 8 / 12 / 16 / 24 / 32`。

| 场景 | 值 |
|---|---|
| 图标与文字之间 | 4 |
| 同级控件之间（按钮、pill） | 8 |
| 卡片内边距 | 12 |
| 区块之间（标题与内容） | 16 |
| 页面外边距 / 大区块 | 24 / 32 |

禁止 `gap-1.5`(6px)、`p-2.5`(10px) 这类"顺手值"——现在满屏都是 6/10/14 的混合值。

---

## 4. 圆角与阴影（Radius / Elevation）

**圆角 4 档**：`6`（chip、标签）、`8`（按钮、输入、菜单项）、`12`（卡片、面板）、`16`（模态、浮层）；胶囊用 `999`。

**阴影 3 层**：
| 层 | 值 | 用途 |
|---|---|---|
| `e1` | `0 1px 2px rgba(0,0,0,.05)` | 卡片常态 |
| `e2` | `0 8px 24px rgba(0,0,0,.10)` | 悬浮菜单、hover 卡片 |
| `e3` | `0 16px 48px rgba(0,0,0,.16)` | 模态、抽屉 |

深色主题阴影改为"发光描边"：`0 0 0 1px rgba(255,255,255,.08)` + 更弱的投影。

---

## 5. 图标（Icon）

- **只用一套**：lucide-react，`stroke-width: 1.6`。
- 三档尺寸：`16`（行内、按钮内）、`18`（工具栏）、`20`（侧栏）。
- **禁止文字符号当图标**：`↓`、`★`、`⌘↵`、`+` 全部换成 `Download / Star / Command+CornerDownLeft / Plus`。
- 图标按钮必须有 `aria-label`；`title` 只作为补充，**不再承担 tooltip 职责**（原生 tooltip 全部换成统一 Tooltip 组件）。
- 平台相关符号走运行时判断：Windows 显示 `Ctrl+↵`，macOS 才显示 `⌘↵`。

---

## 6. 控件与状态（Components & States）

**基础件清单**（新建 `src/ui/`，全部基于上面的令牌）：

| 组件 | 规格 |
|---|---|
| `Button` | 高度 28/32/36；主=实心黑（深色实心白）/次=玻璃底/幽灵=无底；圆角 8；水平内距 12 |
| `IconButton` | 32×32 命中区，图标 16/18，圆角 8，hover `--surface-3` |
| `Chip` / `Tab` | 高 24，圆角 6，`text-caption`；选中=实心，未选=透明+`--text-2` |
| `Field`（输入/搜索） | 高 32，圆角 8，`--surface-2` 底，聚焦 1px `--border-strong` + 2px 焦点环 |
| `Select` | **自绘**，禁止原生 `<select>`；带前置图标 + 下拉箭头，菜单用 `Menu` |
| `Menu` | 圆角 8，`e2`，最大高 `min(60vh, 320px)` + 内部滚动 + **空间不足自动向下翻转** |
| `Tooltip` | 深色玻璃，`text-caption`，延迟 400ms，最多 2 行 |
| `Card` | 圆角 12，`--surface`，`--border`，hover `e2` + 描边加深 |
| `PanelHeader` | 高 44/48，左标题+计数，右操作；`--border` 下边线；**sticky** |
| `EmptyState` | 图标 20 + 一句话 + 一个主按钮，居中 |
| `Modal` | 圆角 16，`e3`，遮罩 `bg-black/50` + blur 4；标题栏 44 |

**四态强制**：每个可点元素必须有 `hover / active / disabled / focus-visible` 四种视觉；禁用态统一 `opacity: .4` + `pointer-events: none`（不再混用 .3/.35/.4）。

**全局样式（一次性写进 `index.css`）**
```css
::selection { background: var(--selection); color: inherit }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px }
```

---

## 7. 布局（Layout）

```
┌────┬──────────────┬────────────────────────────────────────┐
│ 56 │  280 (可选)   │  48  Header（左标题 / 右操作）           │
│rail│  面板         ├────────────────────────────────────────┤
│    │              │  内容区 padding 16                      │
│    │              │  画布 / 九宫格 / 技能库                 │
└────┴──────────────┴────────────────────────────────────────┘
```

- **rail 56px**（现在 44），按钮 40px，图标 18px，激活态=左侧 2px 蓝条 + `--brand-soft` 底。
- **左面板 280px**，头部 44px 与主区 Header 对齐。
- **主区 Header 48px**，不浮动、`sticky`、两种视图共用（解决"画布浮层 / 九宫格标题"两套结构）。
- 最小窗口 960×640 下：rail 可折叠、左面板可收起、Header 右侧控件收进"更多"。

---

## 8. 动效（Motion）

| 令牌 | 值 | 用途 |
|---|---|---|
| `motion-fast` | 120ms ease-out | hover、点击、颜色变化 |
| `motion-base` | 200ms cubic-bezier(.2,.8,.2,1) | 展开/收起、菜单、弹层 |
| `motion-slow` | 420ms ease-out | 图片模糊揭示（生成完成） |

- 只动 `opacity / transform / background-color`；不动 `width/height`（避免重排）。
- `prefers-reduced-motion: reduce` 下全部降为 0ms，点阵光效关闭（已有实现，保留）。

---

## 9. 硬性禁令（Review 时逐条对照）

1. 禁止 `text-[…px]` 任意值 —— 只用 5 档令牌。
2. 禁止 `rounded-[…]`、`shadow-[…]` 任意值。
3. 禁止在组件里写 hex 颜色。
4. 禁止原生 `<select>`、原生 `title` tooltip。
5. 禁止文字符号当图标。
6. 禁止一个组件单独定状态色（hover/禁用/危险必须走令牌）。
7. 禁止只做浅色或只做深色之一。
8. 禁止出现两套并列的同类 UI（如两套 header、两套卡片操作条）。

---

## 10. 落地顺序（与 UI 改造批次绑定）

| 步 | 动作 | 说明 |
|---|---|---|
| 1 | 写 `tokens.css` + Tailwind 主题映射 | 只新增，不改组件，零风险 |
| 2 | 建 `src/ui/` 基础件（Button/IconButton/Chip/Field/Select/Menu/Tooltip/Card/PanelHeader/EmptyState/Modal） | 与旧组件并存 |
| 3 | 按新规范改「顶部 Header → 底部输入台 → 节点操作条 → 技能库 → 侧栏 → 设置页」 | 每块改完截图对照 |
| 4 | 删除 `studio.css:126-136` 字号覆盖层 | **必须最后做**，否则字号集体回退 |
| 5 | 全量扫一遍禁令（grep `text-\[`、`rounded-\[`、`<select`、`title="`） | 目标：任意值 0 处 |

**验收**：`grep -c "text-\["` 为 0；任意圆角值为 0；原生 select 为 0；字号枚举只剩 5 档；深浅主题逐屏截图一致。
