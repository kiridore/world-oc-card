import { describe, it, expect } from 'vitest'
import { clampSpan, MIN_SPAN } from '../src/utils/zoom'

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
