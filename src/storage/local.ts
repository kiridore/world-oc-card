import type { AssetMeta, Character, CodexEntry, ProjectData, ProjectMeta, TimelineEvent } from '@/types'
import { CURRENT_SCHEMA_VERSION } from '@/types'
import type { EntityRef, LoadedProject, Repository } from './repository'
import type { WocDB } from './db'
import { buildZip, parseZip } from './zip'
import { migrateProject } from './migration'
import { findOrphanAssets } from '@/utils/integrity'
import { uuid } from '@/utils/id'

/** IndexedDB 无法结构化克隆 Pinia/Vue 响应式 Proxy（DataCloneError）——写入前一律纯化。
 *  实体均为纯 JSON 数据，JSON 往返安全；Blob 走 assets 独立路径不经此函数。 */
function plain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

/** 项目统计（写入 project.json，供首页展示） */
function statsOf(data: ProjectData) {
  return {
    characters: data.characters.length,
    codex: data.codex.length,
    events: data.events.length,
    worldlines: data.settings.worldlines.length,
    relations: data.relations.length,
  }
}

export class LocalRepository implements Repository {
  constructor(private db: WocDB) {}

  async listProjects(): Promise<ProjectMeta[]> {
    const rows = await this.db.projects.toArray()
    return rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  }

  async createProject(_name: string, data: ProjectData): Promise<void> {
    const meta = { ...data.meta, schemaVersion: CURRENT_SCHEMA_VERSION, updatedAt: new Date().toISOString() }
    await this.db.transaction('rw', [this.db.projects, this.db.settings, this.db.relations, this.db.templates, this.db.characters, this.db.codex, this.db.events], async () => {
      await this.db.projects.put(plain(meta))
      await this.writeAllRows({ ...data, meta })
    })
  }

  async deleteProject(id: string): Promise<void> {
    await this.db.transaction('rw', [this.db.projects, this.db.settings, this.db.relations, this.db.templates, this.db.characters, this.db.codex, this.db.events, this.db.assets], async () => {
      await this.db.projects.delete(id)
      await this.db.settings.delete(id)
      await this.db.relations.delete(id)
      await this.db.templates.delete(id)
      await Promise.all([
        this.db.characters.where('projectId').equals(id).delete(),
        this.db.codex.where('projectId').equals(id).delete(),
        this.db.events.where('projectId').equals(id).delete(),
        this.db.assets.where('projectId').equals(id).delete(),
      ])
    })
  }

  async loadProject(id: string): Promise<LoadedProject | null> {
    const meta = await this.db.projects.get(id)
    if (!meta) return null
    const settingsRow = await this.db.settings.get(id)
    const relationsRow = await this.db.relations.get(id)
    const templatesRow = await this.db.templates.get(id)
    const [characters, codex, events, assetRows] = await Promise.all([
      this.db.characters.where('projectId').equals(id).toArray(),
      this.db.codex.where('projectId').equals(id).toArray(),
      this.db.events.where('projectId').equals(id).toArray(),
      this.db.assets.where('projectId').equals(id).toArray(),
    ])
    const strip = <T extends { projectId: string }>(r: T): Omit<T, 'projectId'> => {
      const { projectId: _pid, ...rest } = r
      return rest
    }
    let data: ProjectData = {
      meta,
      settings: settingsRow ? { calendars: settingsRow.calendars, relationTypes: settingsRow.relationTypes, codexTypes: settingsRow.codexTypes, worldlines: settingsRow.worldlines } : { calendars: [], relationTypes: [], codexTypes: [], worldlines: [] },
      relations: relationsRow?.relations ?? [],
      templates: templatesRow?.templates ?? [],
      characters: characters.map((c) => strip(c) as Character).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      codex: codex.map((c) => strip(c) as CodexEntry).sort((a, b) => a.name.localeCompare(b.name)),
      events: events.map((e) => strip(e) as TimelineEvent).sort((a, b) => a.id.localeCompare(b.id)),
    }
    // 旧版本存量数据（非 zip 导入路径）在加载时升级并回写，如 v1 directed → v2 arrow
    if (data.meta.schemaVersion < CURRENT_SCHEMA_VERSION) {
      const migrated = migrateProject(data)
      data = migrated.data
      await this.writeAllRows(plain(data))
    }
    return { data, assets: assetRows.map(({ blob: _b, ...m }) => m) }
  }

  async saveEntities(projectId: string, data: ProjectData, dirty: EntityRef[]): Promise<void> {
    if (dirty.length === 0) return
    const kinds = new Set(dirty.map((d) => d.kind))
    const tables: Array<Parameters<WocDB['transaction']>[1]> = [this.db.projects]
    const touch = (t: unknown) => tables.push(t as never)
    if (kinds.has('settings')) touch(this.db.settings)
    if (kinds.has('relations')) touch(this.db.relations)
    if (kinds.has('templates')) touch(this.db.templates)
    if (kinds.has('character')) touch(this.db.characters)
    if (kinds.has('codex')) touch(this.db.codex)
    if (kinds.has('event')) touch(this.db.events)

    const meta = { ...data.meta, updatedAt: new Date().toISOString(), stats: statsOf(data) }
    await this.db.transaction('rw', tables as never[], async () => {
      // 只写脏实体（M1-F4）：脏标记决定写哪些行/哪些表
      if (kinds.has('settings')) await this.db.settings.put(plain({ projectId, ...data.settings }))
      if (kinds.has('relations')) await this.db.relations.put(plain({ projectId, relations: data.relations }))
      if (kinds.has('templates')) await this.db.templates.put(plain({ projectId, templates: data.templates }))
      for (const ref of dirty) {
        if (ref.kind === 'character') {
          const c = data.characters.find((x) => x.id === ref.id)
          if (c) await this.db.characters.put(plain({ ...c, projectId }))
          else if (ref.id) await this.db.characters.delete(ref.id)
        } else if (ref.kind === 'codex') {
          const e = data.codex.find((x) => x.id === ref.id)
          if (e) await this.db.codex.put(plain({ ...e, projectId }))
          else if (ref.id) await this.db.codex.delete(ref.id)
        } else if (ref.kind === 'event') {
          const e = data.events.find((x) => x.id === ref.id)
          if (e) await this.db.events.put(plain({ ...e, projectId }))
          else if (ref.id) await this.db.events.delete(ref.id)
        }
      }
      await this.db.projects.put(plain(meta))
    })
  }

  async saveAsset(asset: AssetMeta, blob: Blob): Promise<void> {
    await this.db.assets.put({ ...asset, blob })
  }

  async loadAssetBlob(id: string): Promise<Blob | null> {
    const row = await this.db.assets.get(id)
    return row?.blob ?? null
  }

  async deleteAssets(ids: string[]): Promise<void> {
    await this.db.assets.bulkDelete(ids)
  }

  async exportZip(id: string): Promise<Blob> {
    const loaded = await this.loadProject(id)
    if (!loaded) throw new Error('项目不存在')
    // M7-F2：导出 zip 默认不含孤儿资产（未被任何图片块引用）
    const orphans = new Set(findOrphanAssets(loaded.data, loaded.assets))
    const assets = await Promise.all(loaded.assets
      .filter((m) => !orphans.has(m.id))
      .map(async (m) => {
        const blob = await this.loadAssetBlob(m.id)
        return { meta: m, bytes: new Uint8Array(blob ? await blob.arrayBuffer() : new ArrayBuffer(0)) }
      }))
    const bytes = buildZip(loaded.data, assets)
    return new Blob([bytes as BlobPart], { type: 'application/zip' })
  }

  async importZip(file: Blob, mode: 'overwrite' | 'copy'): Promise<{ meta: ProjectMeta; warnings: string[] }> {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const parsed = parseZip(bytes)
    let data = parsed.data
    let warnings = parsed.warnings
    const exists = await this.db.projects.get(data.meta.id)
    if (exists && mode === 'copy') {
      const newId = uuid()
      data = { ...data, meta: { ...data.meta, id: newId, name: `${data.meta.name}（副本）` } }
      warnings = [...warnings, '已存在同名 ID 项目，已另存为副本']
    }
    data = { ...data, meta: { ...data.meta, schemaVersion: CURRENT_SCHEMA_VERSION } }
    await this.db.transaction('rw', [this.db.projects, this.db.settings, this.db.relations, this.db.templates, this.db.characters, this.db.codex, this.db.events, this.db.assets], async () => {
      if (exists && mode === 'overwrite') await this.deleteProject(data.meta.id)
      await this.writeAllRows(data)
      await this.db.projects.put(plain({ ...data.meta, updatedAt: new Date().toISOString(), stats: statsOf(data) }))
      for (const a of parsed.assets) {
        await this.db.assets.put({ ...a.meta, projectId: data.meta.id, blob: new Blob([a.bytes as BlobPart], { type: a.meta.mime }) })
      }
    })
    return { meta: data.meta, warnings }
  }

  private async writeAllRows(data: ProjectData): Promise<void> {
    const id = data.meta.id
    await this.db.projects.put(plain(data.meta))
    await this.db.settings.put(plain({ projectId: id, ...data.settings }))
    await this.db.relations.put(plain({ projectId: id, relations: data.relations }))
    await this.db.templates.put(plain({ projectId: id, templates: data.templates }))
    await this.db.characters.bulkPut(plain(data.characters.map((c) => ({ ...c, projectId: id }))))
    await this.db.codex.bulkPut(plain(data.codex.map((c) => ({ ...c, projectId: id }))))
    await this.db.events.bulkPut(plain(data.events.map((e) => ({ ...e, projectId: id }))))
  }
}
