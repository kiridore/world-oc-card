// 历法线性换算（DESIGN.md §2.4.3）：绝对纪元 = value × unitYears + offset
import type { Calendar, EventTime, TimelineEvent } from '@/types'

export function toAbsolute(time: EventTime, calendars: Calendar[]): number {
  const cal = calendars.find((c) => c.id === time.calendarId)
  if (!cal) return time.value // 历法失效兜底：按原值参与排序（巡检会报告失效历法）
  return time.value * cal.unitYears + cal.offset
}

export function eventAbs(e: TimelineEvent, calendars: Calendar[]): number | null {
  return e.time ? toAbsolute(e.time, calendars) : null
}

/** 建议展示文本：如 "第三纪元 217 年" */
export function suggestDisplay(time: EventTime, calendars: Calendar[]): string {
  const cal = calendars.find((c) => c.id === time.calendarId)
  const name = cal?.name ?? '未知历法'
  const unit = cal && cal.unitYears < 1 ? '月' : '年'
  return `${name} ${time.value} ${unit}`
}
