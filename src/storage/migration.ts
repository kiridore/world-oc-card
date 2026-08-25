// schemaVersion 迁移管道（M1-F6）：按版本逐步升级，v(N) → v(N+1)
import type { ProjectData, Relation, RelationType, TimelineEvent } from '@/types'
import { CURRENT_SCHEMA_VERSION } from '@/types'
import { legacyEventV2Schema } from '@/schemas'
import { uuid } from '@/utils/id'
import { palettePick } from '@/utils/colors'
import type { z } from 'zod'

type LegacyEventV2 = z.infer<typeof legacyEventV2Schema>

interface LegacyCalendar { id: string; name: string; offset: number; unitYears: number }

interface OldRelation {
  id: string; from: string; to: string; type: string; directed: boolean; description: string
}

/** v0 → v1：关系边内联 {type, directed} 迁移为 relationTypes + typeId */
function v0toV1(data: ProjectData, warnings: string[]): ProjectData {
  const old = data.relations as unknown as OldRelation[]
  const needs = old.some((r) => typeof (r as Partial<Relation>).typeId !== 'string')
  if (!needs) return data
  const byKey = new Map<string, string>()
  const relationTypes: RelationType[] = [...data.settings.relationTypes]
  const relations: Relation[] = old.map((r) => {
    if (typeof (r as Partial<Relation>).typeId === 'string') return r as unknown as Relation
    const key = `${r.type}|${r.directed}`
    let id = byKey.get(key)
    if (!id) {
      id = uuid()
      byKey.set(key, id)
      // v0 内联 directed 经 v1 兼容形态（directed 布尔）再由 v1→v2 统一转 arrow
      relationTypes.push({ id, name: r.type, color: palettePick(relationTypes.length), arrow: r.directed ? 'single' : 'none' })
    }
    return { id: r.id, from: r.from, to: r.to, typeId: id, description: r.description ?? '' }
  })
  warnings.push('数据已从 v0 迁移到 v1（关系类型内联 → relationTypes）')
  return { ...data, relations, settings: { ...data.settings, relationTypes } }
}

/** v1 → v2：RelationType.directed 布尔 → arrow 三态（true→single，false→none） */
function v1toV2(data: ProjectData, warnings: string[]): ProjectData {
  const types = data.settings.relationTypes as unknown as Array<RelationType & { directed?: boolean }>
  if (!types.some((t) => typeof t.directed === 'boolean' || t.arrow === undefined)) return data
  const relationTypes: RelationType[] = types.map((t) => {
    if (t.arrow) return { id: t.id, name: t.name, color: t.color, arrow: t.arrow }
    return { id: t.id, name: t.name, color: t.color, arrow: t.directed ? 'single' : 'none' }
  })
  warnings.push('数据已从 v1 迁移到 v2（关系方向 directed 布尔 → arrow 三态）')
  return { ...data, settings: { ...data.settings, relationTypes } }
}

/** v2 → v3：数值纪元时间 → 字符串纪年双模式；locationId 并入 relatedCodexIds；
 *  causalLinks/canvasPos 丢弃；旧草稿置 worldlineId=null；rank 按旧绝对纪元逐线推导。 */
function v2toV3(data: ProjectData, warnings: string[]): ProjectData {
  const settings = data.settings as unknown as { calendars?: LegacyCalendar[] }
  // 兼容无历法的存量/测试数据（v3 形状 settings 过迁移管道）：无历法 → era 留空兜底
  const calById = new Map((settings.calendars ?? []).map((c) => [c.id, c]))
  const oldEvents = data.events as unknown as LegacyEventV2[]

  // rank：逐线按旧绝对纪元（value×unitYears+offset）升序；同刻保持原数组顺序
  const rankOf = new Map<string, number>()
  const byLine = new Map<string, LegacyEventV2[]>()
  for (const e of oldEvents) {
    if (!e.time) continue
    if (!byLine.has(e.worldlineId)) byLine.set(e.worldlineId, [])
    byLine.get(e.worldlineId)!.push(e)
  }
  for (const [, evs] of byLine) {
    const abs = (e: LegacyEventV2) => {
      const c = e.time ? calById.get(e.time.calendarId) : undefined
      return e.time ? e.time.value * (c?.unitYears ?? 1) + (c?.offset ?? 0) : 0
    }
    const sorted = [...evs].sort((a, b) => abs(a) - abs(b))
    sorted.forEach((e, i) => rankOf.set(e.id, i))
  }

  const events: TimelineEvent[] = oldEvents.map((e) => {
    let time: TimelineEvent['time'] = null
    if (e.time) {
      const c = calById.get(e.time.calendarId)
      time = c && c.unitYears < 1
        ? { mode: 'custom', text: e.time.display || `${c.name} ${e.time.value} 月` }
        : { mode: 'calendar', era: c?.name ?? '', year: String(e.time.value), month: '', day: '' }
    }
    return {
      id: e.id,
      worldlineId: e.time ? e.worldlineId : null,
      time,
      title: e.title,
      description: e.description,
      participantIds: e.participantIds,
      relatedCodexIds: e.locationId ? [e.locationId] : [],
      rank: e.time ? (rankOf.get(e.id) ?? 0) : 0,
      manualPlaced: false,
      collapsed: e.collapsed,
      locked: e.locked,
    }
  })
  delete (data.settings as unknown as Record<string, unknown>).calendars
  warnings.push('数据已从 v2 迁移到 v3（数值纪年 → 字符串纪年；因果连线 causalLinks 已移除）')
  return { ...data, settings: data.settings, events }
}

const STEPS: Record<number, (d: ProjectData, w: string[]) => ProjectData> = {
  0: v0toV1,
  1: v1toV2,
  2: v2toV3,
}

export function migrateProject(data: ProjectData): { data: ProjectData; warnings: string[] } {
  const warnings: string[] = []
  let cur = data
  let v = cur.meta.schemaVersion
  while (v < CURRENT_SCHEMA_VERSION) {
    const step = STEPS[v]
    if (!step) { warnings.push(`未知 schemaVersion ${v}，跳过迁移`); break }
    cur = step(cur, warnings)
    v += 1
    cur = { ...cur, meta: { ...cur.meta, schemaVersion: v } }
  }
  return { data: cur, warnings }
}
