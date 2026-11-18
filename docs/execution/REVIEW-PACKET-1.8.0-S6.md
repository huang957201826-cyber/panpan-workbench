# 独立阶段复审：1.8.0 S6

只读审查，不修改文件，不执行构建、安装或发布。

## 输入

- 总方案：`docs/execution/PLAN-1.8.0-LAUNCH-20261117.md`
- 清单：`docs/execution/CHECKLIST-1.8.0-LAUNCH-20261117.md`
- 报告：`docs/execution/REPORT-1.8.0-LAUNCH-S6.md`
- 门禁：`docs/execution/GATES-1.8.0-LAUNCH-S6.json`
- 基线：S4+S5 提交 `67768b5`

## 重点

- `.github/workflows/build.yml`：E2E 已阻塞。
- `.github/workflows/tauri-release.yml`：已删除，不再有 tag 自动上传/Secret。
- `README.md`、`RELEASE.md`、`package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`Cargo.lock`、`public/sw.js`。
- `e2e/**`：skip 清零，控件巡检有界执行，新增 960/DPI 专项。
- `docs/execution/CONTROL-SWEEP-RESULT.md` 和 `docs/execution/evidence/s6-960-scale-125.png`、`150.png`。

## 只审三类阻塞

1. 版本、CI、文档或发布流程是否仍可能把私钥/密码上传，或产生自动 Release。
2. E2E/控件巡检是否仍有被隐藏的 skip、advisory 或假绿。
3. 当前源码是否允许进入唯一一次 1.8.0 构建与安装 U2。

最终安装包、`.sig`、`latest.json`、三路径安装和卸载 U2 在批准后执行，本轮不得因尚未生成安装包判阻塞。

最多列 3 个阻塞项；其他写 `known-limits`。
