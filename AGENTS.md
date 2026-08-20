# AGENTS.md — 石纪 · World OC Card

OC 角色表 × 世界观时间线创作工具。Vue 3 + TS 纯静态 SPA（V1），数据全存浏览器 IndexedDB，zip 导入导出；V2 预留 FastAPI 后端（Repository 抽象层）。

**先读文档（改动前按需）**：
- `DESIGN.md` — 设计文档（数据模型 §3、视觉规范 §5、架构 §4）。改数据格式/存储/主题前必读。
- `DEV_PLAN.md` — 全部验收标准（AC 编号 M0–M7 / G1–G13）。
- `docs/acceptance/RELEASE.md` — 已归档的验收证据；行为变更后需同步更新。

## 常用命令

```bash
npm run dev            # 开发服务器
npm run test           # Vitest 单测（node 环境 + fake-indexeddb）
npm run coverage       # 覆盖率（数据层/纯函数 ≥70% 门槛）
npm run check:tokens   # 颜色纪律静态检查（G10/G13，会阻塞）
npm run lint           # ESLint（当前 0 error / 8 条已知 warning）
npm run build          # vue-tsc --noEmit + vite build（类型错误即失败）
npx playwright test    # E2E（Chromium/Firefox/Edge 三浏览器；需 npx playwright install）
```

## 架构与分层（改动边界）

```
src/types（实体）+ src/schemas（zod，strict）
  → src/storage（db.ts dexie 表 / repository.ts 接口 / local.ts 实现 / zip.ts / migration.ts）
  → src/stores/project.ts（Pinia：内存态 + 脏实体标记 + 防抖 flush）
  → src/views + src/components（UI）
src/utils（纯函数：calendar/fork/integrity/template/markdown/mdExport/snapshot/colors/tokens）
```

- **所有持久化必须经 store 的动作**（upsertXxx/updateSettings/mark → DirtyTracker 防抖写）；不要在视图里直接碰 dexie。
- **zip 文件夹布局（DESIGN §3.1）= 导入导出 = 内部存储 = V2 服务端落盘格式**，四处共用，改一处须四处同步并加迁移（migration.ts 按 schemaVersion 步进）。
- V2 接后端时只新增 RemoteRepository，不改业务层。

## 硬性规则（违反会挂检查或测试）

- **版本与更新日志（每次修改后执行）**：按语义化版本递增 `package.json` 的 `version`（功能+次版本 / 修复+修订号 / 数据格式破坏性变更+主版本号），并在 `CHANGELOG.md` 顶部追加该次修改的概要条目（版本号+日期+变更/新增/修复分组）；应用内版本号显示读取 package.json，无需另行维护。

- **颜色纪律**：禁止在白名单（tokens.css / utils/colors.ts / utils/snapshot.ts）之外写任何 hex/rgb 字面量；chrome 色饱和度 ≤40%；图表颜色运行时读 CSS token（utils/tokens.ts），数据语义色用 DATA_PALETTE + `resolveDataColor(hex, theme)`（双主题对比度 ≥3:1）。
- **图片绝不 base64 内联进 JSON**（G6）；图片走 assets Blob 表，实体里只存 assetId。
- 百科条目名**项目内全局唯一**（`[[条目名]]` 链接解析依赖此约束，附录 A1）。
- 路由必须保持 hash history + vite `base: './'`（静态子路径部署刷新不 404，M7-E1）。
- 实体 schema 是 strict 的（未知字段拒绝）；改实体先改 types + schemas + zip 往返测试。

## 已知坑（本仓库特有）

1. **Pinia 响应式 Proxy 不能直接写 IndexedDB**（DataCloneError）——`local.ts` 所有 put 前过 `plain()`（JSON 往返）。新增写路径必须照做。
2. **路由视图是多根片段**（EmptyProject + 弹窗），不能给 `<RouterView>` 包 `<Transition>`（离场永不完成→主区空白，已踩过）。
3. **vue-tsc 在 `<template v-else-if>` 内不做联合类型窄化**——模板里用 cast 辅助（见 BlockEditor 的 `kv()/txt()` 模式）。
4. **Naive UI 组件必须显式 import**（本项目未开自动导入；漏 import 会渲染成未知元素且不报类型错）。
5. 版本栈较新：zod 4（z.strictObject、顶层 z.uuid）/ pinia 4 / vue-router 5（RouteMeta 需模块增强）/ TS 6 / Vite 8；写代码别套旧 API。
6. 删除实体要走 integrity.ts 的级联函数，并对被波及实体逐一 `store.mark` 脏标记（否则 db 残留死行）。
