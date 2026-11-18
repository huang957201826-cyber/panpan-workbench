# 双窗口协作规则（总控定稿）

- 日期：2026-11-16
- 角色：本窗口 = 总控 + 外壳层实现；另一窗口 = 内容层与规格取证
- 原则：**分层不抢文件、契约先行、串行交接、不破坏已验收部分**

---

## 1. 文件所有权（硬边界）

| 层 | 所有权 | 允许写 |
|---|---|---|
| 内容层（另一窗口） | 工作流内容与参考规格 | `src/studio/workflows/**`、`docs/refs/**` |
| 外壳层（本窗口） | 界面骨架、项目逻辑、设置、画布控件 | `src/studio/components/WorkflowView.tsx`、`WorkflowCanvas.tsx`、`src/lib/workspaceStore.ts`、`src/studio/components/AppSidebar.tsx`、`src/components/SettingsModal.tsx`、`src/studio/components/InfiniteCanvas.tsx`、`src/types.ts` |
| 引擎层（本窗口） | Tauri 子进程、客户端 | `src-tauri/**`、`src/lib/comfy*.ts` |

### 双方都不得修改（保护已验收内容）

- `src/store.ts`（6000+ 行核心状态）
- `src/lib/db.ts`、`dbTauri.ts`、`persistedState.ts`（数据迁移）
- `e2e/**`（除非本窗口明确要求同步断言）
- 版本文件：`package.json` / `package-lock.json` / `public/sw.js` / `src-tauri/Cargo.toml` / `Cargo.lock` / `RELEASE.md`
- `src-tauri/tauri.conf.json`

### 提交纪律

- 各自 `git add <自己的路径>`，**禁止 `git add -A` / `git add .`**（会把对方未完成的东西一起提交）
- 只本地提交，**不 push、不打 tag、不发布**
- 不运行 `npm run tauri:build` 或安装（构建与安装只有总控做）

---

## 2. 契约（先定，双方照写）

### 2.1 工作流清单（内容层填充，外壳层消费）

```ts
export type WorkflowCategory =
  | 'base' | 'control' | 'angle' | 'inpaint' | 'fast'
  | 'upscale' | 'matte' | 'retouch'

export interface WorkflowParam {
  key: string
  label: string
  type: 'text' | 'image' | 'number' | 'range' | 'boolean' | 'select'
  defaultValue: string | number | boolean
  min?: number
  max?: number
  step?: number
  options?: string[]
  hint?: string
  /** basic 直接露出，advanced 折叠 */
  group?: 'basic' | 'advanced'
  /** 由锚点驱动的参数填这里的节点标题 */
  anchor?: string
}

export interface WorkflowManifest {
  id: string
  name: string
  category: WorkflowCategory
  description: string
  /** API 格式图；未接通时为空字符串 */
  file: string
  models: string[]
  params: WorkflowParam[]
  estimateSeconds: number
  license: string
  /** 模型路径是否实机验证过 */
  verified: boolean
  /** 需要参考图才能运行 */
  requiresImage: boolean
}
```

### 2.2 项目工作流（本窗口实现）

```ts
export interface ProjectWorkflow {
  id: string
  projectId: string
  name: string
  presetId: string
  canvasId?: string
  params: Record<string, unknown>
  referenceImageIds: string[]
  results: Array<{ imageId: string; taskId?: string; createdAt: number }>
  lastRunAt?: number
  createdAt: number
  updatedAt: number
}
```

---

## 3. 交接方式

- 内容层交付后，在本窗口读 `docs/refs/HANDOVER.md`，按清单逐条对位实现。
- 本窗口负责把工作流挂到项目树上、接生成链路、落库、构建、安装。
- 任何一方需要对方文件时，**只读不改**，改动请求写进交接文档。

---

## 4. 阶段安排

| 阶段 | 内容层 | 外壳层（本窗口） |
|---|---|---|
| P1（并行） | 4 条高频工作流 manifest + 规格 | 缩放控件对齐、设置三步向导、广告隔离、`ProjectWorkflow` 类型 |
| P2（串行） | 交付交接文档 | 项目树 + 工作流保存 + 运行落库与历史 |
| P3 | 待命 | 构建、门禁、安装、验收 |

---

## 5. 验收口径（外壳层）

1. 工作流按项目分组，切项目即换整套；
2. 每次运行可在历史里查到参数与结果；
3. 控件与输入台底边对齐，空间不足时被输入台覆盖；
4. 设置里添加配置为三步向导，推荐服务商不与个人配置混排；
5. `npm run gate:dev` 与 `npm run e2e` 全过；
6. 1.2.1 已有功能无回归。
