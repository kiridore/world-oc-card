import type { EntityRef } from '@/storage/repository'
import type { WocDB } from '@/storage/db'

export interface DirtyTrackerOptions {
  delay?: number
  onFlush: (refs: EntityRef[]) => Promise<void> | void
}

/** 防抖 + 脏实体集合（DESIGN.md §3.2）：
 *  - mark() 去重登记；延迟到期后一次性 flush；
 *  - flushNow() 供 visibilitychange / beforeunload / Ctrl+S 立即落盘（G4）。 */
export class DirtyTracker {
  private dirty = new Map<string, EntityRef>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private flushing = false
  readonly delay: number
  private onFlush: (refs: EntityRef[]) => Promise<void> | void

  constructor(opts: DirtyTrackerOptions) {
    this.delay = opts.delay ?? 500
    this.onFlush = opts.onFlush
  }

  get size(): number { return this.dirty.size }

  mark(ref: EntityRef): void {
    this.dirty.set(`${ref.kind}:${ref.id ?? ''}`, ref)
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => { void this.flush() }, this.delay)
  }

  async flush(): Promise<void> {
    if (this.flushing || this.dirty.size === 0) return
    this.flushing = true
    const refs = [...this.dirty.values()]
    this.dirty.clear()
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    try {
      await this.onFlush(refs)
    } finally {
      this.flushing = false
    }
  }

  /** 删除实体：立即从脏集合移除（避免 flush 写回已删除行） */
  unmark(kind: EntityRef['kind'], id?: string): void {
    this.dirty.delete(`${kind}:${id ?? ''}`)
  }

  clear(): void {
    this.dirty.clear()
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
  }
}

/** dexie 写钩子计数器：验收 M1-F4 用（断言只写脏表） */
export function attachWriteCounters(db: WocDB) {
  const counts = { characters: 0, codex: 0, events: 0, settings: 0, relations: 0, templates: 0, projects: 0, assets: 0 } as Record<string, number>
  for (const t of Object.keys(counts)) {
    const table = (db as unknown as Record<string, { hook: (event: string, fn: () => void) => void }>)[t]
    if (!table?.hook) continue
    table.hook('creating', () => { counts[t]++ })
    table.hook('updating', () => { counts[t]++; return undefined })
  }
  return {
    counts,
    reset: () => { for (const k of Object.keys(counts)) counts[k] = 0 },
  }
}
