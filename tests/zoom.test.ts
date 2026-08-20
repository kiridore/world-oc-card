import { describe, it, expect } from 'vitest'
import { clampSpan, MIN_SPAN } from '../src/utils/zoom'
import { rankEvents, suggestInsertAbs } from '../src/utils/timelineOrder'
import type { Calendar, TimelineEvent } from '../src/types'

const calendars: Calendar[] = [
  { id: 'std', name: '通用纪年', offset: 0, unitYears: 1 },
  { id: 'old', name: '古历', offset: -500, unitYears: 10 },
]

function ev(id: string, calId: string, value: number): TimelineEvent {
  return {
    id, worldlineId: 'w1', time: { calendarId: calId, value, display: '' },
    title: id, description: '', participantIds: [], locationId: null,
    causalLinks: [], collapsed: false, locked: false,
  }
}

describe('缩放限制（序位空间）', () => {
  it('区间内不变', () => {
    expect(clampSpan(-1, 10)).toEqual({ start: -1, end: 10 })
  })

  it('放大钳到 MIN_SPAN，中点保持', () => {
    const r = clampSpan(5, 5.000001, 100)
    expect(r.end - r.start).toBeCloseTo(MIN_SPAN, 10)
    expect((r.start + r.end) / 2).toBeCloseTo(5.0000005, 9)
  })

  it('缩小钳到动态 maxSpan（序位总数相关）', () => {
    const r = clampSpan(0, 5000, 60)
    expect(r.end - r.start).toBeCloseTo(60, 8)
    expect((r.start + r.end) / 2).toBeCloseTo(2500, 6)
  })
})

describe('事件序位轴（只表达先后，等距排布）', () => {
  it('按绝对纪元全局排序并 dense 编序：同刻共享序位', () => {
    // 古历 60 = 绝对 100，与通用纪年 100 同时
    const idx = rankEvents([
      ev('a', 'std', 300),
      ev('b', 'std', 100),
      ev('c', 'old', 60),   // abs 100，与 b 同刻
      ev('d', 'std', 5),
    ], calendars)
    expect(idx.ordered.map((e) => e.id)).toEqual(['d', 'b', 'c', 'a'])
    expect(idx.rank.get('d')).toBe(0)
    expect(idx.rank.get('b')).toBe(1)
    expect(idx.rank.get('c')).toBe(1) // 同刻共享
    expect(idx.rank.get('a')).toBe(2)
    expect(idx.size).toBe(3)
  })

  it('未定时事件不参与序位', () => {
    const idx = rankEvents([{ ...ev('u', 'std', 1), time: null }, ev('t', 'std', 1)], calendars)
    expect(idx.size).toBe(1)
    expect(idx.rank.has('u')).toBe(false)
  })

  it('时间跨度不影响间距：100 年与 1 年间隔的事件序位均相邻为 1', () => {
    const idx = rankEvents([ev('a', 'std', 0), ev('b', 'std', 1), ev('c', 'std', 10000)], calendars)
    expect(idx.rank.get('b')! - idx.rank.get('a')!).toBe(1)
    expect(idx.rank.get('c')! - idx.rank.get('b')!).toBe(1)
  })
})

describe('轨道空白插入取中值', () => {
  it('两侧有事件取中点', () => {
    expect(suggestInsertAbs(100, 200, 1)).toBe(150)
  })

  it('同刻邻接时偏移半个单位避免并列', () => {
    expect(suggestInsertAbs(100, 100, 1)).toBe(100.5)
  })

  it('仅左侧有事件 → 右移一个单位；仅右侧 → 左移', () => {
    expect(suggestInsertAbs(100, null, 1)).toBe(101)
    expect(suggestInsertAbs(null, 100, 1)).toBe(99)
  })

  it('无邻事件 → 0', () => {
    expect(suggestInsertAbs(null, null, 1)).toBe(0)
  })

  it('月历半单位保留精度', () => {
    expect(suggestInsertAbs(0, 0, 1 / 12)).toBeCloseTo(1 / 24, 6)
  })
})
