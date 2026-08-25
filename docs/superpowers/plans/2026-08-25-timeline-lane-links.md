# 时间线泳道连线与分叉对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 时间线泳道视图（1）用实线背骨串联同一世界线的节点，（2）IF 线首卡按锚点卡的相对位置对齐（横向对齐 x / 纵向对齐 y），而非左对齐，（3）横向模式改为泳道面板统一横滚。

**Architecture:** 全部改动收敛在 `src/views/TimelineView.vue`：现有 `refreshConnectors()`（SVG 覆盖层，内容坐标量测）扩展为同时产出 fork 曲线（虚线，现状保留）、背骨间隙段（实线，泳道色）、每线首卡偏移（`padding-left`/`padding-top` 内联样式）；CSS 改 `.timeline.h` 滚动模型；E2E 补偏移与背骨断言；版本 3.1.0。

**Tech Stack:** Vue 3 + TS；Vitest 纯函数层不动（无新纯函数）；Playwright E2E。

**Spec:** 2026-08-25 会话内已批准的设计（bounded 路径，无独立 spec 文件；唯一拍板点：统一滚动 = 用户已批准）

## Global Constraints

- 版本：功能 → 次版本 `3.1.0`（本次唯一一次版本变更，T2 统一做）；CHANGELOG 顶部追加（含背骨线/分叉对齐/统一滚动）。
- 颜色纪律：路径颜色一律来自 `lineColor(l.wl.color)`（resolveDataColor），禁止 hex/rgb 字面量；check:tokens 必须过。
- 不新增依赖；路由/存储/schema 零改动。
- `refreshConnectors` 保持内容坐标系（scroll 矫正），覆盖层随滚动不漂移。
- 卡片 DOM 结构/事件/drawer 逻辑零改动；只动渲染与 CSS。
- 门禁：`npm run test`（90/90）→ `npm run coverage`（≥70%）→ `npm run lint`（0 error）→ `npm run check:tokens` → `npm run build` → `npx playwright test` 三浏览器全绿。

---

### Task 1: TimelineView 背骨线 + 分叉偏移 + 统一滚动

**Files:**
- Modify: `src/views/TimelineView.vue`（模板 lanes 区 / refreshConnectors / watch 触发 / scoped CSS）

**Interfaces:**
- Consumes: `lanes` computed（现有）、`lineColor()`、`orientation`
- Produces（T2 消费，名字不得改）:
  - 模板：`<path>` 增加 `class="fork"` 或 `class="backbone"` 区分虚线/实线（fork 保持 `stroke-dasharray: 4 3` 现状；backbone 实线）
  - 模板：`.lane-cards` 增加 `:style="laneOffsetStyle(l.wl.id)"`（h → `{ paddingLeft }`，v → `{ paddingTop }`；无偏移返回 `undefined`）
  - `laneOffsets = ref<Record<string, number>>({})`——IF 线首卡偏移（px）；与 `connectors` 同一 refresh 批次写入
  - CSS：`.timeline.h .lane-cards` 删除 `overflow-x: auto`；`.timeline.h .lane` 与 `.timeline.h .lane-cards` 宽度改 `width: max-content; min-width: 100%`（内容撑开，面板统一横滚）；`.timeline.v` 不动

- [ ] **Step 1: 改模板（lanes 区）**

- 路径循环加 class 区分：

```vue
<path
  v-for="c in connectors"
  :key="c.id"
  :d="c.d"
  :stroke="c.color"
  fill="none"
  :class="c.kind"
/>
```

- `.lane-cards` 加偏移样式绑定：

```vue
<div
  class="lane-cards"
  :style="laneOffsetStyle(l.wl.id)"
>
```

- [ ] **Step 2: 改 refreshConnectors（产出三类数据）**

`Connector` 接口加 `kind: 'fork' | 'backbone'`；计算顺序在现有 fork 循环之后追加：

```ts
// 背骨：同线相邻卡间隙段（各自边缘中点相连）
for (const l of lanes.value) {
  const cards = lanesEl.value.querySelectorAll<HTMLElement>(`[data-lane="${l.wl.id}"] .card:not(.dragging)`)
  if (cards.length < 2) continue
  for (let i = 0; i < cards.length - 1; i++) {
    const a = cards[i].getBoundingClientRect()
    const b = cards[i + 1].getBoundingClientRect()
    const x1 = a.left - originX + a.width
    const y1 = a.top - originY + a.height / 2
    const x2 = b.left - originX
    const y2 = b.top - originY + b.height / 2
    const [x, y, ex, ey] = hMode
      ? [x1, y1, x2, y2]
      : [a.left - originX + a.width / 2, a.top - originY + a.height,  b.left - originX + b.width / 2, b.top - originY]
    out.push({ id: `${l.wl.id}:${i}`, d: `M ${x} ${y} L ${ex} ${ey}`, color: lineColor(l.wl.color), kind: 'backbone' })
  }
}
```

注：h 模式取「卡右缘中点 → 次卡左缘中点」；v 模式取「卡下缘中点 → 次卡上缘中点」；拖拽中的卡排除（`dragState` 与 overlay 并发时避免跳线）。

- 偏移计算（在同一函数内、fork 锚点已量测的基础上）：

```ts
// 分叉相对定位：IF 线首卡 padding = 锚点卡在内容系下的起缘位置
const offsets: Record<string, number> = {}
for (const l of lanes.value) {
  const pid = l.wl.parentWorldlineId
  if (!l.anchorEventId || !pid || !lanesEl.value) continue
  const parentEl = lanesEl.value.querySelector<HTMLElement>(`[data-lane="${pid}"] [data-eid="${l.anchorEventId}"]`)
  if (!parentEl) { offsets[l.wl.id] = 0; continue }
  const pr = parentEl.getBoundingClientRect()
  offsets[l.wl.id] = hMode ? pr.left - originX : pr.top - originY
}
laneOffsets.value = offsets
```

最后统一把现有 fork 路径的 push 补 `kind: 'fork'`。

- [ ] **Step 3: 加 laneOffsetStyle + 空轨保护**

```ts
function laneOffsetStyle(wlId: string): { paddingLeft?: string; paddingTop?: string } | undefined {
  const o = laneOffsets.value[wlId]
  if (!o) return undefined
  return orientation.value === 'h' ? { paddingLeft: `${o}px` } : { paddingTop: `${o}px` }
}
```

注意：`padding` 加在 `.lane-cards` 容器上，空轨 `n-empty` 也被推移——符合"IF 线从锚点位置岔出"的语义（空轨也占位）。若 n-empty 被推走视觉怪异，改为只对含卡片的线生效（`branchEvents(l.wl.id).length > 0` 时才算偏移）——实现时二选一，报告里说明理由。

- [ ] **Step 4: 改 CSS（统一滚动）**

```css
.timeline.h .lane { flex: none; width: max-content; min-width: 100%; }
.timeline.h .lane-cards { display: flex; gap: var(--space-2); padding-bottom: 4px; width: max-content; min-width: 100%; }
```

（删除原 `.timeline.h .lane-cards` 的 `overflow-x: auto`；`.lanes` 保持 `overflow: auto`——整面板统一横滚。`.card` 已有 `flex-shrink: 0`，不会被压缩。）

- [ ] **Step 5: 门禁（局部）**

Run: `npm run test`（90/90 不变）、`npm run build`、`npm run lint`
Expected: 全绿（纯视图改动）

- [ ] **Step 6: 手工验证与提交**

Run: `npm run dev` 验证：背骨线实线串联（横/纵）；IF 线首卡与锚点对齐；孙线对祖父线锚点生效；锚点隐藏/失效回退 0；统一横滚不再每条线独立滚动；废弃线连线变淡；PNG 导出含新连线；拖拽重排后刷新。
然后提交：

```bash
git commit -am "feat(timeline): 泳道背骨线串联 + 分叉相对定位 + 统一横滚"
```

（先 `git add` 具体文件再 commit -m，遵循仓库单文件提交习惯）

---

### Task 2: E2E 断言 + 版本 3.1.0 + 文档 + 全量门禁

**Files:**
- Modify: `e2e/verification.spec.ts`（新增 2 条断言，见下）
- Modify: `package.json` / `package-lock.json`（3.1.0）
- Modify: `CHANGELOG.md`（顶部追加 3.1.0 条目：泳道背骨线、分叉相对定位、统一横滚）
- Modify: `DESIGN.md` §2.4.4（泳道描述补：背骨线串联 + 分叉对齐 + 统一滚动一句）
- Modify: `docs/acceptance/RELEASE.md`（总览/证据表单测行不变；如 E2E 用例数变化则同步）

**Interfaces:**
- Consumes: Task 1 的 `kind` class、`laneOffsetStyle`（inline padding）
- Produces: 可回归的门禁证据

- [ ] **Step 1: E2E 断言（verification.spec.ts 追加/扩展）**

- 背骨：`/#/timeline` 下断言 `.fork-overlay path.backbone` 数量 = 卡片数 ≥2 的泳道数之和（用现有夹具数据推算；若夹具线内卡片 <2 则先造数据——参考现有点位，造两条线各 3 事件的夹具在测试内动态 createEvent）。
- 分叉对齐：取父线锚点卡 `boundingBox().x`、泳道面板 `boundingBox().x + scrollLeft`，求内容 x；断言 IF 线 `.lane-cards` 的 computed `padding-left` 与之相等（±2px 容差）。纵向模式切换后同样断言 `padding-top`（同容差）。
- 统一滚动：断言横向下 `.lane-cards` 的 computed `overflow-x` 非 `auto`（滚动由 `.lanes` 承担）。

- [ ] **Step 2: 版本与文档**

- `package.json`/lock → 3.1.0；CHANGELOG 顶部：「3.1.0（2026-08-25）——新增：时间线泳道背骨线串联（同线节点实线相连）、分叉相对定位（IF 线首卡对齐锚点卡）、横向模式统一横滚」。
- DESIGN.md §2.4.4 泳道条目补一句（背骨实线 + 分叉对齐 + 面板统一横滚）。
- RELEASE.md 若 E2E 用例计数变化则同步数字（当前 15 用例 ×3 = 45，若 Step 1 只扩展既有用例则不变）。

- [ ] **Step 3: 全量门禁**

```bash
npm run test && npm run coverage && npm run lint && npm run check:tokens && npm run build && npx playwright test
```

Expected: test 90/90 · coverage ≥70% · lint 0 error · tokens ✓ · build ✓ · Playwright 三浏览器全绿（新断言含 chromium/firefox/msedge）

- [ ] **Step 4: 提交**

```bash
git commit -am "feat: 3.1.0（泳道背骨线/分叉对齐/统一横滚）+ E2E 断言 + 文档"
```

---

## Self-Review（写完即查）

1. **规格覆盖**：背骨线（T1 模板+refresh+CSS）✓；分叉相对定位（T1 offsets+laneOffsetStyle）✓；统一滚动（T1 CSS）✓；用户拍板点已含 ✓；E2E/版本/文档（T2）✓。
2. **占位符**：无 TBD/TODO；n-empty 偏移二选一已显式标注待实现者定夺并报告。
3. **类型一致**：`Connector.kind`、`laneOffsets: Record<string, number>`、`laneOffsetStyle(wlId)` 在 T1 定义、T2 消费（class `backbone` / inline padding 断言）。
4. **坑预判**：(a) 偏移与 fork 线共用锚点量测，锚点缺失时 offsets 置 0 与现有 `anchorExists` 徽标语义一致；(b) 背骨排除 `.dragging` 卡防止拖拽瞬间跳线；(c) `.card` 已 `flex-shrink: 0`，max-content 撑开无压缩风险；(d) overlay 与 lanes 同为内容坐标系，统一滚动后偏移/背骨/曲线三者随滚动同步不漂移。