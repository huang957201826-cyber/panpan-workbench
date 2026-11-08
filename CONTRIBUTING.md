# 贡献指南

欢迎 Issue 与 Pull Request。本项目目前主要面向 Windows 10/11 x64 的 Tauri 桌面端。

## 开始前

- 环境：Node.js 20+、Rust stable、Windows 10/11、WebView2。
- 安装：`npm install`（仓库 `.npmrc` 固定 `legacy-peer-deps=true`，请勿删除）。
- 提交前至少跑通：

```powershell
npm run build
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

- 前端改动涉及 UI 时，请同时检查深浅主题、960px 窄窗与键盘操作（菜单 ↑↓/Home/End/Esc、弹窗焦点陷阱）。

## 约定

- 不要提交真实 API Key、token、`.env`、签名私钥、本机绝对路径、真实用户截图或任务数据。
- 不要修改 `src/assets/third-party-notices.txt`：它由 `npm run notices` 生成；依赖变化后重新生成并提交结果。
- 字体资产改动需同步 `scripts/build-noto-subset.py`、`fonts/*.css`、`src/lib/fonts.ts` 与 `third-party-licenses/` 中的许可原文。
- 版本号需与 `package.json`、`src-tauri/Cargo.toml`、`RELEASE.md` 保持一致；更新地址同时存在于 `src/lib/appUpdate.ts` 与 `src-tauri/tauri.conf.json`。
- 提交信息用简短中文或英文，说明「改了什么、为什么」。

## 报告安全问题

不要公开提交 Issue，请走 [SECURITY.md](SECURITY.md) 中的私有报告入口。

## 许可

本项目以 MIT 许可发布；贡献即视为同意以同一许可分发。第三方组件许可见 `src/assets/third-party-notices.txt`。
