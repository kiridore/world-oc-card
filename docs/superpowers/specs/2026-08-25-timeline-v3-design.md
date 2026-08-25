# 时间线 v3 —— 字符串纪年 × 卡片化分支泳道 · 设计文档

> 日期：2026-08-25　状态：已获用户批准（2026-08-25）
> 前置决策（brainstorming 问答结论）：软解析排序 + 手动兜底（C）；世界线/分叉全保留只换排序轴（A）；历名为纯自由字符串、跨历名手动（A）；按线独立排序、泳道展示（A）；参与者合并一列；locationId 改通用百科关联；持续时间砍掉；因果链整体移除；CanvasView 移除；未定时草稿保留（草稿箱，双向流转）；横/纵布局可切换（PC 默认横向、移动端默认纵向）；草稿箱位于页面顶部。

## 1. 目标与范围

时间线模块从"数值绝对纪元排序"重构为"**字符串纪年 × 显式先后序**"的卡片化模型：

- 事件时间为双模式字符串（纪年法四段式 / 自定义自由文本），底层无任何数值纪元换算。
- 工具维护事件间的先后关系（世界线内 rank），软解析只负责自动定位，不可解析处标注 + 手动排序。
- 世界线 / fork / 废弃模型**全保留**，仅排序轴与渲染方式更换（按线独立排序，泳道式分支展示）。
- 可选字段收敛：参与人/势力合并列表、通用百科关联；持续时间、因果链、自由画布全部移除。

不在范围：V2 后端（RemoteRepository）、跨线合并计算、多历法登记配置、导出 PNG 的泳道样式重做（沿用现状能力即可）。

## 2. 数据模型（schemaVersion 2 → 3）

```ts
type EventTime =
  | { mode: 'calendar'; era: string; year: string; month: string; day: string }
  | { mode: 'custom'; text: string }

interface TimelineEvent {
  id: UUID
  worldlineId: UUID | null      // null = 草稿（未定时，不进任何世界线）
  time: EventTime | null        // null = 未定时草稿
  title: string
  description: string
  participantIds: UUID[]        // 角色 + 百科势力条目，合并一列（UI 按实体类型打小标）
  relatedCodexIds: UUID[]       // 通用百科关联（任意类型），取代 locationId
  rank: number                  // 世界线内排序位（0..n-1，线内顺序唯一真源）
  collapsed: boolean
  locked: boolean
}
```

**删除的字段/实体**：

| 删除项 | 去处 |
|---|---|
| `Calendar` 实体 + `settings.calendars` | 迁移后实体本身删除（历名成为事件上的自由字符串） |
| `EventTime { calendarId, value: number, display }` | 双模式字符串取代 |
| `causalLinks` | 直接丢弃（CHANGELOG 注明数据丢失） |
| `locationId` | 迁移并入 `relatedCodexIds` |
| `canvasPos` | CanvasView 移除后无用，删除 |

**时间字段规则**：calendar 模式四个字段均为自由字符串，可留空但至少填一个；month/day 留空合法。custom 模式单自由字符串，非空。

## 3. 排序机制（软解析 + 手动修正）

### 3.1 rank 为唯一真源

- 每条世界线内事件按 `rank`（0..n-1 整数）排序；rank 即工具维护的"先后关系"，插入/拖拽/删除时重编号（线内百级事件，O(n) 无压力）。
- 软解析只影响**定位**（补全时间时计算插入位），不持久化解析结果。

### 3.2 可解析性判定

- **可解析**：calendar 模式且 `year/month/day` 全部可转数字（空字段按 0 参与比较）。比较元组 `(era, year, month, day)`，同历名事件间可自动排序。
- **不可解析**：custom 模式（恒不可解析）；calendar 模式 `year/month/day` 含非数字 token（如"第三世"）。
- 可解析事件补全时间 → 按元组找到线内插入位自动入列；不可解析事件 → 追加线尾，卡片带 **"待排序"** 徽标；用户拖拽放置后徽标转为琥珀色"手动序"（仍显示，表示此位系人工确认）。
- **跨历名**：分支内出现 ≥2 个不同历名时，历名切换处的相邻事件带 **"历法转接，请核对"** 徽标（纯派生，重排后自动重算）。这是对"跨历名必标注、靠手动修正"承诺的落地。
- 同刻并列（元组相等）：按当前 rank 稳定相邻，不加徽标，展示上并排靠拢。

### 3.3 displayTime 派生

纯函数：calendar 模式 → 按非空字段拼 `"{era}{year} 年{month} 月{day} 日"`（缺字段跳过）；custom 模式 → 原文。用于卡片、分享快照、Markdown 导出。

## 4. 展示与交互（TimelineView 重写）

### 4.1 泳道渲染（横/纵双模式）

- 同一 DOM 结构（lane 容器 + 卡片流），**CSS 控制方向**：横向 = lane 为横向泳道、卡片从左向右流（PC 默认）；纵向 = lane 为纵向列、卡片从上向下流（移动端默认，类似 `git log --graph`），移动端为窄屏断点(<768px)默认值。
- 用户可手动切换横/纵（工具栏按钮），覆盖默认值，偏好存 localStorage（非项目数据）。
- fork 分叉曲线由少量 SVG 覆盖层绘制，方向感知（横/纵两套坐标逻辑，共用同一连线数据：锚点事件 → IF 线首事件）。
- 废弃线整体变暗；世界线显隐 / 重命名 / 废弃 / 删除 / 从此处创建 IF 线等操作沿用现状交互。
- 旧数值轴专属交互（缩放、平移、惯性、聚簇折叠、序位网格）随旧渲染整体废弃。
- 线内拖拽排序：原生 HTML5 DnD，无新依赖。

### 4.2 草稿箱（页面顶部固定区）

- 列出所有 `time == null` 的草稿卡片（可编辑标题/描述/参与者/百科关联）。
- 补全时间：选目标世界线（下拉）→ 填时间 → 自动入列（可解析按元组定位，不可解析落线尾待排序）。
- 已定时卡片可"放回草稿箱"：清 `time` + `worldlineId = null`，从线内移除。
- 移除现行"全部事件列表"侧栏（泳道全量可见 + 草稿箱覆盖无时间事件）。

### 4.3 卡片

标题 + `displayTime` 时间文本 + 参与者小标（角色/势力按实体类型区分）+ 百科关联图标 + 排序徽标；点击开编辑抽屉（EventDrawer 重写时间编辑区：双模式切换、四段式输入、自定义文本；世界线选择与"放回草稿箱"入口）。

## 5. 删除面

- `CanvasView.vue`、路由 `/timeline/canvas`、导航项；**@vue-flow 相关依赖整体移除**。
- `utils/calendar.ts`、`utils/timelineOrder.ts` → 新 `utils/branchOrder.ts`（可解析性判定、插入位计算、重编号、徽标派生、displayTime，纯函数）。
- 现行"全部事件列表"侧栏。

## 6. 迁移（v2 → v3）

migration.ts 按 schemaVersion 步进到 3：

1. 旧 `time`：null → 草稿（worldlineId 置 null）；非 null → 年单位历法（unitYears ≥ 1）转 calendar 模式（era=历法名，year=String(value)）；月单位历法（unitYears < 1）转 custom 模式（text=旧 display，保真）。
2. `locationId` 非空 → append 进 `relatedCodexIds`。
3. `causalLinks`、`canvasPos` 丢弃。
4. `rank` 推导：在删历法前用旧绝对纪元排序，同刻按原存储顺序，逐线赋 0..n-1。
5. `settings.calendars` 删除。

## 7. 版本与文档

- package.json → `3.0.0`（破坏性数据格式），CHANGELOG 追加条目（含 causalLinks 丢弃声明）。
- DESIGN.md §2.4 / §3 / §1.1/§4（路由表）回写；DEV_PLAN.md 相关 AC 更新；docs/acceptance/RELEASE.md 归档证据更新。

## 8. 影响面清单

| 面 | 内容 |
|---|---|
| types/schemas | EventTime 双模式、relatedCodexIds、rank、worldlineId 可空、删 Calendar/causalLinks/locationId/canvasPos |
| storage | db/zip 事件 JSON 字段变更、migration 步进 3 |
| stores/project | 事件动作：创建/补全时间/放回草稿箱/拖拽重排（重编号）/双模式时间编辑 |
| utils | 删 calendar.ts、timelineOrder.ts；新 branchOrder.ts；integrity 改（participantIds 校验角色+势力、relatedCodexIds 校验、删 causalLinks/locationId/calendar 检查）；mdExport/snapshot 用 displayTime |
| views/components | TimelineView 重写；EventDrawer 时间编辑区重写；删 CanvasView；router/导航/HomeView 统计 |
| 测试 | calendar.test.ts → branchOrder.test.ts 重写（软解析/插入位/重编号/徽标/displayTime，覆盖 ≥70% 门槛）；schemas/storage/integrity/export/fork 更新；Playwright 时间线 E2E 重写；迁移测试 |
| 依赖 | 移除 @vue-flow/* |

## 9. 验收要点（映射 DEV_PLAN AC 风格）

- 数据：双模式时间全字符串落盘；跨 zip 往返；v2 项目导入迁移正确（含月历法保真、locationId 并入、rank 推导、草稿 worldlineId 置空）；causalLinks 丢弃有日志声明。
- 排序：可解析自动入列；不可解析落线尾带徽标；拖拽重排后徽标转"手动序"；跨历名切换处有核对徽标；同刻稳定相邻。
- 展示：横/纵可切换、默认值遵循 PC/移动；fork 连线正确；废弃线变暗；草稿箱置顶且双向流转。
- 纪律：颜色走 token；不加 base64 图片；路由 hash + base './'；strict schema；无新依赖。