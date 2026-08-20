// 惯性滑动（fling）：由指针轨迹样本估算松手瞬间的速度（px/ms），供 rAF 衰减滑行使用。

export interface FlingSample { x: number; t: number }

/** 取最近 windowMs 内的样本估算速度；样本不足/时间跨度为零返回 null（不触发惯性）。
 *  prefers-reduced-motion 场景由调用方自行跳过。 */
export function flingVelocity(samples: FlingSample[], now: number, windowMs = 120): number | null {
  const recent = samples.filter((s) => now - s.t <= windowMs)
  if (recent.length < 2) return null
  const first = recent[0]
  const last = recent[recent.length - 1]
  const dt = last.t - first.t
  if (dt <= 0) return null
  return (last.x - first.x) / dt
}

/** 速度上限与衰减参数：τ=180ms 时滑行距离 ≈ v×τ，2.5px/ms 封顶约 450px——"滑一小段" */
export const FLING_MAX_V = 2.5
export const FLING_TAU = 180
export const FLING_STOP_V = 0.02

export function clampFlingV(v: number): number {
  return Math.max(-FLING_MAX_V, Math.min(FLING_MAX_V, v))
}
