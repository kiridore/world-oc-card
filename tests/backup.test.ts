import { describe, it, expect } from 'vitest'
import { backupDue, DEFAULT_BACKUP_DAYS } from '../src/utils/backup'

const T0 = '2026-08-01T00:00:00Z'
const day = (n: number) => new Date(Date.parse(T0) + n * 86_400_000).toISOString()

describe('v2.4-F2 backupDue 边界', () => {
  it('从未备份 → 提醒', () => {
    expect(backupDue(null, T0, 7)).toBe(true)
  })
  it('距上次 N 天整（=阈值）→ 触发；少一秒 → 不触发', () => {
    expect(backupDue(T0, day(7), 7)).toBe(true)
    expect(backupDue(T0, day(6), 7)).toBe(false)
    expect(backupDue(T0, new Date(Date.parse(day(7)) - 1000).toISOString(), 7)).toBe(false)
  })
  it('阈值 0 / 负数 → 恒提醒（关闭无意义，视为总是）', () => {
    expect(backupDue(T0, day(1), 0)).toBe(true)
    expect(backupDue(T0, day(1), -1)).toBe(true)
  })
  it('戳损坏（非法 ISO）→ 提醒（宁误报不漏报）', () => {
    expect(backupDue('not-a-date', T0, 7)).toBe(true)
  })
  it('默认阈值 7 天', () => {
    expect(DEFAULT_BACKUP_DAYS).toBe(7)
  })
})
