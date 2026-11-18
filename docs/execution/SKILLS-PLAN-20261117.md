# 技能页接入计划（N4）

- 日期：2026-11-17
- 原型：`vendor/prototype/src/components/SkillHubView.tsx`（751 行）
- 结论：**原型是纯受控组件，没有 localStorage、没有 mock**，接入成本远低于设置页。

## 原型的 props

```ts
interface SkillHubViewProps {
  skills: SkillItem[]
  onApplySkill: (skill, customizedPrompt, mode?: 'replace' | 'append') => void
  onToggleFavorite: (skillId) => void
  onCreateSkill: (skill) => void
  onDeleteSkill: (skillId) => void
  activeCategory?: string
  onSelectCategory?: (category) => void
  isSidebarCollapsed?: boolean
  onToggleSidebar?: () => void
}
```

## 两套模型的差异

| 原型 `SkillItem` | 本项目 `PromptSkill` | 本项目能力技能 `Skill` |
|---|---|---|
| id / title / description | id / title / 无 description | id / name / description |
| promptTemplate | prompt | 配方正文 |
| category + categoryLabel | category?: string | `A 空间与场地` 这类带字母的键 |
| variables | variables（`{{key}}` 占位） | 有输入槽 slots |
| negativePrompt | negativePrompt | 有 |
| isFavorite | favorite | — |

## 接入决策（待确认后执行）

1. **数据源**：先用能力技能 27 条（现有数据），把 `Skill` 映射成 `SkillItem`；
2. **分类**：去掉 A–H 字母前缀，只显示中文（空间与场地 / 改造与材质 / 产品与电商 / 平面与传播 / 动态 / UI 与网页 / 角色与配景 / 风格包），**不出现内部代号**（对应 `DECISIONS` C-09）；
3. **动作**：
   - `onApplySkill(..., 'replace')` → 覆盖输入台；
   - `onApplySkill(..., 'append')` → 追加到输入台；
   - 复制 → 写剪贴板（组件内部已实现）；
4. **收藏 / 新增 / 删除**：接本项目现有技能存储（`PromptSkill` 或能力技能对应 action），不允许空实现；
5. **变量**：能力技能的输入槽映射为 `variables`，默认值取槽默认值。

## 交付方式

- `Copy-Item` 复制原型文件到 `src/studio/modules/skills/SkillHubView.tsx`，只改 import；
- 宿主 `SkillHubHost.tsx` 负责 props 映射；
- 入口：先在预览态（与设置页同一快捷键机制），点验通过后再替换左栏「技能库」。

## 风险

- 能力技能与提示词技能是**两套模型**（架构债 F-02）。这一版先映射，不做合并；合并放到 S7。

## 实施结果（N4，1.3.12）

### 文件

| 文件 | 说明 |
|---|---|
| `src/studio/modules/skills/SkillHubView.tsx` | 由 `vendor/prototype/src/components/SkillHubView.tsx` 原样复制（738 行）；改动只有 import 改为 `./types`、类型导入加 `type`，以及为「新建技能」按钮增加可选禁用属性 |
| `src/studio/modules/skills/types.ts` | 仅含 `GenerationParams`、`SkillVariable`、`SkillItem`，`category` 放宽为 `string` |
| `src/studio/components/SkillHubHost.tsx` | 宿主：27 条能力技能 → `SkillItem[]`，分类栏、收藏、复制/追加/替换接线 |
| `src/studio/StudioShell.tsx` | 左栏「技能库」改为渲染 `SkillHubHost`；旧 `CapabilitySkillLibrary` 文件保留，删除放 S7 |

### 最终分类映射（去掉 A–H 前缀）

| 原分类 | 显示名 | 条数 |
|---|---|---|
| A 空间与场地 | 空间与场地 | 5 |
| B 改造与材质 | 改造与材质 | 2 |
| C 产品与电商 | 产品与电商 | 5 |
| D 平面与传播 | 平面与传播 | 6 |
| E 动态 | 动态 | 1 |
| F UI 与网页 | UI 与网页 | 2 |
| G 角色与配景 | 角色与配景 | 2 |
| H 风格包 | 风格包 | 4 |

### 控件行为

- 替换：`setPrompt(配方默认值)` 并切回工作区；
- 追加：`setPrompt(原内容，配方默认值)` 并切回工作区；
- 复制：组件内部写剪贴板，成功显示「已复制」；
- 收藏：`useCapabilitySkillStore.toggleFavorite`（`builtin:<key>`），与旧技能库同一份记录；
- 新建 / 删除：内置技能不支持。新建按钮置灰，旁边注明「内置技能，暂不支持新建」；删除按钮只在自定义技能上出现，内置技能不渲染。

### 已知限制

- `SkillHubView` 的标题区用内置 `CATEGORY_TITLES` 映射分类名，中文分类键不在表里，选中分类时标题仍显示「全部技能」；分类名以左侧栏为准。
- 能力技能的图片输入槽没有映射为变量（原型变量只处理文本），需要图片的技能仍要在输入台补参考图。

### 验收证据（`docs/execution/evidence/`）

- `n4-skillhub.png`：技能页整窗，左栏中文分类，无 A–H 字母。
- `n4-apply-replace.png`：点「替换」后输入台被覆盖并切回工作区。
- `n4-apply-append.png`：输入台原有「测试追加」，点「追加」后变为「测试追加，# 商业空间摄影 · 运行时提示词…」。
- `n4-copy.png`：复制后按钮显示「已复制」。
- 空控件扫描：`node scripts/scan-empty-buttons.mjs src/studio/modules/skills` → `空控件：0`。

## 实际落地记录（2026-11-17）

- 复制件与 vendor 原件差异：**10 行新增 / 2 行删除**，全部用于一处——新增 `createDisabledReason` 属性，把「新建技能」置灰并给出原因（内置技能不支持新建）。这是「空控件零容忍」的必要改动，已登记。
- 分类：去掉 A–H 前缀，显示「空间与场地 / 改造与材质 / 产品与电商 / 平面与传播 / 动态 / UI 与网页 / 角色与配景 / 风格包」。
- 空控件扫描：0。
- 入口：`StudioShell` 左栏「技能库」已指向 `SkillHubHost`。



## 1.5.2：技能 CRUD 接真实存储

### 组件改动（SkillHubView.tsx，已登记）

| 改动 | 原因 |
|---|---|
| 去掉 `createDisabledReason` 与「新建技能」置灰 | 上一版把功能砍成空控件，这一版接真实存储 |
| 新增 props `onUpdateSkill` / `onDuplicateSkill` | 编辑自定义技能、把内置复制为自定义 |
| 创建弹层支持预填（`openCreateModal(skill)` + `editingId`） | 复用同一个弹层做编辑 |
| 卡片新增编辑 / 复制按钮；`isCustom` 改为优先读 `skill.isCustom` | 区分内置与自定义 |

### 映射

- 内置 27 条：`SkillItem.isCustom = false`，无编辑/删除，只能「复制为自定义」。
- 自定义技能：来自 `useSkillStore`，新建走 `saveNewSkill`，编辑走 `updateSkill`，删除走 `removeSkill`。
- 说明文字用 `desc:` 前缀存进 `tags`，因为 `PromptSkill` 没有 description 字段。

### 验证状态（1.5.4 已通过创建与持久化）

- 构建、类型检查、1137 条测试均绿，1.5.2 已安装。
- 但「新建 → 重启仍在 / 编辑 → 重启生效 / 删除 → 重启消失」三项**没有亲手跑完**：本轮自动化在技能弹层里没稳定命中输入框，列表仍是 0 条自定义。
- 在补完这三项硬验收前，本批不按通过计。
