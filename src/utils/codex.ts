// 百科条目辅助逻辑（M3-E1 名称全局唯一 / 按名解析）
import type { CodexEntry, ProjectData } from '@/types'

export function codexNameUnique(data: ProjectData, name: string, excludeId?: string): boolean {
  const n = name.trim()
  return !data.codex.some((c) => c.name === n && c.id !== excludeId)
}

/** 名称全局唯一（附录 A1）→ 按名解析无歧义 */
export function findCodexByName(data: ProjectData, name: string): CodexEntry | undefined {
  const n = name.trim()
  return data.codex.find((c) => c.name === n)
}
