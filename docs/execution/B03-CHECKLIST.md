# B03 执行清单（唯一勾选版）

- 日期：2026-11-10
- 总方案：`PLAN-B03.md`
- 状态口径：`[ ]` 未做 / `[~]` 进行中 / `[x]` 已验证 / `[-]` 本批不做
- 规则：本阶段归属项必须全部 `[x]` 或 `[-]`，否则不得进入安装/U2。

## S1 制度执法

- [x] S1-1 `scripts/workflow-state.mjs`：读写 CHECKPOINT 的 `WORKFLOW_STATE` JSON 块（get/set）。
- [x] S1-2 `scripts/review-packet.mjs`：生成 PLAN/CHECKLIST/diff/gate/证据的审查包。
- [x] S1-3 `.githooks/pre-push` + `scripts/install-hooks.mjs`：push 前跑 `gate:dev`。
- [x] S1-4 `CHECKPOINT.md` 加入 `WORKFLOW_STATE` 块并切到 B03。
- [x] S1-5 S1 验收：状态脚本、审查包、pre-push、`gate:dev` 全通过。

## S2 应用修复

- [x] S2-1 `apiErrorClassification`：超时/无 Key/余额不足/限流/鉴权/网络/服务端/未知。
- [x] S2-2 失败节点/详情显示分类标题与恢复建议。
- [x] S2-3 错误分类单测（含未知兜底）。
- [x] S2-4 侧栏「工作流」替换为「Lovart 技能」；移除规划占位页；`ActiveActivity` 加 `lovart`。
- [x] S2-5 S2 验收：`npm test` 通过；E2E 断言侧栏文案。

## S3 Lovart 技能包

- [x] S3-1 `scripts/sync-lovart-kit.mjs` 只读复制源包到 `public/lovart-skill-kit/`；`predev`/`prebuild` 接入；gitignore。
- [x] S3-2 `src/lib/lovartSkills.ts`：MANIFEST + 27 条 skill.json/prompt.md 加载、类型、错误处理。
- [x] S3-3 `composeLovartPrompt`、`validateLovartInputs`、`parseOutputSpec` 单测。
- [x] S3-4 `LovartSkillLibraryView`：列表/分类/搜索/优先级筛选。
- [x] S3-5 表单：image/enum/text/number/multi/bool + 必填校验 + 交付规格确认。
- [x] S3-6 一键填入输入台：提示词、参数、参考图；不自动提交。
- [x] S3-7 E2E：选 `space.commercial-photo` → 填必填 → 确认规格 → 填入输入台 → 断言。
- [x] S3-8 S3 验收：`gate:dev` + `e2e` 通过；27 条全部可见。

## S4 验收

- [x] S4-1 版本号升 1.0.1（package/lock/Cargo/lock/sw/RELEASE），后续门禁在 1.0.1 下跑。
- [x] S4-2 固定并校验 1.0.0 回滚包（10,448,444 B / SHA `49DD…` / `.sig`），写入 `GATES-B03.json`。
- [x] S4-3 画布 E2E：视图切换、缩放锚点、空格/中键平移、适应全部。
- [x] S4-4 有任务时节点拖动不跳动（mock API 出图）。
- [x] S4-5 `npm run gate:dev` 通过。
- [x] S4-6 `npm run e2e` 通过。
- [x] S4-7 `cargo test --manifest-path src-tauri/Cargo.toml` 通过。
- [x] S4-8 签名环境：key + password（去 BOM/CRLF，只进环境变量），只构建一次。
- [x] S4-9 记录安装包 SHA256 + `.sig`；检查版本 1.0.1；S4 不安装、不启动真实安装版。

## S5 发布安装

- [x] S5-1 复核 1.0.1 已同步（S4-1 完成），不再改版本。
- [x] S5-2 关闭应用并确认进程退出；备份真实数据 + 整个应用目录（exe/uninstaller/bin/skills）。
- [x] S5-3 对备份副本做 `PRAGMA quick_check`，核对 tasks/images 数量；失败即停。
- [x] S5-4 静默覆盖安装 `/S`，注册表版本 1.0.1。
- [x] S5-5 启动安装版：数据 pre/post 一致；Lovart 页 27 条可加载且 `space.commercial-photo` 可打开；截图存证。
- [x] S5-6 更新 `CHECKPOINT.md` / `GATES-B03.json` / 最终报告。

## 本批不做

- [-] N-04 全局 workflow-gate 插件（无人值守改全局插件风险高，下一批）。
- [-] N-22 干净虚拟机（无独立环境）。
- [-] N-23 真实 API 出图（不消耗真实额度）。
- [-] N-24 公开发布仓/Release（只做本机安装）。
- [-] N-25 Authenticode、N-26 8K、N-27 多语言、N-28 完整撤销重做、N-29 store 拆分。
- [-] N-08–N-19、N-31、N-32（产品 P1/P2 缺口，下一批）。
