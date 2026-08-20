// 时间轴视域缩放限制（DESIGN 需求：限制最大放大 / 最小缩小）
// 视域以绝对纪元跨度（end - start）表达：跨度越小放大越深。
export const MIN_SPAN = 0.01        // 最大放大：0.01 绝对纪元单位（月历下仍可分辨分钟级刻度）
export const MAX_SPAN = 1_000_000   // 最小缩小：百万年量级，覆盖绝大多数世界观时间跨度

/** 把 [start, end] 视域钳制到缩放极限内；越限时以中点为中心收缩/扩展到边界，返回原对象（区间内）不变 */
export function clampSpan(start: number, end: number): { start: number; end: number } {
  const span = end - start
  const mid = (start + end) / 2
  if (span < MIN_SPAN) return { start: mid - MIN_SPAN / 2, end: mid + MIN_SPAN / 2 }
  if (span > MAX_SPAN) return { start: mid - MAX_SPAN / 2, end: mid + MAX_SPAN / 2 }
  return { start, end }
}
