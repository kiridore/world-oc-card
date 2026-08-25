# AI 开发知识库（Knowledge Base）

> 供后续 AI 协作者深度开发调用：术语、机制、坑、SOP 一站式速查。文件定位用 [MAP.md](./MAP.md)，产品/数据/视觉权威定义在 [DESIGN.md](../DESIGN.md)，验收标准在 [DEV_PLAN.md](../DEV_PLAN.md)。
> 当前版本对齐：v2.3.6 · 单测 91 · E2E 16 用例 ×3 浏览器。

---

## 1. 技术栈与版本（注意：版本栈较新，别套旧 API）

| 层 | 库 | 版本 | 注意 |
|----|-----|------|------|
| 框架 | Vue 3 | ^3.5.41 | `<script setup>` + SFC |
| 语言 | TypeScript | **^6.0.3** | strict；`verbatimModuleSyntax`（type 导入须 `import type`） |
| 构建 | Vite | **^8.2.2** | `base: './'`（静态子路径部署） |
| 状态 | Pinia | **^4.0.3** | setup store 写法 |
| 路由 | vue-router | **^5.2.0** | hash history；RouteMeta 模块增强在 router/index.ts 内 declare |
| 校验 | zod | **^4.4.3** | `z.strictObject`（非 `z.object().strict()`）；顶层 `z.uuid` 可用但本仓库用 `z.string().min(1)` |
| UI | naive-ui | ^2.45.1 | **必须显式 import**（无自动导入） |
| 图标 | lucide-vue-next | ^0.577.0 | 按需引入，唯一图标来源 |
| IndexedDB | dexie | ^4.4.5 | 8 表映射文件夹布局 |
| zip | fflate | ^0.8.3 | zipSync/unzipSync 同步 API |
| Markdown | marked | ^18.0.10 | gfm；`marked.parse` 返回 string 时直接 cast |
| 图谱 | @antv/g6 | ^5.1.1 | **增量路径有坑**（见 §5.3） |
| 测试 | vitest ^4 / playwright ^1.62 | — | node 环境 + fake-indexeddb；E2E 走生产构建 preview |
| 其他 | html2canvas（PNG 时间轴/角色卡） | ^1.4.1 | — |

---

## 2. 领域术语表（Glossary）

| 术语 | 精确定义 | 出处 |
|------|----------|------|
| **OC 角色卡（Character）** | 唯一固定字段 `id`+`name`；其余为 FieldBlock 树（Notion 式） | DESIGN §2.1 |
| **FieldBlock** | 七种块：group/kv/text/list/image/table/link；zod 只校验骨架不校验内容 | DESIGN §2.1、types |
| **标签块** | `flag:'tags'` 的 list 块，条目参与标签筛选（不标记不参与） | M2-F4 |
| **百科条目名全局唯一** | `[[条目名]]` 链接解析依赖；重名保存被阻止（A1） | DESIGN 附录 A1 |
| **失效引用占位** | 引用目标缺失时 UI 显示占位，绝不崩溃（G5） | — |
| **世界线（Worldline）** | 类 Git branch；第一条为主世界线（不可删）；状态 active/abandoned | DESIGN §2.4.1 |
| **分叉（Fork）** | 在某事件创建 IF 线；`parentWorldlineId` + `forkPointEventId`；fork 点失效则继承该祖先线（v3：按父线内 rank ≤ fork 点 rank）全部定时常 | DESIGN §2.4.1、fork.ts |
| ~~**序位轴（Rank Axis）**~~（v3 已移除） | ~~时间轴 x 只表达先后：跨世界线按绝对纪元排序 dense rank~~ | ~~timelineOrder.ts（已删）~~ |
| ~~**聚簇（Cluster）**~~（v3 已移除） | ~~同刻多事件折叠为 ×N 聚合点，点击展开~~ | v1.4.0 |
| ~~**绝对纪元（Absolute Era）**~~（v3 已移除） | ~~`value × unitYears + offset`（历法线性换算，排序唯一依据）~~ | calendar.ts（已删） |
| **字符串纪年时间（v3）** | 事件时间双模式：纪年法四段（历/年/月/日，全自由字符串）/ 自定义自由文本；跨历史名需手动排序 | types、branchOrder.ts |
| **排序徽标（v3）** | 不可解析事件带「待排序/手动序」，历史名切换处带「历法转接」；世界线内 `rank` 为顺序唯一真源 | branchOrder.ts |
| **脏实体（Dirty Entity）** | `{kind, id}` 标记；500ms 防抖 flush；只写脏实体的写单元 | DESIGN §3.2、dirty.ts |
| **模板（Template）** | 命名字段组合：角色 fieldBlocks / 百科 attributeKeys+骨架；保存默认剥离值保留结构 | DESIGN §2.6、template.ts |
| **快照（Snapshot）** | 单文件 HTML：内联全部数据（图片仅 ≤200KB dataURL）+ 双主题 + 零外部请求 | DESIGN §2.5、snapshot.ts |
| **箭头三态（arrow）** | `'none' \| 'single' \| 'double'`（schemaVersion 2 起，替代布尔 directed） | A5、v2.0.0 |
| **数据语义色（Data Palette）** | 12 色莫兰迪调色板（DATA_PALETTE），用户数据驱动的颜色；chrome 色纪律豁免 | DESIGN §5.4、colors.ts |

---

## 3. 数据模型速查

### 实体引用关系（全部 UUID 引用）

```
Character ──fieldBlocks──> FieldBlock{ link: targetType(character|codexEntry|event) + targetId }
Character ──participantIds──> TimelineEvent（v3：可含角色或百科势力条目，同一列）
TimelineEvent ──relatedCodexIds──> CodexEntry（通用百科关联，v3 取代 locationId）
~~TimelineEvent ──causalLinks──> TimelineEvent[]（画布连线，v3 已移除）~~
Relation { from, to → Character；typeId → RelationType }
Worldline { parentWorldlineId → Worldline；forkPointEventId → TimelineEvent }
Template { codexTypeId → CodexType；payload.fieldBlocks / attributeKeys }
img 块 ──assetId──> assets 表 Blob（实体只存 assetId，永不内联）
```

### 关键约束清单

| 约束 | 位置 |
|------|------|
| 百科条目标题+名称全局唯一（`[[名]]` 解析） | codex.ts / M3-E1 |
| 主世界线不可删除 | TimelineView（按钮仅子线显示）/ M4-E1 |
| 关系 schema 允许自环（from===to） | GraphView relFormOk / M5-E1 |
| 事件 time 可为 null = 未定时草稿（**v3 归顶部草稿箱，worldlineId 亦为 null**） | types / M4-E3 |
| zip 布局 = dexie 表 = V2 落盘 = 导出格式（**四处一体**） | DESIGN §3.1 / develop §2.1 |
| schema strict：未知字段拒绝（M0-E1） | schemas |
| `CURRENT_SCHEMA_VERSION = 3`（唯一出处 types） | migration 依据 |

### 迁移管道（双通道）

```
zip 导入（parseZip → migrateProject）   ← 旧 zip 自动升级
loadProject 读库（schemaVersion 落后 → 迁移 + writeAllRows 回写） ← 浏览器存量旧数据也升级
STEPS: v0（关系内联 type/directed）→ v1（relationTypes + directed）→ v2（arrow 三态）
每步返回 warnings，导入时提示用户
```

**做破坏性变更的完整步骤（复刻 v2.0.0 参考 commit `216e15c`）**：
1. types：新字段 + `CURRENT_SCHEMA_VERSION`+1
2. schemas：新 schema + 上一版 legacy schema（迁移入口能解析旧数据）
3. migration：`STEPS[oldVer]` 纯转换（收 warnings）
4. zip.ts 布局未变则无需改；变了则 zip/db/local/types 四处同步
5. 测试：migration 单测 + zip 往返 + 旧 zip 导入升级
6. **主版本号** + CHANGELOG「变更」分组
7. RELEASE.md 附录 B 追加验收证据行

---

## 4. 核心机制深度

### 4.1 写路径（防抖 + 脏实体 + 事务）

```
视图 → store 动作 → 内存态变更 + tracker.mark({kind,id})
  → 500ms 防抖（同实体去重，Map key: `${kind}:${id}`）
  → flush：repo.saveEntities → dexie 事务（仅含脏实体涉及的表）
  → 每行 put 前 plain()（JSON 往返剥离 Pinia Proxy，否则 DataCloneError）
删除路径：实体先从数组移除 → 对应 EntityRef 的 id 写 null → saveEntities 内 delete 行
立即落盘时机：visibilitychange(hidden) / beforeunload / Ctrl+S
```

### 4.2 fork 继承语义（fork.ts 核心，v3 rank 边界）

- 子线可见 = **本线自有事件** + **各祖先线按层 fork 边界（≤fork 点事件在该祖先线内的 rank）的定时事件**（v3：不再用绝对纪元）
- boundary 取 fork 点事件在父线的 rank；fork 点缺失 → 该层失效 → **继承该祖先线全部定时常**（forkBroken=true，UI 标记「分叉点失效」）
- 父线 fork 之后新增的事件**不会**出现在子线（M4-F3 反复断言）
- 级联删除世界线 = 连同全部后代线（闭包收集）+ 其事件 + 父引用置空

### 4.3 事件排序（branchOrder，v3）

- 世界线内 `rank`（0..n-1 整数）为顺序唯一真源；软解析（可解析性/插入位）只负责补时间时自动定位，不持久化解析结果
- 可解析：纪年法且 年/月/日 全可转数字（空按 0），按 `(历名, 年, 月, 日)` 元组比较；不可解析（自定义/含非数字 token）→ 线尾 + 「待排序」徽标
- 跨历名：同历名才可自动比较；历名切换处带「历法转接，请核对」徽标（纯派生）
- 拖拽重排（线内）→ `applyOrder` 重编号；显示文本 `displayTime` 派生

### 4.4 颜色纪律机制（G10/G13，改颜色前必读）

- **三个白名单文件**：`tokens.css`（chrome 色，S≤40%）、`utils/colors.ts`（数据语义色 12 色板）、`utils/snapshot.ts`（快照内联模板）——其余文件任何 hex/rgb 字面量都会被 `check:tokens.mjs` 阻塞
- 图表颜色：运行时 `readToken('--token')` / `chartColors()`（主题切换无刷新换肤）
- 数据语义色：`DATA_PALETTE` + `resolveDataColor(hex, theme)`（对比度不足自动向白/黑微调至 ≥3:1）+ `isUsableDataColor`（UI 实时提示）
- `THEME_BG` 必须与 tokens.css 的 `--surface` 保持一致（对比度计算的背景）

### 4.5 主题系统

- `index.html` 内联脚本首屏前设 `data-theme`（localStorage `woc-theme` → 系统 prefers-color-scheme），防闪烁
- store 切换 → `data-theme` → CSS 变量 → 图表组件 watch 重读 token（G6 走重建路径）
- 快照页内联自己的双主题 CSS（不能引用外部 token 文件，为零外链）

### 4.6 图片与资产

- 上传即写 assets 表（Blob 直存）→ `assets.value` 追加 → objectURL 缓存（`assetUrl`，closeProject 时 revoke）
- zip：`assets/index.json`（清单）+ `assets/<uuid>.<ext>` 二进制
- 导出 zip **默认排除孤儿资产**（未被任何 image 块引用；findOrphanAssets）
- 快照内联图片 dataURL 上限 200KB，超限/缺失显示占位
- 红线：任何持久化 JSON 中 `data:image` 次数必须为 0（G6）

---

## 5. 各模块开发要点与已知坑

### 5.1 全局（AGENTS.md 9 条坑的精炼版）

1. **Pinia Proxy 不能直接写 IndexedDB** → local.ts 所有 put 前 `plain()`；新增写路径照做
2. **多根片段视图不能包 `<Transition>`**（EmptyProject + 弹窗；离场永不完成主区空白）→ 入场动画走 `.main { animation: pageIn }` 按路由 key 重建
3. **vue-tsc 在 `<template v-else-if>` 内不做联合窄化** → 模板 cast 辅助（BlockEditor 的 `kv()/txt()`）；根节点 v-if 保证非空的用模板别名（EventDrawer）
4. **Naive UI 组件显式 import**（漏了渲染成未知元素且不报错）
5. 实体 schema strict：改实体先 types + schemas + zip 往返测试
6. **删除实体走 integrity.ts 级联函数**，并对被波及实体逐一 `store.mark()`（否则 db 残留死行）
7. **G6 v5.1 增量更新路径（setData+render）新增边不绘制** → 统一销毁重建走挂载路径 + `lastRenderKey`（数据+主题指纹）跳过无变化重建；渲染串行化防重入
8. **图谱数据 watch 必须 `{ deep: true }`**（relations/characters 原地 push/assign，引用不变浅 watch 不触发）
9. **Playwright 合成拖拽对 G6 画布在 firefox/msedge 无效** → E2E 图谱视口断言用滚轮驱动；时间线卡片点击/DnD 用 DOM（HTML5 `dispatchEvent(dataTransfer)` 驱动重排，G6 坑不影响）

### 5.2 视图级坑

| 位置 | 坑 |
|------|-----|
| TimelineView | 聚簇「收起」按钮曾是裸 `<text>` 被画布拖拽 pointer capture 吞点击（v2.3.3 修）；现在是 `g.cluster-collapse`（含透明命中圆）+ 拖拽 pointerdown 豁免 `.cluster-collapse`。**在时间轴 SVG 上新增可点击元素时注意命中区域与拖拽豁免** |
| TimelineView | 缩放/平移对序位空间（clampSpan）；事件增删由 watch 重置全景；惯性在 `prefers-reduced-motion` 时跳过 |
| CanvasView | Vue Flow 节点必须传 `label: e.title`（v2.3.5 bug：只传 data 渲染空白节点）；拖拽停止 → `upsertEvent` 保存 canvasPos |
| GraphView | 点阵背景跟随：监听 `aftertransform`（没有 viewportchange 事件），`getViewportByCanvas` 两点探测换算；Point 是 `[x,y]` 元组 |
| CharactersView | 自动保存是**输入停顿 800ms 落库**（与存底层 500ms 防抖是两层）；提示节流防刷屏；编辑中切换角色自动落盘当前草稿 |
| CodexView | `[[失效引用:名]]` 是删除级联后的残留占位语法，渲染弱化展示；`[[不存在]]` 提供"创建此条目" |
| EventDrawer | 保存前 `suggestDisplay` 建议展示文本（`suggestDisplay(time, calendars)`） |

### 5.3 E2E 工程经验（新增 E2E 前必读）

- **改了 src 必须 `npm run build`**：playwright webServer 服务的是 dist（preview:4173）；`reuseExistingServer` 会复用旧进程——必要时杀掉 4173
- Naive 弹窗下拉：`locator('.n-base-selection')` 打开 → `keyboard.type` 过滤 → ArrowDown + **Enter**（Enter 即选中关闭，不要再按 Escape，曾导致下拉拦截后续点击）
- G6 画布：禁用合成拖拽断言（见坑 9）；固定 sleep 改就绪条件轮询
- 截图字节比对可做"重绘是否发生"的回归断言（v2.3.2 曲线边测试先例）
- 三浏览器矩阵直接 `npx playwright test`；G6 canvas 在 edge/firefox 分支行为与 chromium 有差异

---

## 6. 变更 SOP（常见任务清单）

| 任务 | 步骤 |
|------|------|
| 加兼容字段 | types → schemas → 使用视图 → 单测（schema 校验 + zip 往返）→ patch 版本 |
| 破坏性数据格式变更 | §3「迁移管道」7 步（**major 版本**） |
| 新视图/路由 | router 注册（RouteMeta 增强在 router 内 declare）→ 视图文件（用 EmptyProject 包多根）→ 侧栏自动按 meta 排序出现 → build + E2E |
| 新增图表颜色 | 运行时读 token（utils/tokens.ts），禁写死色值；数据色走 DATA_PALETTE/resolveDataColor |
| 新增 E2E | e2e/ 目录，按 §5.3 经验；跑 build + playwright |
| 新素材/字体 | CREDITS.md 登记（M7-S1）；位图 ≤100KB、CC0/宽松许可 |
| 每个修改收尾 | package.json 版本（功能+minor/修复+patch/格式+major）+ CHANGELOG 顶部条目 + 行为变更同步 RELEASE.md 附录 B + 提交用 conventional commit（正文带版本号） |

**发布流程**（develop.md §6）：test / coverage / check:tokens / lint / build / playwright 全绿 → 版本+CHANGELOG → RELEASE.md → commit → 部署（dist/ 静态托管）。

---

## 7. 验证命令速查（质量门禁）

```bash
npm run test           # 91 单测全绿（node + fake-indexeddb）
npm run coverage       # storage/utils/schemas：lines≥70% functions≥70% statements≥70% branches≥60%
npm run check:tokens   # G10/G13 阻塞：token 齐全 + chrome S≤40% + 白名单外零色值
npm run lint           # 0 error（8 条已知 unused-vars warning 勿新增）
npm run build          # vue-tsc --noEmit + vite build（类型错误即失败）
npx playwright test    # 16 用例 ×3 浏览器 = 48 执行（发布前提；先 build）
```

---

## 8. FAQ（排障速查）

| 症状 | 原因/解法 |
|------|-----------|
| `DataCloneError` 写入失败 | 写路径漏了 `plain()`（JSON 往返剥离 Proxy）；local.ts saveEntities/importZip 是参照 |
| 图谱/时间轴主题切换留旧色 | 颜色没走 token 运行时读取；G6 走重建路径（theme watch 触发） |
| G6 新增边不绘制 | setData 增量路径退化 → 销毁重建 + lastRenderKey 指纹 |
| 页面切换后主区空白 | 多根片段视图被包了 `<Transition>`（坑 2） |
| 模板 else-if 分支类型报错 | vue-tsc 不窄化联合类型 → 用 `kv()/txt()` cast 辅助 |
| 弹窗下拉点不动/拦截 | E2E 按了 Escape 后回车；或组件漏显式 import |
| vue-router 路由 meta 类型报错 | RouteMeta 模块增强在 src/router/index.ts 的 `declare module 'vue-router'` |
| 快照/导出图片显示失效 | assetId 无对应 assets 记录（预期占位行为，非 bug）；快照内联 >200KB 被跳过 |
| E2E firefox/edge 图谱断言失败 | 合成拖拽无效 → 改滚轮驱动/条件轮询（坑 9） |
| `schemaVersion` 不升级 | 旧数据未走 migrateProject：zip 导入与 loadProject 双通道都要执行迁移 |
| 构建产物刷新 404 | 路由必须 hash history + `base: './'`，勿改（M7-E1） |

---

## 9. 文档互链速查

| 想了解 | 打开 |
|--------|------|
| 文件在哪儿/改哪儿 | 本库 + [MAP.md](./MAP.md) |
| 下一步做什么/什么已否决 | [ROADMAP.md](../ROADMAP.md)（近期排期 / 远期候选 / 已评估暂缓） |
| 数据模型权威定义 | DESIGN.md §2–§3 + src/types/index.ts |
| 这条交互为什么这么做 | DESIGN.md 附录 A1–A9（决策记录） |
| 验收标准原文 | DEV_PLAN.md（M0–M7 / G1–G16） |
| 验收证据 | docs/acceptance/RELEASE.md（含附录 B 逐版本） |
| 历史变更 | CHANGELOG.md |
| 代码导览/开发任务手册 | docs/develop.md |
| 规则与坑速查 | AGENTS.md（自动注入，权威） |

---

*维护约定：新增机制/坑在对应小节补一行并同步 MAP.md；术语新增进 §2。*