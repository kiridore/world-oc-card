# 工程文档地图（Project Map）

> 用途：给人类与 AI 协作者一份"文件 → 职责 → 关联"的完整地图，快速定位任何功能/规则/坑对应哪些文件。
> 配套知识库：[KNOWLEDGE_BASE.md](./KNOWLEDGE_BASE.md)（深度机制、术语、变更 SOP）。
> 当前版本对齐：v2.3.6 · 架构：Vue 3 + TS 纯静态 SPA + IndexedDB(dexie) + zip 导入导出。

---

## 1. 文档体系总览

| 文档 | 内容 | 何时读 |
|------|------|--------|
| [README.md](../README.md) | 产品功能、部署流程（Nginx/GitHub Pages/子路径）、开发命令 | 部署、了解产品全貌 |
| [DESIGN.md](../DESIGN.md) | **设计文档**：数据模型 §3、视觉规范 §5、架构 §4、决策记录附录 A1–A9 | 改数据格式/存储/主题/动效前必读 |
| [DEV_PLAN.md](../DEV_PLAN.md) | **开发计划**：里程碑 M0–M7 + 全局验收标准 G1–G13 + 迭代标准 G14–G16 + 测试策略 | 任何功能开发前查对应 AC 编号 |
| [docs/develop.md](./develop.md) | **开发指南**：代码导览、数据流、常见开发任务手册、测试/验收/发布流程 | 日常开发第一站 |
| [AGENTS.md](../AGENTS.md) | 协作者规则：分层边界、硬性规则（版本/颜色/图片/路由）、**本仓库 9 条已知坑** | 每次动手前（被工具自动注入） |
| [docs/MAP.md](./MAP.md) | 本文档：文件级职责地图 + AC/测试索引 + 变更影响面 | 定位文件、评估改动范围 |
| [ROADMAP.md](../ROADMAP.md) | **路线图**：近期可验收排期（v2.4–v2.7）/ 远期候选 / 已评估暂缓清单 | 规划方向、排期时 |
| [docs/KNOWLEDGE_BASE.md](./KNOWLEDGE_BASE.md) | AI 知识库：术语表、机制深度解析、变更 SOP、FAQ | 深入开发/排查问题时 |
| [docs/acceptance/RELEASE.md](../docs/acceptance/RELEASE.md) | 验收证据归档（M0–M7 逐条 ✅）+ 附录 B 迭代验收记录（v1.2.0→v2.3.3） | 行为变更后需同步更新；发布前核对 |
| [CHANGELOG.md](../CHANGELOG.md) | 逐版本变更日志（语义化版本） | 每次修改后追加条目 |
| [CREDITS.md](../CREDITS.md) | 第三方素材/库许可登记（M7-S1） | 引入新素材时更新 |

**阅读顺序建议**：README（全景）→ DESIGN §3/§4/§5（数据与视觉）→ develop.md（代码导览）→ AGENTS.md（规则与坑）→ 本 MAP 定位文件 → KNOWLEDGE_BASE 深入。

---

## 2. 目录结构地图

```
world-oc-card/
├── index.html               # 入口 HTML；首屏内联脚本防主题闪烁（localStorage → prefers-color-scheme）
├── vite.config.ts           # base:'./'（子路径部署）；alias '@'→src；Vitest 配置（node 环境+fake-indexeddb，覆盖率门槛）
├── tsconfig.json            # strict；paths '@/*'；include src/tests/scripts/e2e/playwright
├── eslint.config.js         # 0 error / 8 已知 warning；忽略 scripts/ e2e/
├── playwright.config.ts     # E2E：vite preview:4173 + Chromium/Firefox/Edge 三浏览器矩阵
├── package.json             # 版本唯一出处（应用内版本号读它）；依赖见 KNOWLEDGE_BASE §1
├── src/                     # 全部业务代码（~5800 行）
├── tests/                   # Vitest 单测（91 个，node + fake-indexeddb）
├── e2e/                     # Playwright（smoke 1 + verification 13 + perf 1 = 15 用例 ×3 浏览器）
├── scripts/check-tokens.mjs # G10/G13 颜色纪律静态检查（阻塞门禁）
├── docs/                    # 本文档体系
├── public/favicon.svg       # 石纹标识
└── .zcode/                  # 本地会话计划（gitignored，非产物）
```

### src/ 分层地图（依赖方向：上 → 下）

```
types/index.ts（实体类型 + CURRENT_SCHEMA_VERSION=2）   ← 格式版本唯一出处
  ↓
schemas/index.ts（zod strict 校验 + legacy 格式 schema）
  ↓
storage/（repository 接口 → local 实现 / zip / migration / db）
  ↓
stores/project.ts（Pinia：内存态 + 脏标记 + 防抖 flush）  ← 视图唯一数据入口
  ↓
views/ + components/（7 路由视图 + 编辑器/抽屉组件）
  ↑
utils/（纯函数，无 Vue 依赖，全部可单测）
```

---

## 3. 源码文件地图（文件 → 职责 → 关键导出 → 关联）

### 3.1 领域层（types / schemas / data）

| 文件 | 职责 | 关键内容 |
|------|------|----------|
| `src/types/index.ts` | 全部实体 TS 类型（与 DESIGN §2/§3 一一对应） | `Character/CodexEntry/TimelineEvent/Worldline/Relation/Template/ProjectData...`；`CURRENT_SCHEMA_VERSION = 2` |
| `src/schemas/index.ts` | zod strict 校验；zip 各文件形状；**legacy 格式 schema**（迁移输入） | `fieldBlockSchema`（discriminatedUnion 七种块，z.lazy 支持 group 嵌套）；`parseWith()` 统一解析入口 |
| `src/data/builtinTemplates.ts` | 内置示例模板 | 基础角色卡/详细角色卡/地点条目（fixed id：`tpl-basic-character` 等） |

### 3.2 存储层（storage/）

| 文件 | 职责 | 关键点 |
|------|------|--------|
| `repository.ts` | Repository 接口（V2 换后端的接缝） | `EntityKind/EntityRef`；saveEntities 只写脏实体；importZip 的 overwrite/copy 双模式 |
| `db.ts` | dexie 表定义（8 表 = §3.1 文件夹布局） | 实体行带 `projectId`（索引用，内存态/zip 无此字段，仓库层增删） |
| `local.ts` | LocalRepository（IndexedDB 实现） | **`plain()` 剥离 Pinia Proxy**（DataCloneError 坑）；写钩子事务；loadProject 升级回写旧数据；exportZip 排除孤儿资产 |
| `zip.ts` | buildZip/parseZip（fflate，纯函数） | 逐文件容错解析（M1-E1）；project.json/settings.json 损坏拒绝，实体文件损坏跳过 |
| `migration.ts` | schemaVersion 步进迁移管道 | `STEPS: {0: v0toV1, 1: v1toV2}`；返回 warnings；zip 导入与 loadProject 双通道执行 |

### 3.3 状态层（stores/ + composables/）

| 文件 | 职责 | 关键点 |
|------|------|--------|
| `stores/project.ts` | 主 store：项目生命周期 + 实体 CRUD + 资产 + zip | `openProject` 全量读入内存；`mark()/flush()`；`forkWorldline`；`addAsset` 即时落盘不走防抖；`reopenLastProject`（G4） |
| `stores/theme.ts` | 主题 store | `data-theme` 属性 + localStorage(`woc-theme`) |
| `composables/useShortcuts.ts` | 全局快捷键 | Ctrl+S / Ctrl+Shift+T / Ctrl+Alt+C / Ctrl+Alt+E / ?；经 `window` CustomEvent（`woc:new-character` 等）通知视图 |

### 3.4 工具层（utils/，纯函数）

| 文件 | 职责 | 关联验收 |
|------|------|----------|
| `calendar.ts` | ~~历法线性换算~~（v3 已移除） | 绝对纪元 = value×unitYears+offset；M4-F6 ~~（v3 去数值纪年，文件已删）~~ |
| `fork.ts` | 世界线 fork 继承语义 | `visibleEventsFor()` 子线可见事件集合；fork 点失效容错；M4-F3/F4/E2（v3：继承边界改按线内 rank） |
| `timelineOrder.ts` | ~~事件序位轴（dense rank）~~（v3 已移除） | ~~同刻共享序位；suggestInsertAbs 中值插入~~；文件已删 |
| `branchOrder.ts` | 事件排序纯函数（v3，字符串纪年） | `parseStatus`（可解析性）/`displayTime`/`insertIndex`/`applyOrder`（重编号）/`badgeFor`（待排序/手动序/历法转接徽标）；M4 |
| `fling.ts` | ~~惯性滑动速度估算~~（v3 序位轴移除，文件未引用） | 120ms 窗口样本；τ=180ms 上限 2.5px/ms（留待清理） |
| `zoom.ts` | ~~缩放尺度钳制~~（v3 序位轴移除，文件未引用） | MIN_SPAN 0.05 / 全景外扩两格（留待清理） |
| `integrity.ts` | 引用完整性：删除前扫描/级联/巡检/孤儿资产 | `characterReferences/codexReferences/eventReferences`；`remove*Cascade`；`scanBrokenReferences`；`findOrphanAssets`；M2-E1/M3-E2/M4-E1/E2/M7-F1/F2 |
| `markdown.ts` | Markdown 渲染 + `[[条目名]]` 双向链接 | `preprocessCodexLinks`（含失效引用占位）；marked |
| `template.ts` | 模板纯逻辑 | stripBlockValues（结构剥离）/insertTemplateBlocks/serialize+parseTemplateFile/全文搜索/标签收集 |
| `codex.ts` | 百科名称全局唯一 | `codexNameUnique` / `findCodexByName`（A1 约束） |
| `mdExport.ts` | 角色卡 → Markdown | 全块结构覆盖；图片引用附 assets；M6-F2 |
| `snapshot.ts` | 单文件 HTML 快照 | 内联数据 + 双主题 + 极小 Markdown 子集渲染；图片 ≤200KB 内联否则占位；M6-F4 |
| `colors.ts` | 数据语义色系统 | `DATA_PALETTE` 12 色；`resolveDataColor(hex, theme)` 对比度 ≥3:1 自动微调；`contrastRatio` |
| `tokens.ts` | 运行时读 CSS token（图表换肤） | `chartColors()` / `readToken()`；G9/G10 |
| `dirty.ts` | DirtyTracker（防抖+脏集合）+ dexie 写钩子计数器 | 500ms 防抖；flush/unmark/clear；M1-F4/E2 |
| `graphHolder.ts` | 跨视图共享 G6 实例 | 导出中心 toDataURL 用 |
| `id.ts` / `download.ts` | uuid/nowIso；下载/上传辅助 | — |

### 3.5 视图层（views/，6 路由）

| 视图 | 路由 | 职责/要点 |
|------|------|-----------|
| `HomeView.vue` | `/` | 项目列表（新建/导入 zip/重命名/删除/打开）；错落入场动画 |
| `CharactersView.vue` | `/characters` | 角色列表（全文搜索/标签筛选）；**新建即编辑** + 输入停顿 800ms 自动保存 + 提示节流；跳转自图谱 `?id=` |
| `CodexView.vue` | `/codex` | 条目 CRUD、类型侧栏（内置 6 + 自定义）、`[[链接]]` 渲染+反向引用、属性模板、颜色选择 |
| `TimelineView.vue` | `/timeline` | **泳道式卡片时间线（v3）**：世界线泳道（fork 曲线 SVG 覆盖层）、横/纵双模式切换（PC 默认横 / 移动端默认纵）、顶部草稿箱、排序徽标、线内拖拽重排（HTML5 DnD）、废弃线折叠、编辑抽屉 |
| `GraphView.vue` | `/graph` | G6 图谱：力导向、曲线边、类型管理（箭头三态）、边创建/编辑、类型过滤图例、点阵背景跟随、lastRenderKey 指纹 |
| `ExportView.vue` | `/export` | 导出中心：zip / 角色 MD / PNG（角色卡/图谱/时间轴）/ 单文件 HTML 快照 |

> v3 已移除：`CanvasView`（画布视图）、`/timeline/canvas` 路由、Vue Flow 依赖、SVG 序位轴（缩放/平移/惯性/聚簇/序位网格）交互。

### 3.6 组件层（components/）

| 组件 | 职责 |
|------|------|
| `EmptyProject.vue` | 未打开项目时多根片段的兜底占位（**不能包 Transition**，坑 2） |
| `blocks/BlockEditor.vue` | 七种字段块编辑器（~400 行）；模板里用 `kv()/txt()` 类型 cast 辅助（坑 3） |
| `blocks/BlockView.vue` | 角色卡只读渲染（衬线正文 16px/1.75） |
| `timeline/EventDrawer.vue` | 事件编辑抽屉（双模式时间 `EventTimeEditor`、世界线选择、参与者〔角色/势力〕、关联百科、放回草稿箱、fork/删除） |
| `timeline/EventTimeEditor.vue` | 时间双模式表单（未定时/纪年法四段/自定义自由文本，全字符串） |
| `TemplateManager.vue` / `TemplatePicker.vue` | 模板管理抽屉（重命名/删除/排序）/ 新建模板选择弹窗 |
| `IntegrityDrawer.vue` | 巡检面板（失效引用列表 + 跳转 + 孤儿资产清理） |
| `AssetImage.vue` | 资产图片渲染（objectURL 缓存，失效引用占位） |
| `MarbleBackground.vue` | 程序化大理石纹理层（feTurbulence，单一固定装饰层） |
| `ThemeToggle.vue` | 主题切换按钮 |

### 3.7 样式与外壳

| 文件 | 职责 |
|------|------|
| `src/styles/tokens.css` | **唯一颜色来源**：双主题 design token（dark/light 两块 + 通用）；大理石纹理参数；check-tokens.mjs 校验目标 |
| `src/styles/base.css` | 全局基础（字体栈、正文排版、页面入场动画 pageIn、reduced-motion 关闭动效） |
| `src/App.vue` | 应用壳：Naive UI provider、侧栏导航（meta.order 排序）、巡检/快捷键入口、主题切换、`main` 按路由 key 重建仅做入场动画 |
| `src/main.ts` | 入口：pinia + router + base.css |

---

## 4. 测试与质量工具地图

### 4.1 单测（tests/，91 个；节点环境 + fake-indexeddb）

| 测试文件 | 覆盖 AC | 被测对象 |
|----------|---------|----------|
| `schemas.test.ts` | M0-F3/E1 | FieldBlock 骨架校验、非法数据路径定位 |
| `storage.test.ts` | M1-F1/F2/F3/F4/F5/F6/E1/E2/D1/P1/P2、M7-F2 | 项目管理、zip 往返深比较、写钩子断言（只写脏表）、图片 Blob 隔离、迁移、残缺导入、防抖聚合、性能、孤儿资产排除 |
| `template.test.ts` | M2-F5/F6/F8/F3/F4/D1 | 模板结构剥离/插入/文件往返/全文搜索/标签 |
| `integrity.test.ts` | M2-E1、M3-E2/E1、M4-E1/E2、M7-F1/F2 | 引用扫描与级联删除、名称唯一、巡检、孤儿资产 |
| `markdown.test.ts` | M3-F2、M3-D1 | `[[链接]]` 双向解析 |
| `branchOrder.test.ts` | M4（v3 字符串纪年排序） | 可解析判定/展示文本/插入位/重编号/徽标派生（含历法转接） |
| `fork.test.ts` | M4-F3/F4/E2/D1 | fork 继承语义（v3 rank 边界）、多级分叉、分叉点失效容错 |
| `zoom.test.ts` | G14、v1.5.0 | 缩放钳制（序位轴交互 v3 已移除，仅保留 clampSpan 纯函数） |
| `fling.test.ts` | v2.2.0 | 惯性速度估算（v3 序位轴移除，留待清理） |
| `colors.test.ts` | G11、M4-S1、M3-S1 | 调色板双主题对比度 ≥3:1 |
| `export.test.ts` | M6-F2/F4/E1 | 角色 Markdown 全块、HTML 快照（零外链/体积/占位） |

### 4.2 E2E（e2e/，15 用例 × Chromium/Firefox/Edge = 45 执行）

| 文件 | 用例 | 覆盖 |
|------|------|------|
| `smoke.spec.ts` | 主链路冒烟 | 新建项目→模板建角色→时间线建草稿补时间入列→横纵切换→导出 zip |
| `verification.spec.ts` | 13 个功能验收 | G9 双主题 / G4 持久化 / G2 控制台 / M4 fork / M4-E3 草稿箱（进出+放回）/ M4-F8 横纵切换 / M4 线内 DnD 重排 / M5 图谱渲染 / 页内建关系曲线 / 点阵跟随 / M6 快照 / M7-E1 子路由 / M7 巡检 |
| `perf.spec.ts` | 大规模数据 | 打开 <1s、时间轴（1000 事件卡片泳道）渲染 <2s |

### 4.3 质量门禁命令

| 命令 | 门槛 | 说明 |
|------|------|------|
| `npm run test` | 91/91 绿 | 数据层+纯函数（node + fake-indexeddb） |
| `npm run coverage` | lines/functions/statements ≥70%、branches ≥60% | 范围仅 src/storage、src/utils、src/schemas |
| `npm run check:tokens` | 阻塞 | 双主题 token 齐全、chrome 饱和度 ≤40%、**白名单外零颜色字面量** |
| `npm run lint` | 0 error（8 已知 warning） | scripts/e2e 忽略 |
| `npm run build` | vue-tsc 0 错误 | 类型错误即失败 |
| `npx playwright test` | 48/48 | 需先 build；preview 起在 4173；改动后杀旧 4173 进程 |

---

## 5. 验收标准索引（AC 编号 → 文档位置）

| 编号集 | 含义 | 文档位置 |
|--------|------|----------|
| M0–M7 | 里程碑验收（F 功能/E 边界/P 性能/D 数据/S 风格） | DEV_PLAN §3（详述）→ RELEASE.md（✅ 证据） |
| G1–G13 | 全局标准（生产验收/控制台/中文/数据不丢/失效容错/无 base64/浏览器矩阵/测试/双主题/颜色纪律/对比度/字体/低饱和） | DEV_PLAN §2 → RELEASE.md「全局标准」 |
| G14–G16 | 迭代期全局标准（~~缩放限制/聚簇可交互~~ v3 序位轴移除 / 图谱即时重绘） | DEV_PLAN 附录 B → RELEASE.md 附录 B |
| A1–A9 | 设计决策记录 | DESIGN.md 附录 A |

---

## 6. 变更影响面映射（改一处 → 动哪些）

| 改动内容 | 必须同步的文件 | 必跑验证 |
|----------|----------------|----------|
| 实体加字段（兼容） | types → schemas → 使用视图 → 单测 | test + build |
| **数据格式破坏性变更** | types（`CURRENT_SCHEMA_VERSION`+1）→ schemas（+legacy schema）→ migration（LS `STEPS[oldVer]`）→ zip 往返测试 → **主版本号**；布局变更则 zip/db/local/types 四处同步 | test + coverage + RELEASE.md 附录 B |
| 新增视图/路由 | router + views + （侧栏 meta.order 自动纳入） | build + E2E 矩阵 |
| 新增颜色/图表色 | 只能走 tokens.css / colors.ts / snapshot.ts 白名单；图表运行时读 token | check:tokens |
| 新 E2E | e2e/（生产构建跑）| build + playwright |
| 任何行为变更 | CHANGELOG 顶部 + package.json 版本 +（行为性则）RELEASE.md 附录 B | — |
| 新图片素材 | CREDITS.md 登记；≤100KB；CC0 | M7-S1 |
| V2 接后端 | 仅新增 RemoteRepository 实现 repository.ts 接口 | 业务层零改动 |

---

## 7. 数据流速览（写/读两路径）

```
写：视图 → store 动作(upsertXxx/updateSettings/mark) → 内存态 + DirtyTracker 标脏
    → 500ms 防抖（或 visibilitychange/beforeunload/Ctrl+S flush）
    → repo.saveEntities（只写脏实体，dexie 事务包裹，所有 put 前 plain()）
读：Home openProject → loadProject 一次全量读入 store 内存 → 视图全部读内存态
图片：addAsset 上传即写 assets 表（Blob），实体只存 assetId；zip 里 assets/<uuid>.<ext>
```

---

*维护约定：本文档随代码演进更新；新文件新增时在 §3 对应层登记一行。*