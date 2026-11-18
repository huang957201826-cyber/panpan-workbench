# B02-3 开发报告：托盘、品牌、显示与安全

- 批次：B02-3
- 日期：2026-11-07
- 总方案：`docs/execution/PLAN-B02.md`，SHA256 `D167732252396120F0EA32F60EAEEA67B0024AC8647F99CD40CF800FBF10E679`
- 清单：`docs/execution/B02-CHECKLIST.md`，SHA256 `BD5A67E6C7346918E2E8F0C296352E50597FA9E6F80ACED38746AA0335B35A31`
- 门禁：`docs/execution/GATES-B02-3.json`
- STATUS：代码/构建/测试完成；候选已重建；安装与 U2 未执行（按本批约束）

## HEAD 与候选

- 分支：`b02`
- 代码 HEAD：`f4bebfb`
- 候选安装包：`src-tauri/target/release/bundle/nsis/PanPan Workbench_0.1.1_x64-setup.exe`
- 候选 SHA256：`B0BF2533BCB9828DE1D98AB7D83DAE8544BFB7FD088F871A7BD6216062079D15`
- 候选大小：29,114,663 字节（27.77 MiB）
- 测试：Vitest 77 文件 / 983 用例通过；Rust 96 用例通过；`npm run build`、`check-tauri-acl`、`release-check`、`npm run tauri:build` 通过

## 必做项结果

| 项 | 结果 |
|---|---|
| P1-22 | 关闭窗口无条件 `prevent_close()` 并立即 `hide()`，同时发 `tray-hide-requested` 让前端写盘；Alt+F4 与重复关闭不退出。托盘退出发 `tray-exit-requested`，前端 flush 后退出；Rust 15 秒兜底退出 |
| P1-32 | 启动按主显示器工作区 80% 计算，限制 960×640 至 1440×920，并居中 |
| P1-23 | 新增 `assets/brand/c-fold.svg` master，`tauri icon` 生成全套图标；AppLogo、标题栏、侧栏统一 C 折角 |
| P2-05 | 新增 `pwa-192.png`、`pwa-512.png`、`pwa-maskable-512.png`、`apple-touch-icon.png` |
| P2-06 | 新增 32px 简化 C 图标 `favicon-32.png`；tauri 生成 16/24/32/48/64/128/256 全套 |
| P1-25 | `productName` 保持 `PanPan Workbench`，安装/数据路径不变；窗口标题、界面、快捷方式显示名为“盼盼工作台”；publisher `panpan`；exe/协议未改名 |
| P2-07 | 删除 Header NEW 更新提示、上游 Releases/客户端下载入口与 UpdateModal |
| P2-08 | bundle 增加 `publisher: panpan`、`homepage: ""`，NSIS 不再写 URLInfoAbout/HelpLink |
| P2-20 | `RELEASE.md` 改 v0.1.1；4 个 GitHub workflow 移到 `workflows.disabled`；`VITE_WEB_APP_URL` 清空；CSP 移除 `api.github.com`；移除 `autoCheckUpdate` |
| P2-21 | `tauri` 移除 `devtools` feature；capability 移除 `core:webview:allow-internal-toggle-devtools` |
| P1-43 | 去掉启动/聚焦自动读剪贴板，保留 deep link 显式导入；导入确认展示 host，非 HTTPS 加提示 |
| P2-22 | 设置页 API URL 下新增“测试连接”，GET `/models` 校验模型；非 HTTPS 先二次确认 |
| P2-12 | 删除公告组件、hook、解析库、测试与 `public/announcements.json` |
| P2-18 | 删除 `studio/App.tsx`、`studio/main.tsx`、假 SettingsModal、SkillHubView、ComfyWorkflowView、Taskbar、ComfySidebar、mock 数据 |
| P2-13 | 根 `index.html` viewport 去掉 `maximum-scale`/`user-scalable=no` |
| P1-34 | Studio 字体改用 `var(--font-ui-sans)` / `var(--font-mono)` |

## `[-]` 列表

- P1-24：快捷方式 E 盘与图标缓存刷新需安装环境，本批压缩不做。
- P1-26：旧协议清理可能破坏既有 deep link，本批压缩不做。
- P1-31/P1-36：字号微放大属 UI 批次，本批压缩不做。
- P1-33：≥1600px 大屏断点与侧栏上限，本批压缩不做。
- P1-35：多屏边界恢复校验，本批改为每次居中、不恢复位置，压缩不做。
- P1-37：图标/点击区放大，本批压缩不做。
- P1-38：留白放大，本批压缩不做。
- P2-14：UI 密度设置与触屏目标，本批压缩不做。
- P2-15：9–10px 文本对比度复核，本批压缩不做。
- P2-16：图标按钮 focus-visible，本批压缩不做。
- P2-17：滚动条/边框/禁用态复核，本批压缩不做。
- P2-10：hover-only 操作与窄窗/触屏适配，本批压缩不做。

## known-limits

- 安装目录与数据目录保持旧值 `%LOCALAPPDATA%\PanPan Workbench`，显示名改为“盼盼工作台”；不迁移、不删除旧 `data`。
- 窗口位置和大小不再持久化，每次启动居中；这是 P1-32 的实现取舍，P1-35 多屏恢复未做。
- 关闭窗口由 Rust 立即隐藏，前端收到 `tray-hide-requested` 后继续写盘；5 秒兜底再次隐藏。托盘退出由前端写盘后退出，Rust 15 秒兜底退出。
- 旧 Studio 原型页已删除，若后续需要预览需另建独立入口。
- DevTools 已从发布 feature/权限移除，开发版调试改用独立开发构建。
- 本批未执行安装、快捷方式重建与 U2 点击回归。

## 第一个失败门

- `null`
