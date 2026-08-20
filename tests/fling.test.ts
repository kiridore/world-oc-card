import { describe, it, expect } from 'vitest'
import { flingVelocity, clampFlingV, FLING_MAX_V } from '../src/utils/fling'

describe('惯性滑动速度估算', () => {
  it('由轨迹样本算出 px/ms 速度', () => {
    const now = 1000
    const v = flingVelocity([
      { x: 100, t: now - 100 },
      { x: 160, t: now - 50 },
      { x: 220, t: now },
    ], now)
    expect(v).toBeCloseTo(1.2, 5) // 120px / 100ms
  })

  it('窗口外旧样本不参与（慢速起步 + 快速甩动只取近段）', () => {
    const now = 1000
    const v = flingVelocity([
      { x: 0, t: now - 500 },   // 陈旧
      { x: 200, t: now - 60 },
      { x: 260, t: now },
    ], now)
    expect(v).toBeCloseTo(1.0, 5) // 60px / 60ms，而非 260/500
  })

  it('样本不足或零间隔返回 null（不触发惯性）', () => {
    expect(flingVelocity([{ x: 0, t: 0 }], 100)).toBeNull()
    expect(flingVelocity([], 100)).toBeNull()
    expect(flingVelocity([{ x: 0, t: 50 }, { x: 10, t: 50 }], 100)).toBeNull()
  })

  it('速度上限钳制', () => {
    expect(clampFlingV(99)).toBe(FLING_MAX_V)
    expect(clampFlingV(-99)).toBe(-FLING_MAX_V)
    expect(clampFlingV(1.2)).toBe(1.2)
  })
})
