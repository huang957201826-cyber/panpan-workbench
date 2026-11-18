# 夜间自动推进交接（2026-11-17 02:40）

<!-- STATE_JSON
{
  "stage": "1.8.0-LAUNCH",
  "phase": "stage-S7",
  "version": "1.8.0",
  "plan": "docs/execution/PLAN-1.8.0-LAUNCH-20261117.md",
  "planHash": "B343E0CF467E2381239F36026D63581CE8955F84AB15D5C23846395938533728",
  "ledger": "docs/execution/ISSUE-LEDGER-20261117.md",
  "releaseAuthorized": false,
  "executionBatching": "S1 separate review; then S2+S3, S4+S5, S6+S7",
  "next": "S7 本地候选与 U2 已完成，等待用户明确发布授权"
}
STATE_JSON -->

## 当前开工状态（2026-11-17）

- `PROCESS_CHECK`：阶段 `1.8.0-LAUNCH / stage-S7`；最终签名候选、安装迁移与 U2 全部本地完成，停等发布授权。
- 总账：已收拢，未确认的新意见为 0。
- 发布锁：未授权 push/tag/Release。
- 代码状态：S1、S2+S3 已提交；S4+S5 已实现并停审，前端 1165 / Rust 113 测试通过。
- 预审：`ARCH_REVIEW=APPROVE`、`PLAN_REVIEW=APPROVE`。
- 协作规则：`WORKING-RULES.md` §2.1.1；当前窗口为总控 + 主开发，独立审查由用户复制短提示到新任务。
- Token 管控：`WORKING-RULES.md` §2.1.2；S1 后合并为三个施工批次，只做批次末全量门禁和一次独立复审，不再为小修重复生成完整审查包。

> 用户去睡觉，要求无人值守推进。醒来只看结果。
> 任何一次「醒来」先读本文件 + `DECISIONS-20261117.md` + `PLAN-RELAND-20261117.md`。

## 当前位置

| 项 | 值 |
|---|---|
| 安装版本 | 1.3.12 |
| 最新提交 | `b578d75` 回填 N3b-4 提交号 |
| 已完成 | S0 回退（1.3.3）→ S0.5 输入台（1.3.4）→ S1 基线 → N0 底边（1.3.5）→ N1 vendor → N2 adapter → N3a 设置页预览（1.3.6）→ N3b-1..b-4 设置页 11 项死控件全部接真（1.3.7–1.3.10）→ N3c 齿轮切到新设置页（1.3.11） |
| 基线数字 | 重复实现 3 组 / 最大 7581 行 / >800 行 18 个 / 裸 px 265 / 死代码 10 / 入口缺失 0 |
| 设置页状态 | **已替换入口**；11 项死控件清零（空控件扫描 0）；旧 `components/SettingsModal.tsx` 保留待 S7 删除 |
| 技能页状态 | **已替换入口**（1.3.12）：27 条、中文分类、替换/追加写输入台、新建置灰；组件仅 +10/−2 行 |`n| 下一步 | N5a 工作流画布预览（1.3.13）→ N5b 接真引擎 → 替换入口 |
| 调度事故 | 定时任务只在 03:10 触发一次，nextRunAt 停在 03:40 未再推进，导致 03:40–08:40 无人推进；不再单靠定时器，改为执行窗口连续推进 + 总控验收 |

## 关键决定（2026-11-17 上午）

- 设置页分两步：N3a 先做**预览宿主**（Ctrl+Alt+S 或 `?settings=prototype` 打开），齿轮仍开旧设置；N3b 逐个补死按钮（MCP、特惠广告、真实测试连接、真实更新检查）后才替换入口。
- 理由：原型设置页是设计稿，至少 6 处 mock（测试连接失败仍报成功、更新检查写死 latest），整块替换等于把假按钮交给用户。

## 夜间目标（按顺序，不跳步）

| 阶段 | 内容 | 完成标准 |
|---|---|---|
| N0 | S0.5 收尾：`BottomPromptBar` 根去掉 `pb-1`，让卡片底边与缩放条严格同一底边；重装并截图 | 底边差 ≤2px；链接 |
| N1 = S3 | 原型 `src/**` 整目录复制进 `vendor/prototype/`；生成 `vendor-manifest.json`（sha256）；`scripts/verify-vendor.mjs`；接进 `gate:dev` | vendor 内每个文件哈希与原型一致；脚本 exit 0 |
| N2 = S4 | `src/studio/adapters/{settings,skills,workflow}.ts` 三个适配层；类型与原型 props 对齐；单测 | `npm run build` + `npm test` 通过；adapter 有测试 |
| N3 = S5-1 | 设置页接入：原型 `SettingsModal` + settings adapter；DPAPI/真 `/models`/导入导出/MCP/更新/备份/数据目录/特惠广告位 | 六项验收：哈希、零改动、空控件扫描、build+test+E2E、亲手点、几何比对 |
| N4 = S5-2 | 若时间与预算允许，技能页接入 | 同上 |
| N5 | 写 `STATE.md` 更新 + 明早汇报 | 汇报含：版本、哈希、六数字、点验截图清单 |

**N3 之后不再开新页**；工作流页留给白天，因为要真跑 ComfyUI。

## 每阶段硬规则

1. 一次只动一个阶段，一阶段一 commit，message 前缀 `N1:` `N2:` 等；
2. 复制用 `Copy-Item`，内容不经模型；vendor 内**零改动**；
3. 适配代码只在 `adapters/**`，组件文件哈希必须等于原型；
4. 每个可见控件要么真实行为，要么 `disabled` + 原因；
5. 版本号：每装一次 +0.0.1（1.3.4 → 1.3.5 …），便于区分「装的到底是不是最新」；
6. 只本地提交，不 push、不打 tag。

## 阻塞条件（遇到就停，不硬试）

- `npm run build` 或 `npm test` 连续两次失败；
- vendor 哈希不一致，两次修不好；
- 需要产品决策（例如原型组件缺依赖、必须改 vendor 才能编译）；
- 任何可能丢数据或泄密钥的操作；
- 执行窗口与总控同时改同一批文件。

停下时：写 `docs/execution/NIGHT-STOP.md`（停在哪、为什么、下一步），并发通知。

## 回滚

每阶段一个 commit；`git revert <commit>` 回单批；vendor 目录可整体删除，不影响适配层。

## 明早给用户的三句话

1. 装了什么版本、哪一页已经与原型哈希一致；
2. 哪些按钮我亲手点过、截图在哪；
3. 卡在哪里、需要他定什么（如果有）。


## 1.4.0（2026-11-17 15:25）已交付

- 三页新版全部上线：设置（齿轮）、技能库（左栏）、工作流（左栏）。
- 工作流四条流程：无损放大、抠图已真跑通（各约 10s）；局部重绘、截图转效果图已接线，本机单次约 15 分钟，界面取证待补。
- 批量只保留 ×1，×2 / ×4 置灰。
- 预览痕迹已清除：Ctrl+Alt+W、?workflow=prototype、预览提示条、试用新版设置入口。

### known-limits（未完成，不算通过）

- 局部重绘 / 截图转效果图的界面出图截图待补（引擎侧已 success）。
- 工作流项目与历史记录仍只在内存，刷新即丢。
- 工作流节点图仍是原型演示数据，参数只接入了四条真实流程用到的部分。
- 引擎根目录仍写死 `D:\AI\ComfyUI`（可用 `PANPAN_COMFY_ROOT` 覆盖），改默认路径需要动 src-tauri。
- 设置页数据页的示例快照、自定义字体输入等小项仍待补齐。


## 1.4.1（2026-11-17 15:41）已交付

- 工作流画布新增「本地引擎」三态引导：未检测到（下载 + 重新检测）、已安装未运行（启动引擎 + 启动中文案）、运行中（右下角显示版本与显卡）。
- 复用 `comfyEngine` 的 `probeEngine` / `ensureEngine` / `readEngineProcess`，未改其实现。

### known-limits

- **引擎默认目录写死 `D:\AI\ComfyUI`**，改默认路径需要动 `src-tauri`；当前只能用 `PANPAN_COMFY_ROOT` 覆盖。
- 「未检测到」态未做真实截图（本机已装引擎，隐藏安装目录才能复现）；已用「已安装未运行」与「启动中」两张图代替。
- 启动过程依赖引擎自身日志，界面只显示「正在启动引擎…」，首次启动约 40–60 秒。


## 1.6.0（2026-11-17 19:13）已交付

- 删除无入口引用的旧实现共 8 个文件：
  `InfiniteCanvas`、`RightGeneratorDrawer`、旧 `components/SettingsModal`、旧 `studio/WorkflowView`、
  只被旧 WorkflowView 引用的 `WorkflowCanvas`、`CapabilitySkillLibrary`、`AgentWorkspace`、`HistoryModal`。
- 排版统一为六档令牌（micro/caption/body/title/page），206 处 `text-[数字px]` 全部替换；`leading-[...]` 清零。
- 新增 `scripts/scan-typography.mjs` 并接入 `gate:dev`；当前输出 `text-[数字px]：0`、`leading-[...]：0`。
- 删除验收时创建的 `TestSkill1800`，技能库回到 27 内置 + 0 自定义。

### 六指标（删前 → 删后）

| 指标 | 删前 | 删后 |
|---|---|---|
| 重复实现（同名文件组） | 5 | 4 |
| 最大文件行数 | 7581 | 7581（store.test.ts） |
| >800 行文件数 | 21 | 18 |
| 硬 px 出现次数 | 626 | 343 |
| 死代码文件数（无入边） | 13 | 14 |
| 入口映射缺失 | 0 | 0 |

### known-limits

- 死代码扫描仍有 14 个「无入边」文件，均是删除旧 SettingsModal 后新孤立的设置子页（About/Agent/Appearance/General/自定义服务商/导入面板/Zip 路由等），另有 `vite-env.d.ts`、`gifenc.d.ts` 属于类型声明误报。本轮未删，留给下一批统一处理。
- `TitleBar.tsx` 本身只有 36px 拖拽区与窗口三键、没有文字，字号令牌对它不适用。
- 设置弹层 `h-[660px]` / 标题栏 `h-[36px]` 等版式高度按白名单保留（原因见 `TYPOGRAPHY-20261117.md`）。


## 1.6.1（2026-11-17 19:41）已交付

- 第二轮死代码：删除旧设置页留下的孤儿子组件 9 个（关于/外观/通用设置页、自定义服务商弹层、预置导入面板、导入链接弹层、Zip 路由弹层、AI 设置页、添加配置向导）。
- 基线扫描脚本修正误报：支持 `./X.tsx` 后缀 import 与 `import()` 动态引用，`.d.ts` 不计入死代码。
- 复扫 `BASELINE-20261117-final.md`：死代码 **3**（均为按清单保留、但当前无引用的设置子组件）。

### known-limits

- 以下三个文件目前无入边：`FontSettingField`、`ProxySettingsSection`、`ShortcutRecorder`。按既定清单保留，等最终验收决定接回新设置页或删除。
- `ImageDetailModal`、`UpdateEntry` 通过 `./X.tsx` 导入，曾被误判为死代码，现已由扫描脚本识别。

### 停止位

- 1.6.1 已安装，功能不再推进，等待最终验收（三页入口 + 真跑一次放大 + 发布说明）。


## 1.8.0-LAUNCH S7（2026-11-18）本地收口

- 最终候选：`PanPan Workbench_1.8.0_x64-setup.exe`，15,537,168 B，SHA256 `8E70801C7B768EC8FAD8DBA5F78645C741EC6DF1F0AEF7F0F6430D66161E51AF`；带 `.sig` 与 `latest.json`，签名校验通过
- 安装：clean / 1.6.3→1.8.0 / 1.7.0→1.8.0（真实）全部通过；升级前数据库与图片哈希不变
- U2：本地引擎出图→下载→导出备份→导入恢复→卸载删数据→重装再恢复，全部通过；证据见 `evidence/s7-*.png`
- 已知限制：真实安装导出备份被 2 张缺失工作流结果图阻断；updater 真实更新需发布新版本；私钥离线备份待指定；云端生图按用户要求跳过
- 停止位置：本地 1.8.0，未 push / 未 tag / 未上传 Release；报告 `REPORT-1.8.0-LAUNCH-S7.md`，门禁 `GATES-1.8.0-LAUNCH-S7.json`
