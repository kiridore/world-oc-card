# 开发指南（Develop Guide）

> 面向在本仓库写代码的开发者。部署与使用见 [README](../README.md)，仓库规则速查见 [AGENTS](../AGENTS.md)，数据模型与视觉规范见 [DESIGN](../DESIGN.md)，验收标准见 [DEV_PLAN](../DEV_PLAN.md)。
> 当前版本 v2.3.3 · Vue 3 + TS + Vite 纯静态 SPA · 数据全存浏览器 IndexedDB

## 1. 代码导览

```
src/
  types/index.ts        实体 TS 类型 + CURRENT_SCHEMA_VERSION（数据格式版本的唯一出处）
  schemas/index.ts      zod strict 校验（与 types 一一对应；未知字段拒绝）
  storage/
    db.ts               dexie 表定义（表 = zip 文件夹布局）
    repository.ts       Repository 接口（V2 换后端时新增 RemoteRepository 实现）
    local.ts            IndexedDB 实现（所有 put 前过 plain()，见 §3.1）
    zip.ts              项目 zip 导入导出（fflate）
    migration.ts        schemaVersion 步进迁移管道（v0→v1→v2→v3）
  stores/project.ts     Pinia：内存态 + DirtyTracker 脏标记 + 500ms 防抖 flush
  views/                六个路由视图（Home/Characters/Codex/Timeline/Graph/Export）
  components/           视图内组件（BlockEditor 块编辑器、TemplatePicker/Manager 等）
  utils/                纯函数（无 Vue 依赖，可单测）
    branchOrder(事件排序：软解析/重编号/徽标)/fork/integrity/template/markdown/mdExport/snapshot/colors/tokens/
    graphHolder(导出用 G6 实例)；fling(惯性)/zoom(缩放钳制) 已随 v3 序位轴移除删除
e2e/                    Playwright（smoke / verification 14 / perf），三浏览器矩阵
scripts/check-tokens.mjs G10/G13 颜色纪律静态检查
```

**数据流（写路径）**：视图 → store 动作（`upsertXxx` / `updateSettings` / `mark`）→ 内存态变更 + DirtyTracker 标脏 → 500ms 防抖 flush → Repository.put → dexie。**视图绝不直接碰 dexie**。

**数据流（读路径）**：Home 打开项目 → `loadProject` 一次读全量进内存 → 视图全部读 store 内存态（无逐实体异步读）。

## 2. 核心机制

### 2.1 四处一体的文件夹布局

`DESIGN §3.1` 的 zip 布局 = zip 导入导出 = dexie 内部存储 = V2 服务端落盘格式。**改布局必须四处同步**（zip.ts、db.ts/local.ts、types/schemas、V2 预留语义）并加迁移。

### 2.2 迁移管道（schemaVersion）

- 版本号在 `src/types/index.ts` 的 `CURRENT_SCHEMA_VERSION`；
- `migration.ts` 按步进函数迁移（`STEPS: { [fromVersion]: fn }`），**zip 导入**与 **loadProject 读库**双通道都会执行——旧 zip 导入、旧数据开箱均自动升级；
- 每步迁移返回 warnings（导入时提示用户哪些数据被转换）。

### 2.3 图片永不内联

图片存 assets 表的 Blob，实体只存 `assetId`；zip 里是 `assets/<uuid>.<ext>` 二进制文件。`data:image` 出现在任何 JSON 里都是 bug（G6 验收红线，测试断言计数为 0）。

## 3. 硬性规则（违反会挂测试/检查）

### 3.1 Pinia 响应式 Proxy 不能直接写 IndexedDB

`local.ts` 所有 put 前过 `plain()`（JSON 往返剥离 Proxy）。**新增任何写路径必须照做**，否则 DataCloneError。

### 3.2 删除走级联 + 逐个标脏

删实体必须走 `utils/integrity.ts` 的级联函数，并对被波及实体逐一 `store.mark(...)`，否则 db 残留死行（孤儿行）。

### 3.3 颜色纪律

- 白名单（tokens.css / utils/colors.ts / utils/snapshot.ts）之外**禁止任何 hex/rgb 字面量**；
- chrome 色饱和度 ≤40%（check-tokens.mjs 强制）；
- 图表颜色运行时读 CSS token（`utils/tokens.ts` 的 `chartColors()`）；数据语义色用 `DATA_PALETTE` + `resolveDataColor(hex, theme)`。

### 3.4 版本与更新日志

每次修改：按语义化版本 bump `package.json`（功能+minor / 修复+patch / 数据格式破坏+major），并在 `CHANGELOG.md` 顶部追加条目。应用内版本号自动读 package.json。

### 3.5 其他

- 路由保持 hash history + vite `base: './'`（静态子路径部署刷新不 404）；
- Naive UI 组件**显式 import**（未开自动导入）；
- 百科条目名项目内全局唯一（`[[链接]]` 解析依赖）；
- 实体 schema 是 strict 的：改实体先改 types + schemas + zip 往返测试。

## 4. 常见开发任务

### 4.1 给实体加字段（不改格式版本）

兼容性新增（旧数据缺字段可默认）时：types → schemas → 使用该字段的视图 → 单测（schema 校验 + zip 往返）。

### 4.2 数据格式变更（破坏性，CURRENT_SCHEMA_VERSION +1）

1. `types/index.ts`：新类型 + `CURRENT_SCHEMA_VERSION` +1；
2. `schemas/index.ts`：新 schema + **上一版 legacy schema**（迁移入口要能解析旧数据）；
3. `migration.ts`：新增步进函数 `STEPS[oldVer]`（纯转换，收 warnings）；
4. `zip.ts` 无需改（布局未变时）；布局变了则四处同步（§2.1）；
5. 测试：migration 单测（旧→新字段映射、warnings）+ zip 往返；
6. **major 版本号** + CHANGELOG 破坏性变更分组。
参考实现：v2.0.0 `directed → arrow`（git `216e15c`）。

### 4.3 新增视图 / 路由

router 注册（hash history，RouteMeta 需模块增强时在 router 里 declare）→ 视图文件 → 侧栏入口。多根片段视图（EmptyProject + 弹窗）**不要**包 `<Transition mode="out-in">`（离场永不完成，主区空白）；页面入场动效用 `.main { animation: pageIn }` 按路由 key 重建。

### 4.4 图谱（G6 v5.1）相关

- 渲染统一**销毁重建**（挂载路径 preLayoutDraw）——增量路径（`setData`+`render`）新增边不绘制，见 AGENTS 坑 7；
- 数据 watch 必须 `{ deep: true }`（relations/characters 原地变更，引用不变）；
- Point 是 `[x, y]` 元组；视口变换事件是 `aftertransform`（无 viewportchange）；探测视口用 `getViewportByCanvas` 两点法；
- 泳道式卡片时间线（TimelineView，纯 DOM + SVG 覆盖层连线）没有 G6 的坑——卡片点击/横纵切换/拖拽重排（HTML5 DnD）均直接断言 DOM，详见「新增 E2E」；坑都在 G6 图谱侧。

### 4.5 新增 E2E

- 放 `e2e/`，跑生产构建（playwright webServer 起 `vite preview:4173`）——**改了 src 必须先 `npm run build`**，preview 服务的是 dist（`reuseExistingServer` 会复用旧进程，必要时杀掉 4173）；
- Naive 弹窗内选择器：`locator('.n-base-selection')` 打开后 `keyboard.type` 过滤 + ArrowDown + Enter 选中（Enter 即选中并关闭，不要再按 Escape——曾导致下拉拦截后续点击）；
- 涉及 G6 画布视口的断言用**滚轮**驱动，不要合成拖拽（firefox/msedge 分支无效，AGENTS 坑 9）；时间线卡片点击/线内 DnD 重排用 DOM（`dispatchEvent` + `DataTransfer`）驱动，不涉及 G6 兼容坑；
- 三浏览器矩阵：`npx playwright test`（chromium/firefox/msedge projects 已配好）。

## 5. 测试与验收

```bash
npm run test           # Vitest 90 个（node 环境 + fake-indexeddb）
npm run coverage       # 覆盖率（数据层/纯函数 ≥70% 门槛）
npm run check:tokens   # 颜色纪律（阻塞）
npm run lint           # 0 error / 8 条已知 warning
npm run build          # vue-tsc --noEmit + vite build
npx playwright test    # E2E：16 用例 × chromium/firefox/msedge = 48 执行（矩阵全过是发布前提）
```

- 单测覆盖：schemas / storage（dexie 写钩子断言单记录写）/ zip 往返深比较 / migration / template / markdown / integrity 级联 / branchOrder（替代旧 calendar/timelineOrder）/ fork 继承语义 / colors 对比度 / mdExport / snapshot；
- 行为变更后更新 `docs/acceptance/RELEASE.md` 的迭代验收记录（附录 B）；- 人工走查用生产 preview（`npx vite preview --port 4288`），不要用 dev server 验收（G1）。

## 6. 发布流程

1. 全量绿：test / coverage / check:tokens / lint / build / playwright 三浏览器；
2. `CHANGELOG.md` 顶部条目 + `package.json` 版本号；
3. 更新 `docs/acceptance/RELEASE.md`（新版本追加验收证据行）；
4. 提交（conventional commit，正文带版本号）；
5. 部署见 README（静态托管，dist/ 目录即产物）。
