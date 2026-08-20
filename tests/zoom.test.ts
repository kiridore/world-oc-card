import { describe, it, expect } from 'vitest'
import { clampSpan, MIN_SPAN, MAX_SPAN } from '../src/utils/zoom'

describe('时间轴缩放限制', () => {
  it('区间内不变', () => {
    expect(clampSpan(0, 100)).toEqual({ start: 0, end: 100 })
    expect(clampSpan(-5, 5)).toEqual({ start: -5, end: 5 })
  })

  it('放大到极限：跨度钳到 MIN_SPAN，中点保持', () => {
    const r = clampSpan(10, 10.0000001)
    expect(r.end - r.start).toBeCloseTo(MIN_SPAN, 10)
    expect((r.start + r.end) / 2).toBeCloseTo(10.00000005, 10)
  })

  it('缩小到极限：跨度钳到 MAX_SPAN，中点保持', () => {
    const r = clampSpan(0, 5_000_000)
    expect(r.end - r.start).toBeCloseTo(MAX_SPAN, 6)
    expect((r.start + r.end) / 2).toBeCloseTo(2_500_000, 6)
  })

  it('边界值恰好合法', () => {
    expect(clampSpan(0, MIN_SPAN).end - clampSpan(0, MIN_SPAN).start).toBeCloseTo(MIN_SPAN, 12)
    expect(clampSpan(0, MAX_SPAN)).toEqual({ start: 0, end: MAX_SPAN })
  })
})
