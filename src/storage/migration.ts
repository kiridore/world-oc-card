// schemaVersion 迁移管道（M1-F6）：按版本逐步升级，v(N) → v(N+1)
import type { ProjectData, Relation, RelationType } from '@/types'
import { CURRENT_SCHEMA_VERSION } from '@/types'
import { uuid } from '@/utils/id'
import { palettePick } from '@/utils/colors'

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

const STEPS: Record<number, (d: ProjectData, w: string[]) => ProjectData> = {
  0: v0toV1,
  1: v1toV2,
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
