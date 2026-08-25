# 角色列表「x块」文案优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 角色列表的「N 块」计数含义不明（块 = 自定义字段块，用户无法理解），改为明确文案并补提示性 tooltip。

**Architecture:** 单点文案修改。当前 `src/views/CharactersView.vue:53` `{{ c.fieldBlocks.length }} 块` ——「块」是内部术语（字段块 FieldBlock，DESIGN §2.1）。方案：文案改为「N 个字段块」，并为 `char-count` 加 `title` 提示「字段块数量（角色卡上的自定义内容块）」。

**Tech Stack:** Vue 3；零依赖；E2E 无此断言需调整（grep 确认后同步搜索文案的用例）。

## Global Constraints

- 版本 3.1.6（修复）；CHANGELOG 顶部追加。
- 不改结构/样式/数据；仅文案 + tooltip。
- `npm run build`/`lint`/`check:tokens` 绿；Playwright 54/54 不变。

---

### Task 1（唯一任务）：文案与提示

**Files:**
- Modify: `src/views/CharactersView.vue`（行 53）
- Modify: `CHANGELOG.md`、`package.json`/`package-lock.json`（3.1.6）

- [ ] **Step 1: 改文案**

```vue
<span
  class="char-count"
  title="字段块数量（角色卡上的自定义内容块）"
>{{ c.fieldBlocks.length }} 个字段块</span>
```

- [ ] **Step 2: 复核引用**

Run: `rg -n "块</span>|块\b" src e2e --type-add 'vue:*.vue' -t vue -t ts`——确认无其他「N 块」式文案、E2E 无按旧文案断言（若有则同步更新）。

- [ ] **Step 3: 门禁**

```bash
npm run build && npm run lint && npm run test && npx playwright test
```
Expected: 全绿；用例数不变（54）。

- [ ] **Step 4: 版本、CHANGELOG、提交**

- package.json/lock → 3.1.6
- CHANGELOG：「3.1.6（2026-08-25）——修复：角色列表计数文案「N 块」改为「N 个字段块」并加含义提示」
- 提交：`git commit -am "fix(characters): 角色列表字段块计数文案明确化（v3.1.6）"`

---

## Self-Review

1. **规格覆盖**：文案 + tooltip + 引用复核 + 版本——单点任务。
2. **坑预判**：`char-count` 在导出/快照等是否复用同一文案（rg 复核）；列表宽窄不影响（11px 小字，文案 +3 字可容纳）。