// 世界线 fork 继承语义（DESIGN.md §2.4.1 / M4-F3/F4/E2/D1）：
// 子线可见事件 = 本线自有事件 + 各祖先线上（按各层 fork 点边界 ≤ fork 事件 rank）的定时事件。
// v3：边界以 rank 表达（rank 是线内顺序唯一真源）；fork 点事件缺失/无时间 → 该层边界失效，
// 视为继承该祖先线全部定时事件（标记 forkBroken）。
import type { ProjectData, TimelineEvent } from '@/types'

export interface WorldlineView {
  worldlineId: string
  own: TimelineEvent[]          // 本线自有（定时，按 rank 升序）
  inherited: TimelineEvent[]    // 继承自祖先（按 rank 升序）
  forkBroken: boolean           // 分叉点失效
}

export function worldlineDepth(data: ProjectData, worldlineId: string): number {
  let depth = 0
  let cur = data.settings.worldlines.find((w) => w.id === worldlineId)
  while (cur?.parentWorldlineId) {
    depth += 1
    cur = data.settings.worldlines.find((w) => w.id === cur!.parentWorldlineId)
  }
  return depth
}

export function visibleEventsFor(data: ProjectData, worldlineId: string): WorldlineView {
  const { worldlines } = data.settings
  const own: TimelineEvent[] = []
  for (const e of data.events) {
    if (e.worldlineId === worldlineId && e.time !== null) own.push(e)
  }
  const inherited: TimelineEvent[] = []
  const inheritedIds = new Set<string>()
  let forkBroken = false
  let cur = worldlines.find((w) => w.id === worldlineId)

  while (cur?.parentWorldlineId) {
    const parent = worldlines.find((w) => w.id === cur!.parentWorldlineId)
    if (!parent) { forkBroken = true; break }
    let boundary: number | null = null
    if (cur.forkPointEventId) {
      const forkEvent = data.events.find((e) => e.id === cur!.forkPointEventId)
      if (!forkEvent || forkEvent.time === null) forkBroken = true // 分叉点事件缺失或无时间 → 失效
      else boundary = forkEvent.rank
    }
    // boundary === null（含失效）→ 继承该祖先线全部定时事件
    for (const e of data.events) {
      if (e.worldlineId !== parent.id || e.time === null) continue
      if (boundary === null || e.rank <= boundary) {
        if (!inheritedIds.has(e.id)) { inheritedIds.add(e.id); inherited.push(e) }
      }
    }
    cur = parent
  }

  const byRank = (a: TimelineEvent, b: TimelineEvent) => a.rank - b.rank
  return { worldlineId, own: [...own].sort(byRank), inherited: [...inherited].sort(byRank), forkBroken }
}

/** 全部世界线的视图（按 order 排序；用于时间轴轨道） */
export function allWorldlineViews(data: ProjectData): WorldlineView[] {
  return [...data.settings.worldlines]
    .sort((a, b) => a.order - b.order)
    .map((w) => visibleEventsFor(data, w.id))
}
