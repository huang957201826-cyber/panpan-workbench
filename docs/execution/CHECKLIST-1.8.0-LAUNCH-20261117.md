# 清单：1.8.0 结构收敛与正式上线准备

- 批次：`1.8.0-LAUNCH`
- 总方案：`docs/execution/PLAN-1.8.0-LAUNCH-20261117.md`
- 状态：`PROPOSED`，等待用户批准；不提前开发
- 规则：每项结束时只能是 `[x]` 或 `[-]`，不得留 `[ ]`/`[~]`

## S0 · 基线、数据快照与迁移设计

- [x] `S0-01` 记录批次开始提交、工作区状态、安装版版本和回滚点
- [x] `S0-02` 扫描并列出所有业务数据的 key、表、IndexedDB 和文件位置
- [x] `S0-03` 对测试副本生成任务、图片、项目、画布、技能、工作流、IDB 图片基线
- [x] `S0-04` 生成重复 ID、孤儿引用、同名技能、缺失图片报告，不自动删除
- [x] `S0-05` 定义备份 manifest v5 字段、版本兼容和分卷边界
- [x] `S0-06` 定义技能 union、工作流实体、迁移映射和回滚表
- [x] `S0-07` 确认真实数据写入只发生在受控迁移门禁
- [x] `S0-08` `npm run sast` 为绿，演示 Key 和硬编码敏感值清零
- [x] `S0-09` v5 manifest 补回 `agentConversations`、`favoriteCollections`、`defaultFavoriteCollectionId` 和分卷/合并/替换语义
- [x] `S0-10` 冻结 `SafeSettings` 顶层白名单及递归敏感键/敏感值拒绝规则

## S1 · 工作流前置迁移、P0 数据安全与备份恢复

- [x] `S1-00` 先将 1.7.0 工作流 metadata 幂等迁入 SQLite；失败时旧 key 保留
- [x] `S1-01` 保存的工作流配置进入统一业务数据和 ZIP manifest
- [x] `S1-02` 工作流输入图/结果图进入 ZIP 文件区并可恢复
- [x] `S1-03` 技能、覆盖层、工作区、任务、图片、题图全部进入导出
- [x] `S1-04` API Key、MCP token、签名私钥和敏感路径继续脱敏
- [x] `S1-05` 兼容读取 1.7.0 及更早备份；新字段缺失时不破坏旧恢复
- [x] `S1-06` 恢复失败不覆盖现有数据，并给出可定位错误
- [x] `S1-07` 清空任务/配置的范围写清楚；技能和工作流被排除时界面明确说明
- [-] `S1-08` 本批不提供“清空全部用户数据”，只保留已说明范围的清空入口
- [x] `S1-09` 完成导出 → 清空测试副本 → 导入 → 计数/引用/哈希对比
- [x] `S1-10` 加入失败注入：损坏 manifest、缺失工作流图片、部分导入失败
- [x] `S1-11` 冻结 `RestorePlan`：解析、校验、冲突预览、staging、SQLite commit、cleanup、journal recovery
- [x] `S1-12` 合并恢复保留现有数据，同 ID 跳过；替换恢复二次确认后使用备份同 ID
- [x] `S1-13` 恢复期间锁定生成写回、删除、清空、导入和并发恢复
- [x] `S1-14` 图片、任务、工作区、技能、工作流五个阶段分别注入失败，现有数据完全不变
- [x] `S1-15` 恢复中崩溃后重启，staging 可回收且无半恢复
- [x] `S1-16` 恢复锁依次完成 acquire、阻止新操作、bump epoch、取消任务、排空写队列、flush/清 dirty、快照、staging、commit、刷新缓存、unlock
- [x] `S1-17` 快照失败、磁盘满、flush 失败和排空超时都在 staging/commit 前中止，现有数据不变
- [x] `S1-18` commit 后旧 epoch 迟到回调被拒绝，不能覆盖恢复数据
- [x] `S1-19` journal recovery 在 store hydration 前运行，SQLite、kv 和 IDB 引用一致
- [x] `S1-20` 新增 SQLite 批量提交命令同步 Tauri command、ACL、release-check 和启动恢复
- [x] `S1-21` 非空 v4/v5 备份往返验证 Agent 对话、默认收藏夹和关联引用
- [x] `S1-22` 合并恢复同 ID Agent 对话及其关联任务整体跳过；替换恢复按备份恢复
- [x] `S1-23` `SafeSettings` 顶层字段必须显式白名单，新增字段不能自动进入备份
- [x] `S1-24` 递归剥除 `customProviders.query/body` 中 apiKey/token/secret/password/authorization/Bearer
- [-] `S1-25` 使用 UI 创建非空工作流并做安装版缺图/重启验证（按审查允许条件转入 S7/U2）
- [-] `S1-26` capability/prompt 同 ID 冲突及 activeSkill/封面/参考图 remap（S2 完成后按审查条件进入 U2）
- [-] `S1-27` v5 导出到安装版隔离副本并在重启后全量核对（按审查允许条件转入 S7/U2）

## S2 · 技能注册表与迁移

- [x] `S2-01` 建立统一技能注册表和公共元数据
- [x] `S2-02` 使用 `kind` 保留能力技能与提示词技能行为差异
- [x] `S2-03` 建立 normalize、validate、compose 逻辑；提示词技能不强制增加通用 execute
- [x] `S2-04` 统一技能 CRUD 入口，移除页面直接操作两套 store
- [x] `S2-05` 迁移旧能力技能和提示词技能，保留 ID、收藏、封面和参数
- [x] `S2-06` 迁移幂等，重复执行不新增副本，不清空旧数据
- [x] `S2-07` 技能名称允许重复；所有删除/更新只按 ID
- [x] `S2-08` 技能库、工作区选用、备份恢复和 MCP 读取同一份数据
- [x] `S2-09` 新增一个测试技能类型，验证只需新增类型模块
- [-] `S2-10` `TestSkill1800` 等测试遗留只按精确 ID 在 U2 处理

## S3 · 工作流语义收口

- [x] `S3-01` 将“工作流项目”命名统一为“保存的工作流”
- [x] `S3-02` 移除无意义占位 `projectId='workflow'`，需要关联时使用显式 `workspaceProjectId`
- [x] `S3-03` 验证 S1 已完成 SQLite 迁入，S3 不重复迁移业务存储
- [-] `S3-04` 旧 localStorage 继续只读兼容，确认无重复读取；最终清理留到 S7/U2
- [x] `S3-05` 验证 S1 已接入结果图 IDB 的备份、恢复、删除和清空
- [x] `S3-06` 删除、重命名、保存、重启找回和缺失图片降级通过

## S4 · UI 一致与拖动性能

- [x] `S4-01` 以技能库为基准建立共享 Sidebar shell 和规格表
- [x] `S4-02` 工作区项目栏使用共享外壳，保留搜索/项目内容
- [x] `S4-03` 工作流栏使用共享外壳，保留引擎/流程分组
- [x] `S4-04` 技能库栏使用共享外壳，保留分类内容
- [x] `S4-05` 标题、条目、折叠按钮、图标和底部操作几何一致
- [x] `S4-06` 拖动期间 workflow node 禁用 transform 过渡
- [x] `S4-07` 指针位置通过 requestAnimationFrame 合并写入
- [x] `S4-08` 拖动视觉滞后 ≤8px、无 >33ms 长帧，松手落点正确
- [-] `S4-09` 连线跟手方案完成或明确登记第二阶段
- [x] `S4-10` 设置页“保存此配置”和左侧说明保持原样

## S5 · MCP 只读诊断与可观测性

- [x] `S5-01` 新增 `skill.list`，返回统一技能元数据
- [x] `S5-02` 新增 `workflow.list` 和 `workflow.get`
- [x] `S5-03` 新增脱敏 `diagnostics.get`
- [x] `S5-04` 新增 `backup.verify`，报告数据类别是否齐全
- [x] `S5-05` MCP 工具只调用统一领域服务，不直接读 store/localStorage
- [x] `S5-06` 保持 Host/Origin/token/限流/写入确认边界
- [x] `S5-07` 不新增全量 MCP CRUD 接口
- [x] `S5-08` 冻结五个工具的请求/响应 schema、分页上限 200 和稳定错误码
- [x] `S5-09` `diagnostics.get` 仅返回版本、布尔状态、计数和脱敏错误摘要
- [x] `S5-10` 清除 Windows 路径、UNC、file URL、Bearer、API Key、MCP token 和查询敏感值
- [x] `S5-11` `backup.verify` 只返回类别、计数和错误代码，不返回路径
- [x] `S5-12` HTTP 安全头不回退；stdio 写工具仍拒绝

## S6 · 测试、文档与发布工程

- [x] `S6-01` 更新当前界面下 12 条 E2E skip
- [x] `S6-02` 全量 E2E 全绿，CI E2E 改为阻塞
- [x] `S6-03` 删除 tag 自动 Release 工作流，不依赖私钥 Secret、不自动上传桌面 Release
- [x] `S6-04` 三处左栏几何、技能、工作流、备份和拖动 E2E 通过
- [x] `S6-05` 960×640、1024×768、125%/150% DPI 截图通过
- [x] `S6-06` 破坏性动作在隔离数据上用 headless/受控方式验证
- [x] `S6-07` 更新 README：版本、安装、数据目录、备份、MCP、隐私、known-limits
- [x] `S6-08` 更新 RELEASE.md 和统一版本号到 1.8.0
- [x] `S6-09` 生成并确认 1.8.0 安装包、`.sig` 和 `latest.json`
- [x] `S6-10` 完成 clean install、1.6.3→1.8.0、1.7.0→1.8.0 升级
- [x] `S6-11` 完成卸载保留数据、卸载删除数据、重装恢复和残留检查
- [-] `S6-12`（known-limit：需发布新版本才能做真实更新/回滚） 完成测试 updater 源上的一次更新安装和回滚
- [x] `S6-13` 用户决定：不使用 Authenticode；README 和下载页披露 SmartScreen
- [-] `S6-14`（known-limit：待用户指定私钥离线保管位置） 私钥离线备份、密码保管和丢失处置已记录
- [x] `S6-15` 失败态矩阵通过：Key、断网、引擎、磁盘、DB、代理、更新
- [x] `S6-16` 提交/Release 资产扫描确认无私钥、密码或真实签名环境值
- [x] `S6-17` 仓库和 CI 只含空签名模板；Release 白名单仅允许安装包、`.sig`、`latest.json`、SHA256 和说明
- [x] `S6-18` 人工上传前校验 `.sig` 对应最终安装包、SHA256、`latest.json` 版本和下载 URL 一致

## S7 · 最终候选与 U2

- [x] `S7-01` 代码复审 `CODE_REVIEW=APPROVE`
- [x] `S7-02` 只构建一次最终 1.8.0 候选
- [x] `S7-03` 记录安装包 SHA256、`.sig`、`latest.json` 和测试版本
- [x] `S7-04` 本批末尾只安装一次最终候选
- [x] `S7-05` 测试副本完成真实引擎旅程和备份恢复 U2
- [x] `S7-06` 受控真实数据迁移通过，pre/post 计数与哈希记录
- [x] `S7-07` 保留 1.7.0 安装包、数据备份和代码回滚点
- [x] `S7-08` 更新 CHECKPOINT、RELEASE-READINESS、GATES 和最终报告
- [x] `S7-09` 停在本地，等待用户明确发布授权

### S7 证据与 known-limits（2026-11-18）

- 签名候选 SHA256 `8E70801C7B768EC8FAD8DBA5F78645C741EC6DF1F0AEF7F0F6430D66161E51AF`，`.sig` 448 B，`latest.json` version 1.8.0；详见 `REPORT-1.8.0-LAUNCH-S7.md`
- 真实安装 1.7.0 → 1.8.0：exe/注册表版本 1.8.0，数据 SHA256 不变，images=23
- U2：本地引擎真实出图、下载、备份导出/恢复、卸载删数据后重装恢复全部通过
- KL-S7-01：真实安装导出备份被 2 张缺失工作流结果图阻断（证据 `evidence/s7-export-known-limit.png`）
- KL-S7-02：updater 真实更新/回滚需先发布新版本，发布锁未授权
- KL-S7-03：私钥离线备份位置待用户指定
- KL-S7-04：云端生图与两条 qwen UI 取证按用户要求跳过
