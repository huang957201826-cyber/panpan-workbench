# P6 打包 / 安装 / 卸载 · 阶段报告

- 阶段：P6（发布构建、NSIS 安装包、安装/覆盖/卸载、发布前长稳）
- 分支：studio
- 日期：2026-11-05
- 依据：`盼盼工作台执行方案.md` v1.4、`docs/stage-p5-report.md`

---

## 1. 本阶段交付

### 1.1 发布构建

- 执行 `npm run tauri:build`：
  - release 编译耗时约 **2 分 04 秒**；
  - 生成 NSIS 安装包：`src-tauri/target/release/bundle/nsis/PanPan Workbench_0.1.0_x64-setup.exe`；
  - 大小 **27.67 MiB**（29,009,761 字节）；
  - SHA-256：`FE9708B054743E092E4A5C4EF7EC53F45954041E837D4F497CE7525D8497EC90`；
  - 已复制到 `C:\Users\95720\生图软件二开\release\PanPan Workbench_0.1.0_x64-setup.exe`；
  - 版本 **0.1.0**，安装范围 currentUser，简体中文。
- `tauri.conf.json` 的 `createUpdaterArtifacts` 仍为 false，本安装包未签名；应用内更新产物（`.sig` / `latest.json`）不在本阶段生成。
- 产品名保持 `PanPan Workbench`，窗口标题仍为「盼盼工作台」。

### 1.2 安装验证

- 静默安装：`PanPan Workbench_0.1.0_x64-setup.exe /S`。
- 安装目录：`C:\Users\95720\AppData\Local\PanPan Workbench`。
- 注册表卸载项：`HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\...`，DisplayName `PanPan Workbench`，DisplayVersion `0.1.0`。
- 启动已安装版本：
  - Studio 壳子正常加载；
  - 启动公告弹窗正常，可关闭；
  - 设置页固定 6 Tab：通用/外观/技能/API/数据/关于；
  - UIA 全树无 Agent 文本/按钮。

### 1.3 覆盖安装

- 再次执行同一安装包 `/S`，覆盖安装成功；
- 安装目录 exe 被替换（版本 0.1.0，修改时间更新）；
- 启动已安装版本，Studio 正常加载，UIA 无 Agent。

### 1.4 卸载

- 执行 `C:\Users\95720\AppData\Local\PanPan Workbench\uninstall.exe /S`。
- 结果：
  - 安装目录中的 `gpt-image-playground.exe` 已删除；
  - 卸载注册表项已删除；
  - 安装目录仍保留 `data` 子目录（用户数据目录），卸载不删除用户数据；
  - 无残留应用进程。

### 1.5 Agent 文案清理

- `HelpModal` 删除 Agent 专用帮助分支和 `appMode` prop。
- 通用设置通知说明去掉“Agent 模式回复结束”，只保留图像生成结束。
- 推理强度说明去掉“Agent 模式下完成复杂任务”的表述。
- 旧布局 `CanvasWorkbench`、Header、HistoryModal 的 Agent 入口已在 P5 清理；本阶段只处理文案残留。

### 1.6 发布前长稳

- 使用 **release 二进制** + `target/release/data` 的 3000 条合成任务；
- 画布 3% 低倍、右侧历史流展开；
- 每 10 秒采样主进程 + 本应用 WebView2 子进程的系统总内存，持续 **10 分钟**；
- 结果：见 §2.3（采样日志 `C:\Users\95720\AppData\Local\Temp\opencode\p6-long-run.log`）。

---

## 2. 验证

### 2.1 编译与测试

| 项 | 方式 | 结果 |
|---|---|---|
| 编译 | `npx tsc -b` | 通过 |
| 前端构建 | `npm run build` | 通过 |
| 单测 | `npm test` | 71 files / 944 tests passed |
| 发布构建 | `npm run tauri:build` | 通过，NSIS 安装包 27.67 MiB |

### 2.2 安装生命周期

| 步骤 | 结果 |
|---|---|
| 静默安装 | 成功，安装目录 + 注册表卸载项正确 |
| 首次启动 | Studio 加载，公告可关闭，设置 6 Tab，无 Agent |
| 覆盖安装 | 成功，exe 替换后可正常启动 |
| 静默卸载 | exe/注册表项删除，`data` 用户数据保留 |

### 2.3 10 分钟长稳

- 采样时长：600 秒，共 59 个样本；
- 系统总内存：起始峰值 **710.8MB**（首样例，启动图片解码），随后稳定在 **628–630.3MB**；
- 10 分钟平均 **630.9MB**，结束 **630.1MB**；
- 主进程：**69.2–69.6MB**；
- WebView2：启动峰值 641.2MB，稳定约 558.9–560.8MB，6 个进程；
- 全程 `alive=1`，无 OOM、无进程退出；
- 采样日志：`C:\Users\95720\AppData\Local\Temp\opencode\p6-long-run.log`。

---

## 3. 本阶段没做

- 代码签名 / 应用内更新 `.sig` 与 `latest.json`：未配置签名密钥，本阶段只产出未签名 NSIS 安装包。
- GitHub Release 发布：未推送 tag、未创建 Release。
- 版本号升级：仍为 `0.1.0`，未改 `package.json` / `Cargo.toml` / `RELEASE.md`。
- 安装包在干净虚拟机上的兼容性测试：当前在本机验证。

---

## 4. 已知边界

1. 安装包未签名，Windows SmartScreen 可能提示未知发布者。
2. 卸载保留 `data` 用户数据目录，重装后可继续使用；如需彻底删除需手动清理。
3. 长稳使用 release 二进制 + 测试数据目录，不是已安装版本的真实用户数据。
4. 总内存含 WebView2 子进程；3000 任务 + 右侧历史流展开时约 0.7GB。

---

## 5. Gate 6 自检

- [x] `tauri:build` 生成 NSIS 安装包。
- [x] 静默安装、首次启动、设置 6 Tab、无 Agent。
- [x] 覆盖安装后可启动。
- [x] 静默卸载，exe/注册表清理，数据保留。
- [x] Agent 文案残留清理。
- [x] 944 tests / tsc / build 通过。
- [x] release 二进制 + 3000 任务 10 分钟长稳：总内存 628–630.3MB（首样本 710.8MB），无增长/OOM。
- [ ] 独立审查通过（待 Gate 6）。
