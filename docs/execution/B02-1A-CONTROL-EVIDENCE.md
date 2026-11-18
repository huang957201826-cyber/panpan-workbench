# B02-1A 总控执行证据

- 日期：2026-11-06
- 方案：`PLAN-B02-1A.md`，冻结 SHA256 `BB92F4C179448687EA12B91B42A45F8BC69956D0FC16DC739B4CB49E634876B9`
- 说明：本文件只记录总控执行的安装/U2 证据；代码与开发门禁见 `REPORT-B02-1A.md` / `GATES-B02-1A.json`。

## 1. 真实数据双备份（已完成）

- 源：`C:\Users\95720\AppData\Local\PanPan Workbench\data`
- 主备份：`C:\Users\95720\Documents\PanPanBackups\b02-1-real-data-20261106`
- 第二份：`E:\02-RUANJIAN\67-生图工作台-backups\b02-1-real-data-20261106`
- 文件数：387
- 总字节：151,784,507
- 逐文件清单（相对路径 + 字节数 + SHA256）哈希：
  `68FC7141D847C5FFFF4BFF9623D915980A002DBEEBBC072503C6CA8A56AFB0D7`
- 源/主备份/第二份清单哈希一致：是

## 2. 真实数据只读基线（从备份副本查询）

- 任务数：14
- 项目数：1（`default-project`）
- 画布数：2（active `default-canvas`）
- `retryMode`：`new`
- API profile 数：6（B02-1B 会精简为默认 + 特惠）
- 查询方式：Node 24 `node:sqlite`，只打开备份副本，不打开真实 WAL 库

## 3. 旧安装证据

- 旧安装包：`C:\Users\95720\生图软件二开\release\PanPan Workbench_0.1.1_x64-setup.exe`
- 旧包大小：29,024,769
- 旧包 SHA256：`FFD58571167BF983A91CC781F6FC88D19489482C82C9E2C9D4109568F47D5858`
- 当前运行 exe：`E:\02-RUANJIAN\67-生图工作台\PanPan Workbench\gpt-image-playground.exe`
- 当前安装版本：0.1.1
- E 盘 data：342 files / 89,794,167 bytes（卸载前需再生成逐文件清单）
- 注册表恢复源：`HKCU\Software\panpan\PanPan Workbench` 默认值 = E 盘安装目录
- 旧协议：`HKCU\Software\Classes\gpt-image-playground`
- 新协议：`HKCU\Software\Classes\panpan-workbench`
- 桌面/开始菜单快捷方式：均指向 E 盘 exe，IconLocation=,0

## 4. 执行结果

- E 盘 0.1.1 已关闭、静默卸载；E data 卸载前后清单 hash 一致：`50697428EE82BB986BE3354B3A3A4CA2B63A9179B43808DF8D4C72667A83791A`
- `HKCU\Software\panpan\PanPan Workbench`、旧协议 `gpt-image-playground` 已清理
- B02-1A 候选已安装到 `C:\Users\95720\AppData\Local\PanPan Workbench`
- 桌面/开始菜单快捷方式均指向 C 盘安装 exe
- 真实库受控首次启动：任务 14 / 项目 1 / 画布 2；pre hash `68FC7141...`，post hash `DE84F96A...`，差异仅 WAL/WebView 缓存
- U2 结果见 `U2-B02-1A.md`：
  - 写库失败注入：不写 done，图片已落库
  - 31 分钟任务 0 请求；29 分钟任务 56 次后 abort；重启 0 请求
  - 导出/导入：20 任务 / 19 图片保持；测试库含 3 条准备阶段误提交旧任务
- 已知限制：UI 重试同 taskId 未实机点击；未做覆盖安装/卸载重装/干净 VM
