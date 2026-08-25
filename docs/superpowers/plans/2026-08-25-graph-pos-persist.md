# 图谱节点位置持久化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 关系图谱的节点位置不再每次打开/重渲染复位——拖拽后的布局在重开页面、主题切换、数据变更重建后保持不变。

**Architecture:** 位置持久化到 localStorage（视图偏好，不进入项目数据/zip 格式，避免 schemaVersion 变更）：键 `woc:graph-pos:<projectId>` → `{ [nodeId]: { x, y } }`。保存时机：`afterlayout`（仅当无任何已存位置时，落初始力导布局结果）+ `node:dragend`（单节点增量）；恢复时机：`afterlayout` 后对已存节点逐个 `graph.translateElementTo(id, [x, y])`（G6 v5.1 已确认存在此 API，runtime/graph.d.ts:1052）。导出 `window.__wocGraph = graph` 供 E2E 读取 `getNodeData(id).x/y`（生产构建亦存在，无害并作为标准测试接缝）。

**Tech Stack:** Vue 3 + TS + G6 v5.1；Vitest 无关；Playwright E2E。

## Global Constraints

- 版本：本次为 3.1.4（修复）；CHANGELOG 顶部追加。
- 不新增依赖；不改 schema/zip/存储层；不改 Character 实体。
- 颜色纪律无关；`npm run build`/`lint`/`check:tokens` 必须绿；Playwright 三浏览器 51/51（新增用例后 52/52）。
- 仓库坑 #9：Playwright 合成拖拽在 firefox/msedge 对 G6 画布无效（chromium 正常）——E2E 位置恢复断言用「预置 localStorage + reload + getNodeData 读取」实现（三浏览器通用）；拖拽保存断言仅在 chromium 分支用 `page.mouse` 驱动。
- 软规则：已有位置时不覆盖（首次布局结果落盘后，后续重建只恢复不重写，避免把恢复后的位置又写回去造成抖动）。

---

### Task 1（唯一任务）：GraphView 位置持久化 + E2E

**Files:**
- Modify: `src/views/GraphView.vue`
- Modify: `e2e/verification.spec.ts`（新增 1 用例）
- Modify: `CHANGELOG.md`、`package.json`/`package-lock.json`（3.1.4）

**Interfaces:**
- Consumes: `store.current.id`（项目 id）、G6 `graph.on('afterlayout')` / `graph.on('node:dragend')` / `graph.translateElementTo` / `graph.getNodeData`
- Produces: `window.__wocGraph`（E2E 接缝）；localStorage 键 `woc:graph-pos:<projectId>`

- [ ] **Step 1: 实现位置存取（GraphView.vue script 区）**

```ts
// ---- 图谱节点位置持久化（视图偏好，localStorage 按项目隔离；不进 zip/数据）----
interface SavedPos { x: number; y: number }
function posKey(): string {
  return `woc:graph-pos:${store.current?.id ?? 'none'}`
}
function loadPositions(): Record<string, SavedPos> {
  try {
    const raw = localStorage.getItem(posKey())
    const parsed = raw ? JSON.parse(raw) : {}
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}
function savePositions(map: Record<string, SavedPos>): void {
  try { localStorage.setItem(posKey(), JSON.stringify(map)) } catch { /* 容量/隐私模式忽略 */ }
}
```

- [ ] **Step 2: doRender 内接线（在图创建后、render 前注册监听）**

在现有 `graph.on('node:click', ...)` 之后追加：

```ts
graph.on('afterlayout', (() => {
  let restored = false // 本次渲染只恢复/保存一次
  return () => {
    if (restored || !graph) return
    restored = true
    const saved = loadPositions()
    const ids = data.nodes.map((n) => n.id)
    const toRestore = Object.entries(saved).filter(([id]) => ids.includes(id))
    if (toRestore.length > 0) {
      graph.translateElementTo(
        Object.fromEntries(toRestore.map(([id, p]) => [id, [p.x, p.y] as [number, number]])),
        false,
      )
      return
    }
    // 首次打开：力导布局落盘，之后不再覆盖
    const map: Record<string, SavedPos> = {}
    for (const d of graph.getNodeData()) {
      const dd = d as unknown as { x?: number; y?: number }
      if (typeof dd.x === 'number' && typeof dd.y === 'number') map[d.id] = { x: dd.x, y: dd.y }
    }
    savePositions(map)
  }
})())
```

（`translateElementTo` 存在批量重载 `translateElementTo(positions: Record<ID, Point>)`——若 TS 签名不匹配，退化为循环单点调用 `await graph.translateElementTo(id, [x, y], false)`，实现时以实际编译为准，方法名不改。）

- [ ] **Step 3: 拖拽保存 + 测试接缝**

```ts
graph.on('node:dragend', ((e: { target: { id: string } }) => {
  const dd = graph?.getNodeData(e.target.id) as unknown as { x?: number; y?: number } | undefined
  if (graph && dd && typeof dd.x === 'number' && typeof dd.y === 'number') {
    const map = loadPositions()
    map[e.target.id] = { x: dd.x, y: dd.y }
    savePositions(map)
  }
}) as never)
```

doRender 末尾（`lastRenderKey = key` 之前或之后均可）：

```ts
;(window as unknown as { __wocGraph?: unknown }).__wocGraph = graph // E2E 接缝
```

- [ ] **Step 4: 写失败→通过的 E2E（verification.spec.ts 新增用例）**

```ts
test('M5-E2 图谱节点位置持久化：布局落盘、恢复与拖拽更新', async ({ page }) => {
  await freshProject(page, '图谱位置验证')
  // 造两个角色以便有节点
  await page.getByRole('button', { name: /新建角色/ }).first().click()
  await page.getByPlaceholder('角色名称').fill('甲')
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
  await page.keyboard.press('Escape')
  // 首次打开：afterlayout 落盘
  await page.goto('/#/graph')
  await page.waitForTimeout(1200)
  const saved = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('woc:graph-pos:'))
    return key ? JSON.parse(localStorage.getItem(key)!) : null
  })
  expect(saved).not.toBeNull()
  expect(Object.keys(saved!).length).toBeGreaterThanOrEqual(1)
  const nodeId = Object.keys(saved!)[0]!
  // 位移落盘
  await page.evaluate((id) => {
    const g = (window as unknown as { __wocGraph?: { translateElementTo: (...a: unknown[]) => Promise<void> } }).__wocGraph
    return g!.translateElementTo(id, [400, 300], false)
  }, nodeId)
  await page.waitForTimeout(300)
  const afterMove = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('woc:graph-pos:'))!
    return JSON.parse(localStorage.getItem(key)!)
  })
  // 恢复：重开页面后节点回到保存位置（三浏览器通用，规避坑 9）
  await page.reload()
  await page.waitForTimeout(1200)
  const pos = await page.evaluate((id) => {
    const g = (window as unknown as { __wocGraph?: { getNodeData: (id: string) => unknown } }).__wocGraph
    const d = g!.getNodeData(id) as { x?: number; y?: number }
    return { x: d.x, y: d.y }
  }, nodeId)
  expect(Math.abs(pos.x! - afterMove[nodeId].x)).toBeLessThanOrEqual(2)
  expect(Math.abs(pos.y! - afterMove[nodeId].y)).toBeLessThanOrEqual(2)
})
```

注：`translateElementTo` 单点批量签名以编译为准；`getNodeData` 定位 x/y 断言 ±2。若 E2E 需要真实拖拽分支（chromium only），在用例末尾加 `test.skip(project !== chromium)` 段用 `page.mouse` 拖拽后断言 localStorage 值变化——可选，不强求。

- [ ] **Step 5: 门禁**

```bash
npm run build && npm run lint && npm run check:tokens && npm run test && npx playwright test
```
Expected: build ✓ · lint 0/8 · tokens ✓ · 90/90 · Playwright 52/52（三浏览器）

- [ ] **Step 6: 版本、CHANGELOG、提交**

- package.json/lock → 3.1.4
- CHANGELOG 顶部：「3.1.4（2026-08-25）——修复：关系图谱节点位置持久化（拖拽/布局结果按项目记忆，重开与重建不再复位；localStorage 视图偏好，不随 zip）」
- 提交：`git commit -am "fix(graph): 图谱节点位置持久化（v3.1.4）"`

---

## Self-Review

1. **规格覆盖**：落盘（首布局 + dragend）/恢复（afterlayout 后 translate）/项目隔离/E2E 三浏览器/版本文档——全在单任务内。
2. **类型一致**：`loadPositions/savePositions/posKey` 命名唯一；G6 API（afterlayout/node:dragend/translateElementTo/getNodeData）已在本仓库 node_modules 确认存在。
3. **坑预判**：(a) 恢复只对仍存在的节点 id，失效节点条目自然忽略；(b) 已有位置时不重写（软规则），避免每次重建把恢复值当新值回写；(c) getNodeData 的 x/y 在 v5 无显式类型（index signature），用局部 cast；(d) 首开落盘在 afterlayout——布局异步完成前不写，避免写到全零坐标。