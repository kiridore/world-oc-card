// 跨视图共享 G6 实例（导出中心需要 toDataURL）
import type { Graph } from '@antv/g6'

let current: Graph | null = null

export function setGraphInstance(g: Graph | null): void {
  current = g
}

export function getGraphInstance(): Graph | null {
  return current
}
