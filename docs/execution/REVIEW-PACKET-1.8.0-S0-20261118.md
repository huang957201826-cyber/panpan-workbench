# 独立阶段复审包（第 2 轮）：1.8.0 S0

你是本项目独立只读审查窗口，只审查 S0 阶段，不修改文件，不扩张需求，不进入 S1 实现。

## 输入

- 总方案：`docs/execution/PLAN-1.8.0-LAUNCH-20261117.md`
- 执行清单：`docs/execution/CHECKLIST-1.8.0-LAUNCH-20261117.md`
- S0 报告：`docs/execution/REPORT-1.8.0-LAUNCH-S0.md`
- S0 门禁：`docs/execution/GATES-1.8.0-LAUNCH-S0.json`
- 数据盘点：`docs/execution/evidence/s0-data-inventory-20261118.json`
- 测试副本盘点：`docs/execution/evidence/s0-test-copy-inventory-20261118.json`
- 盘点脚本：`scripts/verify/s0-data-inventory.mjs`
- 设置安全修复：`src/studio/modules/settings/SettingsModal.tsx`

## 版本

- 当前修订方案 SHA256：`FC31A196398C2CF0125986259775B0B4BFFB6146237752B92AEA7E090755BDD8`
- 当前清单 SHA256：`F9E836E68A3003F8EA600BCE1FD573368A7BD2363880A6972AE202D9A6B849A9`
- S0 报告 SHA256：`20247D2C001AABEA8BA1E7646438A40B63284B16D615435AA147A44AE9107DAD`
- S0 门禁 SHA256：`4C84AC5D959E55394F41CF303167A210A32F4DEE28ED7B3905023C9242E2A042`

## 第 1 轮复审阻塞处理

1. **v5 漏 Agent/收藏夹**
   - v5 已补 `agentConversations`、`favoriteCollections`、`defaultFavoriteCollectionId`。
   - Agent 对话沿用分卷计划；收藏夹与默认 ID 只写入基础数据卷。
   - 合并恢复同 ID Agent 对话及其关联任务整体跳过；替换恢复使用备份；收藏夹按保守规则合并。
2. **SafeSettings 未冻结**
   - 顶层字段改为显式白名单，新字段不会自动进入备份。
   - 所有嵌套对象统一递归拒绝 token/secret/password/authorization/Bearer 等敏感键值。
   - `customProviders.query/body` 列入专门验证。
3. **非空验收**
   - S1 新增 Agent/收藏夹往返，真实 UI 创建的工作流，技能同 ID 冲突 remap，完整导出导入重启核对。

## S0 实际改动

1. 清空设置原型中的生产演示 API Key，使 SAST 从失败变为通过。
2. 新增只读 `scripts/verify/s0-data-inventory.mjs`，统计 SQLite、kv、图片引用、技能重复、工作流 localStorage/IDB 存在性和文件体量；不返回提示词、Key 或用户绝对路径。
3. 生成真实数据与受控副本两份盘点 JSON。
4. 建立 1.7.0 受控数据副本及 manifest。
5. 冻结备份 manifest v5、技能 union、SavedWorkflow SQLite 前置迁移、`RestorePlan` 锁和回滚映射。
6. 修正 `scripts/process-check.mjs` 对旧式状态表和 `stage-*` 新阶段名的解析，使完整 `gate:dev` 可识别 1.8.0 总账。

## 基线结果

- `npm run build` exit 0。
- `npm test`：104 文件 / 1140 用例通过。
- vendor：26 文件通过。
- typography：目标裸值 0。
- `npm run sast` 通过。
- 构建有两条既有非阻塞警告：`tauriLog` 动态导入不拆 chunk；主 chunk >500 kB。
- 当前真实数据：19 任务、23 图片、23 缩略图、4 项目、6 画布、3 画布图片节点。
- 图片引用：缺失 0、孤儿 0。
- 技能：能力技能 5、提示词技能 0、同名 `TestSkill1800` 2 条。
- 当前无已保存工作流 ID，也无工作流 IDB；迁移仍需非空 fixture 验证。

## 失败注入

- 不存在的数据目录：盘点脚本 exit 1。
- 恢复有效测试副本：exit 0。
- 证据：`.tmp/s0-inventory-failure.log`。

## 审查重点

1. 数据盘点脚本是否真正只读、无敏感泄漏、结论与证据一致。
2. manifest v5 是否足以覆盖工作区、任务、图片、技能、工作流、结果图，并兼容 v4。
3. 技能 union 与冲突规则是否会在迁移中丢数据或重复。
4. 工作流 metadata 是否已正确前置到 SQLite，S3 是否只保留语义/清理。
5. `RestorePlan` 锁、快照、staging、commit、hydration、cleanup 和 journal recovery 是否完整。
6. S0 是否误进入 S1 或写入真实业务数据。
7. 第 1 轮两个 P0 是否真正闭合，短修订是否引入新的数据或密钥风险。

## 输出格式

```text
CODE_REVIEW=APPROVE|REJECT

阻塞项（最多 3 个）
1. [P0/P1] 问题
   证据：
   必须修改：

允许带入 U2 的条件（最多 3 个）
1. ...

非阻塞问题
1. ...

结论
- 是否允许进入 S1：
```

只按数据丢失、密钥泄漏、构建/安装不可用判断阻塞。不要修改代码，不要预先视为 S1 已通过。
