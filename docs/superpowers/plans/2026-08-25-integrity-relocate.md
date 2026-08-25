# 巡检按钮降位 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 完整性巡检入口从侧栏底部（显眼位）移除，转移到「导出与分享」页作为工具区按钮——功能不丢、感知降级。

**Architecture:** `App.vue` 侧栏 footer 删除巡检按钮（连同 `ShieldCheck` import 与 `showIntegrity` 状态、`IntegrityDrawer` 挂载点），`ExportView.vue` 新增「工具」卡片（ShieldCheck + 巡检按钮）并挂载 `IntegrityDrawer`。无数据/路由变更。

**Tech Stack:** Vue 3 + TS + Naive UI；E2E 断言按钮位置迁移。

## Global Constraints

- 版本 3.1.5（修复/体验）；CHANGELOG 顶部追加。
- 巡检功能（M7-F1）不可丢——只移位置。
- 不新增依赖；颜色走现有 class；`npm run build`/`lint`/`check:tokens` 绿；Playwright 54/54（用例数不变则不变）。
- 提交信息（仓库惯例）：`fix(timeline): …` 风格统一为实际变更域。

---

### Task 1（唯一任务）：巡检入口从侧栏移至导出页

**Files:**
- Modify: `src/App.vue`（删按钮/import/状态/抽屉挂载）
- Modify: `src/views/ExportView.vue`（加工具卡片 + 抽屉）
- Modify: `e2e/verification.spec.ts`（巡检相关断言改导引，若有）
- Modify: `CHANGELOG.md`、`package.json`/`package-lock.json`（3.1.5）

- [ ] **Step 1: App.vue 移除**

- 删 footer 中巡检按钮块（`<button class="foot-btn" title="完整性巡检…">…<ShieldCheck/> 巡检</button>`）。
- 删 `ShieldCheck` 于 lucide import（保留 `Keyboard`）。
- 删 `import IntegrityDrawer`、`const showIntegrity = ref(false)`、模板 `<IntegrityDrawer v-model:show="showIntegrity" />`。

- [ ] **Step 2: ExportView.vue 新增工具卡片**

- import 补：`NButton` 已有；`ShieldCheck`（lucide）、`IntegrityDrawer`、`ref`。
- 模板在「分享快照」卡片后追加：

```vue
<section class="panel card">
  <div class="card-head">
    <h3><ShieldCheck :size="16" /> 完整性巡检</h3>
    <n-button
      size="small"
      @click="showIntegrity = true"
    >
      打开巡检
    </n-button>
  </div>
  <p class="desc">
    扫描全部失效引用与孤儿资产（事件/关系/世界线/字段链接），定位损坏数据来源。
  </p>
</section>
```

- 文件末尾（`</template>` 前）挂载：

```vue
<IntegrityDrawer v-model:show="showIntegrity" />
```

- script 补：`const showIntegrity = ref(false)`。

- [ ] **Step 3: E2E 断言迁移**

- 检查现有断言是否引用侧栏「巡检」按钮（rg `巡检` e2e/）——若 verification/G2 主流程走查依赖它，改为在 `/#/export` 下断言按钮可见并打开抽屉。
- 无既有断言则新增最小断言行：`/#/export` 下 `getByRole('button', { name: /打开巡检/ })` 可见可点、抽屉标题含「完整性巡检」。

- [ ] **Step 4: 门禁**

```bash
npm run build && npm run lint && npm run check:tokens && npm run test && npx playwright test
```
Expected: 全绿；Playwright 用例数 54 或 57（取决于 Step 3 是否新增用例）。

- [ ] **Step 5: 版本、CHANGELOG、提交**

- package.json/lock → 3.1.5
- CHANGELOG：「3.1.5（2026-08-25）——调整：完整性巡检入口从侧栏移至导出与分享页工具区（显眼度降级，功能保留）」
- 提交：`git commit -am "move: 巡检入口移至导出页工具区（v3.1.5）"`

---

## Self-Review

1. **规格覆盖**：删侧栏入口（App.vue 四处：模板按钮/import/状态/抽屉）+ 导出页新入口 + E2E + 版本——全在单任务。
2. **类型一致**：`showIntegrity` 仅存在于 ExportView；App.vue 无残留引用（rg 复核 `showIntegrity|ShieldCheck` src/App.vue 应为空）。
3. **坑预判**：(a) 快捷键帮助面板可能提到巡检热键——核实 useShortcuts 无巡检绑定（已确认：仅 showHelp）；(b) G2 主流程走查若曾点击巡检，迁移断言需同步。