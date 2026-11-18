# 排版令牌与校准（2026-11-17）

## 六档令牌（`tailwind.config.js`）

| 用途 | 类名 | 字号 | 行高 |
|---|---|---|---|
| 分组小标题 | `text-micro` | 10 | 1.2 |
| 次要说明、状态胶囊、计数、左栏条目、按钮、表单小字 | `text-caption` | 12 | 1.4 |
| 正文、输入框 | `text-body` | 14 | 1.55 |
| 区块标题、弹层标题 | `text-title` | 15 | 1.4 |
| 页面主标题 | `text-page` | 20 | 1.3 |

过渡值 `text-body-sm`（13）保留给次级正文，不再用 `text-[13px]` 这类裸值。

## 原值 → 现值对照（按区间归一）

| 原写法 | 归一后 | 说明 |
|---|---|---|
| `text-[10px]` / `text-[10.5px]` | `text-micro` | 分组标题、计数 |
| `text-[11px]` / `text-[11.5px]` / `text-[12px]` / `text-[12.5px]` | `text-caption` | 条目、按钮、说明 |
| `text-[13px]` / `text-[13.5px]` / `text-[14px]` | `text-body` | 正文、输入 |
| `text-[15px]` / `text-[15px]` 以上到 16.4 | `text-title` | 区块标题 |
| `text-[17px]` 及以上 | `text-page` | 页面标题 |
| `leading-[...]` | 删除 | 行高跟令牌 |

## 扫描

```
node scripts/scan-typography.mjs
```

范围：`TitleBar.tsx`、`WorkflowHub.tsx`、`SkillHubHost.tsx`、`SettingsModal.tsx`、`SkillHubView.tsx`、`InputBar.tsx`、`BottomPromptBar.tsx`。
输出 `text-[数字px]` 与 `leading-[...]` 的剩余数量，非 0 时退出码为 1；已接入 `npm run gate:dev`。

## 保留的裸高度（白名单及原因）

| 位置 | 值 | 原因 |
|---|---|---|
| `TitleBar.tsx` | `h-[36px]` | 应用标题栏固定高度，与窗口 `top-[36px]` 偏移配套 |
| `SettingsModal.tsx` | `h-[660px]` | 设置弹层整体高度，不是控件 |
| `SettingsModal.tsx` | `h-[54px]` / `h-[60px]` | 弹层标题栏与底部操作栏，是版式尺寸 |
| `SkillHubView.tsx` | `min-h-[280px]` / `h-[140px]` | 空状态与变量面板的容器高度 |

控件高度已统一为 `h-7` / `h-8` / `h-9` / `h-10`。
