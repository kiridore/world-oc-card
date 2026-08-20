// zip 导入导出（§3.1 文件夹布局）。纯函数：浏览器与测试均可直接使用。
import { zipSync, strToU8, strFromU8, unzipSync } from 'fflate'
import type { AssetMeta, ProjectData } from '@/types'
import { CURRENT_SCHEMA_VERSION } from '@/types'
import {
  parseWith, projectMetaSchema, settingsSchema, legacySettingsV1Schema, relationsFileSchema, legacyRelationsFileSchema,
  templatesFileSchema, charactersFileSchema, codexFileSchema, eventsFileSchema, assetsIndexFileSchema,
} from '@/schemas'
import { migrateProject } from './migration'

export interface ZipAsset { meta: Omit<AssetMeta, 'projectId'>; bytes: Uint8Array }

export function buildZip(data: ProjectData, assets: ZipAsset[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  const pmeta = { ...data.meta, schemaVersion: CURRENT_SCHEMA_VERSION, updatedAt: new Date().toISOString() }
  entries['project.json'] = strToU8(JSON.stringify(pmeta, null, 2))
  entries['settings.json'] = strToU8(JSON.stringify(data.settings, null, 2))
  entries['relations.json'] = strToU8(JSON.stringify({ relations: data.relations }, null, 2))
  entries['templates.json'] = strToU8(JSON.stringify({ templates: data.templates }, null, 2))
  for (const c of data.characters) entries[`characters/${c.id}.json`] = strToU8(JSON.stringify({ character: c }, null, 2))
  for (const e of data.codex) entries[`codex/${e.id}.json`] = strToU8(JSON.stringify({ entry: e }, null, 2))
  for (const e of data.events) entries[`events/${e.id}.json`] = strToU8(JSON.stringify({ event: e }, null, 2))
  if (assets.length) {
    entries['assets/index.json'] = strToU8(JSON.stringify({ assets: assets.map((a) => a.meta) }, null, 2))
    for (const a of assets) entries[`assets/${a.meta.id}.${a.meta.ext}`] = a.bytes
  }
  return zipSync(entries, { level: 6 })
}

export interface ParseZipResult {
  data: ProjectData
  assets: ZipAsset[]
  warnings: string[]
  fromVersion: number
}

/** 容错解析（M1-E1）：单实体文件缺失/损坏 → warning 并跳过，项目仍可打开；
 *  project.json / settings.json 损坏 → 抛错拒绝导入。 */
export function parseZip(bytes: Uint8Array): ParseZipResult {
  const warnings: string[] = []
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new Error('不是有效的 zip 文件')
  }

  const pmetaR = parseWith(projectMetaSchema, JSON.parse(strFromU8(files['project.json'])))
  if (!pmetaR.ok) throw new Error(`project.json 校验失败：${pmetaR.error}`)
  // v2 settings（arrow 三态）；v1 旧形态（directed 布尔）也接受，交迁移管道 v1→v2 统一转换
  const settingsJson = JSON.parse(strFromU8(files['settings.json']))
  const settingsR = parseWith(settingsSchema, settingsJson)
  const legacySettingsR = settingsR.ok ? null : parseWith(legacySettingsV1Schema, settingsJson)
  let settingsData: ProjectData['settings']
  if (settingsR.ok) settingsData = settingsR.data
  else if (legacySettingsR?.ok) settingsData = legacySettingsR.data as unknown as ProjectData['settings']
  else throw new Error(`settings.json 校验失败：${settingsR.error}`)

  const relationsJson = JSON.parse(strFromU8(files['relations.json'] ?? strToU8('{"relations":[]}')))
  const relations = relationsFileSchema.safeParse(relationsJson)
  const legacyRelations = legacyRelationsFileSchema.safeParse(relationsJson)
  if (!relations.success && !legacyRelations.success) {
    warnings.push(`relations.json 校验失败，已忽略：${relations.error.issues[0]?.message ?? ''}`)
  }
  const templates = templatesFileSchema.safeParse(JSON.parse(strFromU8(files['templates.json'] ?? strToU8('{"templates":[]}'))))
  if (!templates.success) warnings.push(`templates.json 校验失败，已忽略：${templates.error.issues[0]?.message ?? ''}`)

  const characters: ProjectData['characters'] = []
  const codex: ProjectData['codex'] = []
  const events: ProjectData['events'] = []

  const readDir = (dir: string, apply: (name: string, json: unknown) => void) => {
    for (const [path, u8] of Object.entries(files)) {
      if (!path.startsWith(dir + '/') || !path.endsWith('.json') || path.endsWith('index.json')) continue
      let json: unknown
      try { json = JSON.parse(strFromU8(u8)) } catch { warnings.push(`${path} 不是合法 JSON，已跳过`); continue }
      apply(path, json)
    }
  }

  readDir('characters', (path, json) => {
    const r = parseWith(charactersFileSchema, json)
    if (r.ok) characters.push(r.data.character)
    else warnings.push(`${path} 校验失败已跳过：${r.error}`)
  })
  readDir('codex', (path, json) => {
    const r = parseWith(codexFileSchema, json)
    if (r.ok) codex.push(r.data.entry)
    else warnings.push(`${path} 校验失败已跳过：${r.error}`)
  })
  readDir('events', (path, json) => {
    const r = parseWith(eventsFileSchema, json)
    if (r.ok) events.push(r.data.event)
    else warnings.push(`${path} 校验失败已跳过：${r.error}`)
  })

  const assets: ZipAsset[] = []
  const indexR = parseWith(assetsIndexFileSchema, JSON.parse(strFromU8(files['assets/index.json'] ?? strToU8('{"assets":[]}'))))
  if (indexR.ok) {
    for (const meta of indexR.data.assets) {
      const bytes = files[`assets/${meta.id}.${meta.ext}`]
      if (!bytes) { warnings.push(`assets/${meta.id}.${meta.ext} 缺失，图片将显示占位`); continue }
      assets.push({ meta, bytes })
    }
  }

  const fromVersion = pmetaR.data.schemaVersion
  const data: ProjectData = {
    meta: pmetaR.data,
    settings: settingsData,
    relations: relations.success
      ? relations.data.relations
      : legacyRelations.success
        ? (legacyRelations.data.relations as unknown as ProjectData['relations']) // v0，交给迁移管道
        : [],
    templates: templates.success ? templates.data.templates : [],
    characters, codex, events,
  }
  const migrated = migrateProject(data)
  return { data: migrated.data, assets, warnings: [...warnings, ...migrated.warnings], fromVersion }
}
