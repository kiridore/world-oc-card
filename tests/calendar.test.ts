import { describe, it, expect } from 'vitest'
import type { Calendar, EventTime, TimelineEvent } from '../src/types'
import { toAbsolute, eventAbs, suggestDisplay } from '../src/utils/calendar'

const calendars: Calendar[] = [
  { id: 'std', name: '通用纪年', offset: 0, unitYears: 1 },
  { id: 'old', name: '古历', offset: -500, unitYears: 10 },      // 古历 1 单位 = 10 年
  { id: 'moon', name: '月历', offset: 100, unitYears: 1 / 12 },  // 12 单位 = 1 年
]

function ev(time: EventTime): TimelineEvent {
  return { id: `e-${time.calendarId}-${time.value}`, worldlineId: 'w1', time, title: '', description: '', participantIds: [], locationId: null, causalLinks: [], collapsed: false, locked: false }
}

describe('M4-F6 历法线性换算', () => {
  it('多历法换算到统一绝对纪元', () => {
    expect(toAbsolute({ calendarId: 'std', value: 100, display: '' }, calendars)).toBe(100)
    expect(toAbsolute({ calendarId: 'old', value: 60, display: '' }, calendars)).toBe(60 * 10 - 500) // 100
    expect(toAbsolute({ calendarId: 'moon', value: 24, display: '' }, calendars)).toBeCloseTo(100 + 2, 5)
  })

  it('不同历法的等价时间在同一时间轴上排序相邻', () => {
    const a = eventAbs(ev({ calendarId: 'std', value: 100, display: '' }), calendars)!
    const b = eventAbs(ev({ calendarId: 'old', value: 60, display: '' }), calendars)!
    expect(Math.abs(a - b)).toBeLessThan(1e-9)
  })

  it('历法失效时按原值兜底（巡检另行报告）', () => {
    expect(toAbsolute({ calendarId: 'ghost', value: 5, display: '' }, calendars)).toBe(5)
  })

  it('eventAbs 未定时返回 null', () => {
    expect(eventAbs({ ...ev({ calendarId: 'std', value: 1, display: '' }), time: null }, calendars)).toBeNull()
  })

  it('suggestDisplay 按历法单位给出建议文本', () => {
    expect(suggestDisplay({ calendarId: 'std', value: 217, display: '' }, calendars)).toBe('通用纪年 217 年')
    expect(suggestDisplay({ calendarId: 'moon', value: 3, display: '' }, calendars)).toBe('月历 3 月')
  })
})
