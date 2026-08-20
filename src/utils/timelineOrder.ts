// 事件序位轴（DESIGN.md §2.4.4）：时间轴 x 坐标只表达事件的**先后顺序**——
// 全局（跨世界线）按绝对纪元排序后等距编序，不按时间偏移量比例定位。
// 同刻（相同绝对纪元）事件共享同一序位，与"折叠聚簇"语义对齐。
import type { Calendar, TimelineEvent } from '@/types'
import { eventAbs } from './calendar'

export interface RankIndex {
  /** 全局按序的定时事件（升序） */
  ordered: TimelineEvent[]
  /** 事件 id → 序位（dense rank：同刻共享） */
  rank: Map<string, number>
  /** 序位总数（去重后） */
  size: number
}

export function rankEvents(events: TimelineEvent[], calendars: Calendar[]): RankIndex {
  const timed = events.filter((e) => e.time !== null)
  const sorted = [...timed].sort((a, b) => (eventAbs(a, calendars) ?? 0) - (eventAbs(b, calendars) ?? 0))
  const rank = new Map<string, number>()
  let r = -1
  let prevAbs: number | null = null
  for (const e of sorted) {
    const a = eventAbs(e, calendars) ?? 0
    if (prevAbs === null || a !== prevAbs) { r += 1; prevAbs = a }
    rank.set(e.id, r)
  }
  return { ordered: sorted, rank, size: r + 1 }
}

/** 轨道空白处插入：取左右邻事件绝对纪元的中点（同时刻则偏移一个历法单位），
 *  保证新事件的先后位置落在点击处两侧事件之间；无邻事件时取 0。 */
export function suggestInsertAbs(prevAbs: number | null, nextAbs: number | null, unitYears: number): number {
  const round6 = (v: number) => Math.round(v * 1e6) / 1e6
  if (prevAbs !== null && nextAbs !== null) {
    const mid = (prevAbs + nextAbs) / 2
    return mid === prevAbs ? round6(prevAbs + unitYears / 2) : round6(mid)
  }
  if (prevAbs !== null) return round6(prevAbs + unitYears)
  if (nextAbs !== null) return round6(nextAbs - unitYears)
  return 0
}
