# 内容层交接单

- 日期：2026-11-16
- 角色：内容层（工作流内容与参考规格）
- 对应契约：`docs/execution/COORDINATION-20261116.md` 第 2.1 节
- 一句话：4 条高频工作流的 manifest 与 API 图已就位，结构对运行中的 ComfyUI 0.44.0 校验通过；**2 条现在就能跑，2 条只等模型文件**。

---

## 1. 交付清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `src/studio/workflows/api/qwen-upscale.ts` | 新增 | 无损放大 API 图 |
| `src/studio/workflows/api/matte-cutout.ts` | 新增 | 抠图 API 图 |
| `src/studio/workflows/api/qwen-retouch.ts` | 新增 | 精修 / 局部重绘 API 图 |
| `src/studio/workflows/api/qwen-su-render.ts` | 新增 | 模型截图转效果图 API 图 |
| `src/studio/workflows/anchors.ts` | 新增 | 锚点表与 `applyParamValues()` |
| `src/studio/workflows/manifest.ts` | 修改 | 新分类、新字段、4 条新清单、老 6 条补 `requiresImage` |
| `src/studio/workflows/apiWorkflows.ts` | 修改 | 注册 5 条 API 图；`IMAGE_REQUIRED` 改为从 manifest 派生 |
| `docs/refs/validate-workflows.mts` | 新增 | 结构校验脚本（不跑生成） |
| `docs/refs/HANDOVER.md` | 新增 | 本文件 |

未触碰任何禁改文件（`WorkflowView.tsx`、`WorkflowCanvas.tsx`、`workspaceStore.ts`、`store.ts`、`db*.ts`、`e2e/**`、版本文件、`src-tauri/**` 全部未动）。

---

## 2. 契约落地情况

| 契约项 | 状态 |
|---|---|
| `WorkflowCategory` 增加 `upscale` / `matte` / `retouch` | ✅ 已加，`WORKFLOW_CATEGORY_LABEL` 同步补了中文名 |
| `WorkflowParam` 增加 `boolean` / `select` / `options` / `group` / `anchor` | ✅ 已按 2.1 节原样加 |
| `WorkflowManifest` 增加 `requiresImage` | ✅ 已加，**老 6 条全部补上**（都是 `true`） |
| `API_WORKFLOW_BY_ID` 可直接消费 | ✅ 已注册 5 条 |

`npx tsc --noEmit` 通过（退出码 0）。

---

## 3. 四条工作流

### 3.1 `qwen-upscale` · 无损放大 · `upscale`

```
LoadImage(__IMAGE__)
  → UpscaleModelLoader(__UPSCALE_MODEL__)
  → ImageUpscaleWithModel
  → ImageScaleBy(__SCALE__)
  → SaveImage(panpan/upscale)
```

| 项 | 值 |
|---|---|
| 节点数 | 5 |
| 预计耗时 | 4 秒 |
| 模型是否齐备 | ❌ 缺 `models/upscale_models/RealESRGAN_x4plus.pth` |
| `verified` | `false` |
| 不经过采样器 | 是，只做插值放大，像素内容不重绘 |

参数：`image`(basic) / `scale`(basic) / `model`(advanced)

> `scale` 默认 1 = 只用放大模型自带倍率（4x），不额外缩放。

### 3.2 `matte-cutout` · 抠图 · `matte`

```
LoadImage(__IMAGE__)
  → LoadBackgroundRemovalModel(__BG_MODEL__)
  → RemoveBackground（出 MASK）
  → JoinImageWithAlpha（原图 + alpha）
  → SaveImage(panpan/matte)
```

| 项 | 值 |
|---|---|
| 节点数 | 5 |
| 预计耗时 | 3 秒 |
| 模型是否齐备 | ❌ 缺 `models/background_removal/birefnet-general.safetensors` |
| `verified` | `false` |

参数：`image`(basic) / `model`(advanced)

> 只分离主体，不做背景替换。换背景放到合成阶段。

### 3.3 `qwen-retouch` · 精修 / 局部重绘 · `retouch`

```
UNETLoader + CLIPLoader + VAELoader（qwen_image_2.1_int8 三件套）
LoadImage(__IMAGE__) → ImageScaleToTotalPixels ┐
LoadImageMask(__MASK__) → GrowMask(expand 8)   ├→ InpaintModelConditioning(noise_mask true)
TextEncodeQwenImage21(__PROMPT__) → positive/negative ┘
  → KSampler(__SEED__, denoise 0.55)
  → VAEDecode → SaveImage(panpan/retouch)
```

| 项 | 值 |
|---|---|
| 节点数 | 12 |
| 预计耗时 | 35 秒 |
| 模型是否齐备 | ✅ 三件套都在盘上 |
| `verified` | `true` |

参数：`prompt` / `image` / `mask` / `denoise`（basic），`steps` / `seed`（advanced）

> 蒙版外不采样（`noise_mask: true`），像素原样保留。`LoadImageMask` 的 `channel` 固定 `red`，蒙版图必须是白底重绘区 / 黑底保留区。

### 3.4 `qwen-su-render` · 模型截图转效果图 · `base`

```
UNETLoader + CLIPLoader + VAELoader
LoadImage(__IMAGE__) → ImageScaleToTotalPixels → VAEEncode ┐
TextEncodeQwenImage21(__PROMPT__) → positive/negative ────┴→ KSampler(__SEED__, denoise 0.7)
  → VAEDecode → SaveImage(panpan/su-render)
```

| 项 | 值 |
|---|---|
| 节点数 | 10 |
| 预计耗时 | 45 秒 |
| 模型是否齐备 | ✅ 三件套都在盘上 |
| `verified` | `true` |

参数：`prompt` / `image` / `denoise`（basic），`steps` / `seed`（advanced）

> 结构靠低重绘幅度压住，不接 ControlNet。`models/controlnet` 目前是空的，装好后另开一条更强的。

---

## 4. 锚点表（外壳层照这张表写值）

| 锚点 | 节点类 | 输入字段 | 值来源 |
|---|---|---|---|
| `__IMAGE__` | `LoadImage` | `image` | 已 `/upload/image` 的文件名 |
| `__MASK__` | `LoadImageMask` | `image` | 已上传的蒙版文件名 |
| `__PROMPT__` | `TextEncodeQwenImage21` | `prompt` | 用户输入 |
| `__SEED__` | `KSampler` | `seed` | 用户输入 / 随机 |
| `__DENOISE__` | `KSampler` | `denoise` | 滑杆 |
| `__STEPS__` | `KSampler` | `steps` | 步数 |
| `__SCALE__` | `ImageScaleBy` | `scale_by` | 倍数 |
| `__UPSCALE_MODEL__` | `UpscaleModelLoader` | `model_name` | 下拉选择 |
| `__BG_MODEL__` | `LoadBackgroundRemovalModel` | `bg_removal_name` | 下拉选择 |

**关键**：定位按 `classType + 输入字段`，**不要按节点标题定位**。原因：`__SEED__`、`__DENOISE__`、`__STEPS__` 落在同一个 `KSampler` 上，一个节点只能有一个标题。节点标题只是给人看的可读标记。

```ts
import { applyParamValues } from '../workflows/anchors'
import { clonePrompt, toSubmitPayload } from '../../lib/comfyPrompt'

const next = applyParamValues(clonePrompt(graph), manifest.params, values)
await enqueuePrompt(toSubmitPayload(next))
```

`applyParamValues` 缺锚点时会抛错并指出是哪个锚点、哪个类名。

---

## 5. 外壳层需要接的 4 件事

1. **分类顺序**：`WorkflowView.tsx` 里的 `CATEGORY_ORDER` 目前是 `['base','control','angle','inpaint','fast']`，**要加 `'upscale'`、`'matte'`、`'retouch'`**，否则新三条不显示（该文件归你，我没动）。
2. **参数绑定**：把固定 4 个 state 换成 `manifest.params` 驱动，用第 4 节的 `applyParamValues`。
3. **蒙版上传**：精修要先 `uploadImage()` 拿到文件名再写进 `__MASK__`；蒙版来源用现有 `MaskEditorModal` 导出的 PNG。
4. **模型缺失提示**：`manifest.models[]` 逐条对 `/object_info` 的枚举做存在性判断，缺的标红并显示子目录（`upscale_models` / `background_removal`），用户才知道往哪放。

---

## 6. 验收步骤

```powershell
cd gpt_image_playground-main

# 1. 类型检查
npx tsc --noEmit

# 2. 结构校验（需要 ComfyUI 在 8188 上，不跑生成、不占显存）
node docs\refs\validate-workflows.mts
```

当前实际输出：

```
[qwen-upscale] 节点 5 · 参数 3
  ! 缺模型 models/upscale_models/RealESRGAN_x4plus.pth
  ✓ 结构通过
[matte-cutout] 节点 5 · 参数 2
  ! 缺模型 models/background_removal/birefnet-general.safetensors
  ✓ 结构通过
[qwen-retouch] 节点 12 · 参数 6
  ✓ 结构通过
[qwen-su-render] 节点 10 · 参数 5
  ✓ 结构通过
总结果：全部结构通过
```

3. 装完模型后各跑一次，看输出目录：`panpan/upscale`、`panpan/matte`、`panpan/retouch`、`panpan/su-render`。
4. 精修用现成的 `su-sketch.png` 加一张手绘蒙版，`denoise 0.55` 跑一遍，确认蒙版外像素没变（对比原图差值为 0）。

---

## 7. 已知限制

- **负向提示词未开放**：`TextEncodeQwenImage21` 一个节点只能挂一个锚点标题，正向 / 负向拆开要再加一个编码节点。
- **抠图模型文件名是推荐值**：`LoadBackgroundRemovalModel` 的枚举在本机为空（没装模型），`birefnet-general.safetensors` 是按目录语义给的推荐名，实装后应以枚举为准回填。
- **放大模型默认值是 `RealESRGAN_x4plus`**：BSD-3，适合随包分发。`4x-UltraSharp`、`4x_foolhardy_Remacri` 是否可商用需人工确认，所以只放进下拉、不做默认。
- **精修走 `InpaintModelConditioning` + `noise_mask`**：若边缘出现生硬接缝，换 `VAEEncodeForInpaint(grow_mask_by=8)` 对比。
- **本轮不含 liblib 界面规格**：壳的布局 / 状态规格需要一次调试端口采集，未做。

---

## 8. 待总控决策

1. **负向提示词**要不要开放？代价是每张图多一次文本编码（约 +1~2 秒）。
2. **模型装哪个版本**？给我一个确认的枚举，我把 `manifest.models` 和 API 图里的默认值一次回填准。
3. **4 条新流的结果要不要自动进画布**？目前只 `SaveImage`，不回流。
4. **老 6 条怎么处置**？用户明确说"都不是很满意"。建议保留 `qwen-edit-base` 与 `qwen-inpaint` 作为兜底，其余 4 条降级到「实验」分组。
5. **抠图要不要做背景替换变体**？现在只有透明 PNG。
