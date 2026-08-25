import { describe, expect, it } from 'vitest'
import type { EventTime, TimelineEvent } from '@/types'
import { applyOrder, badgeFor, displayTime, insertIndex, parseStatus, timeBucket, compareBuckets } from '@/utils/branchOrder'

const cal = (era = '第三纪元', year = '217'): EventTime => ({ mode: 'calendar', era, year, month: '', day: '' })
const custom = (text: string): EventTime => ({ mode: 'custom', text })
const ev = (id: string, time: EventTime | null, rank = 0, manualPlaced = false): TimelineEvent =>
  ({ id, worldlineId: 'w', time, title: id, description: '', participantIds: [], relatedCodexIds: [], rank, manualPlaced, collapsed: false, locked: false })

describe('parseStatus', () => {
  it('calendar 全数字 → auto（空字段按 0）', () => {
    expect(parseStatus(cal())).toBe('auto')
    expect(parseStatus(cal('星历', '3'))).toBe('auto')
  })
  it('非数字 token / custom / null → manual', () => {
    expect(parseStatus(cal('第三纪元', '第三世'))).toBe('manual')
    expect(parseStatus(custom('黑暗时代'))).toBe('manual')
    expect(parseStatus(null)).toBe('manual')
  })
})

describe('displayTime', () => {
  it('calendar 四段齐全', () => {
    expect(displayTime({ mode: 'calendar', era: '第三纪元', year: '217', month: '3', day: '15' })).toBe('第三纪元 217 年 3 月 15 日')
  })
  it('只填 era', () => expect(displayTime(cal('第三纪元', ''))).toBe('第三纪元'))
  it('custom 原文 / null 空串', () => {
    expect(displayTime(custom('黑暗时代'))).toBe('黑暗时代')
    expect(displayTime(null)).toBe('')
  })
})

describe('timeBucket / compareBuckets', () => {
  it('bucket 空段归 0，同历名按 (y, m, d) 比较；异历名仅非零且反对称', () => {
    expect(timeBucket(cal('第三纪元', '3'))).toEqual({ era: '第三纪元', year: 3, month: 0, day: 0 })
    // 异历名：词法序方向（二=U+4E8C > 三=U+4E09），仅保证非零且反对称——跨历不自动排序（设计规定）
    const a2 = timeBucket(cal('第二纪元', '9'))!
    const a3 = timeBucket(cal('第三纪元', '1'))!
    expect(compareBuckets(a2, a3)).not.toBe(0)
    expect(compareBuckets(a3, a2)).toBe(-compareBuckets(a2, a3))
    expect(compareBuckets(timeBucket(cal('第三纪元', '1'))!, timeBucket(cal('第三纪元', '2'))!)).toBeLessThan(0)
    expect(compareBuckets(timeBucket(cal('第三纪元', '2'))!, timeBucket(cal('第三纪元', '2'))!)).toBe(0)
  })
})

describe('insertIndex', () => {
  it('manual 落末尾；auto 按桶插入；同桶插在相等之后', () => {
    const ordered = [ev('a', cal('第三纪元', '1'), 0), ev('b', cal('第三纪元', '3'), 1)]
    expect(insertIndex(ordered, cal('第三纪元', '2'))).toBe(1)
    expect(insertIndex(ordered, cal('第三纪元', '3'))).toBe(2) // 同桶置后
    expect(insertIndex(ordered, custom('黑暗时代'))).toBe(2)    // manual 末尾
    expect(insertIndex([], cal())).toBe(0)
  })
})

describe('applyOrder', () => {
  it('按新顺序重赋 rank 并报告变化', () => {
    const es = [ev('a', cal(), 0), ev('b', cal(), 1), ev('c', cal(), 2)]
    const { changed } = applyOrder(es, ['c', 'a', 'b'])
    // applyOrder 只重赋 rank，不重排数组；按 rank 排序即新序
    expect([...es].sort((x, y) => x.rank - y.rank).map((e) => e.id)).toEqual(['c', 'a', 'b'])
    expect(changed.map((c) => [c.id, c.oldRank, c.newRank])).toEqual([['c', 2, 0], ['a', 0, 1], ['b', 1, 2]])
  })
})

describe('badgeFor', () => {
  it('不可解析未拖 → pending；拖过 → manual', () => {
    expect(badgeFor(ev('a', custom('黑暗时代')), null, null)).toBe('pending')
    expect(badgeFor(ev('a', custom('黑暗时代'), 0, true), null, null)).toBe('manual')
  })
  it('历名切换边界 → era-boundary（可解析且与前一个历名不同）', () => {
    expect(badgeFor(ev('b', cal('第四纪元', '1'), 1), ev('a', cal('第三纪元', '9'), 0), null)).toBe('era-boundary')
    expect(badgeFor(ev('b', cal('第三纪元', '1'), 1), ev('a', cal('第三纪元', '9'), 0), null)).toBeNull()
  })
})
