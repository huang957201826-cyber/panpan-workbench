# 基线体检（六指标）

- 扫描时间：2026-11-17 12:00:42
- 范围：`src/**/*.{ts,tsx}`
- 脚本：`node scripts/baseline-scan.mjs`

## 数字

| # | 指标 | 数值 |
|---|---|---|
| 1 | 重复实现（同名文件组） | 4 |
| 2 | 最大文件行数 | 7581 |
| 3 | >800 行文件数 | 18 |
| 4 | 裸 px 出现次数 | 316 |
| 5 | 死代码文件数（无入边） | 3 |
| 6 | 入口映射缺失数 | 0 |

## 明细

### 最大的 10 个文件

| 文件 | 行数 |
|---|---|
| `src/store.test.ts` | 7581 |
| `src/store.ts` | 6368 |
| `src/studio/modules/workflow/ComfyWorkflowView.tsx` | 2553 |
| `src/studio/modules/settings/SettingsModal.tsx` | 2484 |
| `src/components/InputBar.tsx` | 2063 |
| `src/lib/api.test.ts` | 1916 |
| `src/lib/apiProfiles.test.ts` | 1776 |
| `src/lib/apiProfiles.ts` | 1428 |
| `src/components/DetailModal.tsx` | 1350 |
| `src/components/CanvasBoard.tsx` | 1247 |

### 同名（可能是重复实现）文件组

| 文件名 | 路径 |
|---|---|
| interactivedotgrid.tsx | `src/components/InteractiveDotGrid.tsx`<br>`src/studio/modules/workflow/InteractiveDotGrid.tsx` |
| select.tsx | `src/components/Select.tsx`<br>`src/ui/Select.tsx` |
| titlebar.tsx | `src/components/TitleBar.tsx`<br>`src/studio/components/TitleBar.tsx` |
| types.ts | `src/studio/modules/skills/types.ts`<br>`src/studio/modules/workflow/types.ts`<br>`src/studio/types.ts`<br>`src/types.ts` |

### 裸 px 最多的 10 个文件

| 文件 | 次数 |
|---|---|
| `src/studio/modules/workflow/ComfyWorkflowView.tsx` | 114 |
| `src/studio/components/LocalEngineCard.tsx` | 16 |
| `src/studio/components/HomeHubView.tsx` | 15 |
| `src/components/InputBar.tsx` | 14 |
| `src/studio/components/BottomPromptBar.tsx` | 14 |
| `src/studio/components/SkillPickerModal.tsx` | 13 |
| `src/studio/components/WorkflowProjectPicker.tsx` | 13 |
| `src/studio/components/AppSidebar.tsx` | 12 |
| `src/studio/modules/settings/SettingsModal.tsx` | 8 |
| `src/studio/components/TitleBar.tsx` | 7 |

### 死代码文件（无 import 入边）

- `src/components/settings/FontSettingField.tsx`
- `src/components/settings/ProxySettingsSection.tsx`
- `src/components/settings/ShortcutRecorder.tsx`

### 入口映射缺失

- 无
