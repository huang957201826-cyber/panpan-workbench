# REPORT — 1.8.0 S6 发布工程

- 状态：`APPROVED`，允许进入唯一一次 S7 构建/U2
- 基线提交：`67768b5`（S4+S5）
- 版本：`1.8.0`

## 交付

- 12 条旧 E2E skip 全部移除并更新到当前界面。
- 全量 Playwright：82 条通过；新增 960×640 在 125%/150% 缩放专项 1 条通过。
- 控件巡检：PASS 64、FAIL 0、跳过 69（写操作/破坏性动作已由隔离 E2E 覆盖）、console error 0。
- CI E2E 去掉 advisory，失败会阻塞。
- tag 自动 Release 工作流已删除；仓库不再包含签名 Secret 消费、自动桌面上传或 Release 写权限流程。
- README、RELEASE.md、package、lock、Cargo、service worker 版本统一到 `1.8.0`。
- 发布资产扫描仅发现签名环境变量模板，未发现私钥、真实密码或真实签名值。
- Key、引擎、非法 ZIP、磁盘、DB、代理、更新的现有失败态测试全部纳入门禁。

## 门禁

- `npm run gate:dev`：通过
- 前端：110 文件 / 1165 用例通过
- Rust：114 用例通过
- Playwright：82 全量 + 960/DPI 专项 1
- build、SAST、release-check、vendor、typography：通过

## 进入 S7 后执行

- 只构建一次 1.8.0 候选并记录 SHA256、`.sig`、`latest.json`。
- 只安装一次最终候选；完成 1.6.3→1.8.0、1.7.0→1.8.0 与数据副本 U2。
- 完成卸载保留/删除数据、重装恢复和更新回滚。
- 若本机没有与现有 updater 公钥匹配的私钥，最终 `.sig`/更新测试无法完成，此时停止并请求用户提供本地密钥路径。

## 结论

当前不构建安装包。独立复审批准后进入 S7；未获发布授权前只停在本地。

## S6-r2 阻塞项闭环

- README 默认数据目录已改为安装目录下的 `data/`。
- README 已明确 API Key 不进入备份，换用户/机器后只能重新填写。
