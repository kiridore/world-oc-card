// 时间线 v3 排序纯函数（DESIGN v3 §3）：软解析可解析性 / 插入位 / 重编号 / 徽标 / 展示文本。
// rank 是线内顺序唯一真源；本文件只负责"怎么算"，不负责持久化。
import type { EventTime, TimelineEvent } from '@/types'

/** calendar 模式 年/月/日 全可转数字（空串按 0）→ auto；custom / 非数字 token / null → manual */
export function parseStatus(time: EventTime | null): 'auto' | 'manual' {
  if (!time || time.mode === 'custom') return 'manual'
  const nums = [time.year, time.month, time.day]
  return nums.every((v) => v === '' || Number.isFinite(Number(v))) ? 'auto' : 'manual'
}

export interface TimeBucket { era: string; year: number; month: number; day: number }

export function timeBucket(time: EventTime | null): TimeBucket | null {
  if (!time || time.mode !== 'calendar' || parseStatus(time) !== 'auto') return null
  const n = (v: string) => (v === '' ? 0 : Number(v))
  return { era: time.era, year: n(time.year), month: n(time.month), day: n(time.day) }
}

export function compareBuckets(a: TimeBucket, b: TimeBucket): number {
  if (a.era !== b.era) return a.era < b.era ? -1 : 1
  return a.year - b.year || a.month - b.month || a.day - b.day
}

/** 展示文本：非空字段以空格连接并带单位，如 "第三纪元 217 年 3 月 15 日" */
export function displayTime(time: EventTime | null): string {
  if (!time) return ''
  if (time.mode === 'custom') return time.text
  const parts: string[] = []
  if (time.era) parts.push(time.era)
  if (time.year) parts.push(`${time.year} 年`)
  if (time.month) parts.push(`${time.month} 月`)
  if (time.day) parts.push(`${time.day} 日`)
  return parts.join(' ')
}

/** 找插入位：manual → 末尾；auto → 按桶线性扫描（同桶插在相等之后，稳定） */
export function insertIndex(ordered: TimelineEvent[], time: EventTime): number {
  const bucket = timeBucket(time)
  if (parseStatus(time) === 'manual' || !bucket) return ordered.length
  for (let i = 0; i < ordered.length; i++) {
    const b = timeBucket(ordered[i].time)
    if (b && compareBuckets(bucket, b) < 0) return i
  }
  return ordered.length
}

/** 按新顺序重赋 rank 0..n-1（变异 events）；返回 rank 发生变化的行 */
export function applyOrder(events: TimelineEvent[], newOrderIds: string[]): { changed: { id: string; oldRank: number; newRank: number }[] } {
  const byId = new Map(events.map((e) => [e.id, e]))
  const changed: { id: string; oldRank: number; newRank: number }[] = []
  newOrderIds.forEach((id, newRank) => {
    const e = byId.get(id)
    if (!e) return
    if (e.rank !== newRank) changed.push({ id, oldRank: e.rank, newRank })
    e.rank = newRank
  })
  return { changed }
}

export type EventBadge = 'pending' | 'manual' | 'era-boundary' | null

/** 徽标派生（纯派生，重排后自动重算）：
 *  不可解析且未拖过 → pending；不可解析且拖过 → manual；
 *  可解析但与前一个事件历名不同 → era-boundary（历法转接，请核对）。 */
export function badgeFor(event: TimelineEvent, prev: TimelineEvent | null, _next: TimelineEvent | null): EventBadge {
  if (parseStatus(event.time) !== 'auto') return event.manualPlaced ? 'manual' : 'pending'
  if (!prev) return null
  const a = timeBucket(prev.time)
  const b = timeBucket(event.time)
  if (a && b && a.era !== b.era) return 'era-boundary'
  return null
}
