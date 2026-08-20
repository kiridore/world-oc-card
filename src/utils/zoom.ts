// 时间轴视域缩放限制（视域为事件序位跨度：rank 空间，end - start）
// 序位轴只表达先后顺序（等距），不按时间偏移比例定位。
export const MIN_SPAN = 0.05          // 最大放大：0.05 个序位（两相邻事件可拉开 20 屏）
export const DEFAULT_MAX_SPAN = 1_000_000

/** 把 [start, end] 视域钳制到缩放极限内；越限时以中点为中心收缩/扩展到边界 */
export function clampSpan(start: number, end: number, maxSpan: number = DEFAULT_MAX_SPAN): { start: number; end: number } {
  const span = end - start
  const mid = (start + end) / 2
  if (span < MIN_SPAN) return { start: mid - MIN_SPAN / 2, end: mid + MIN_SPAN / 2 }
  if (span > maxSpan) return { start: mid - maxSpan / 2, end: mid + maxSpan / 2 }
  return { start, end }
}
