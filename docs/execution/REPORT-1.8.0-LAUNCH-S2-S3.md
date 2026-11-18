# REPORT — 1.8.0 S2+S3 合并批次

- 状态：`APPROVED`，独立定向 `CODE_REVIEW=APPROVE`
- 基线提交：`93f0353`（S1）
- 范围：技能统一注册表 + 工作流语义收口

## 交付

- 新增 `src/lib/skillRegistry.ts`，统一 prompt/capability 的注册表身份、公共元数据、查询、CRUD、收藏、封面和参考图操作。
- `kind` 明确区分 `prompt` 与 `capability`；两种技能不强行共享执行器。
- 注册表 ID 固定为 `prompt:<sourceId>`、`capability:<sourceId>`，内置技能保留 `builtin:*`。
- 旧 `prompt:` 能力镜像只在注册表视图中过滤，不删除任一旧 store，避免破坏性迁移。
- `prompt:` 作为保留镜像空间，在 catalog、导出快照、备份恢复和删除路径统一过滤；删除提示词时精确删除同名镜像，避免刷新后复活。
- 同名技能按 ID 共存；旧提示词迁移不再复制出第二份能力技能。
- 技能种类通过可注册模块扩展，新增测试种类无需改注册表主体。
- 技能库、首页、输入台、选择器、备份恢复和主 store 恢复统一走注册表服务。
- 工作流用户界面统一使用“保存的工作流”；内部旧字段只做兼容读取，不再写入 `projectId='workflow'`。
- 工作流重命名、删除、重启找回和缺图记录保留已有测试覆盖。

## 门禁

- `npm run gate:dev`：通过
- 前端：110 文件 / 1165 用例通过
- Rust：110 用例通过
- build、SAST、release-check、vendor、typography：通过

## 带入 U2

- `TestSkill1800` 仅按精确 ID 在 S7/U2 处理。
- 旧工作流 localStorage 在 S7/U2 验证无重复后清理。
- 真实备份中的 capability/prompt 同源 ID、activeSkill、封面和参考图在 S7/U2 复验。

## 结论

- 独立复审已通过；允许进入 `S4+S5`。

## 第一轮审查阻塞项

- 已修复“删除提示词后旧镜像复活”：过滤不再依赖源提示词是否存在；删除提示词同步删除精确镜像；回归覆盖删除、刷新、导出快照和恢复后仍不存在。
