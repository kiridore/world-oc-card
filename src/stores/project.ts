import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  AssetMeta, Character, CodexEntry, EventTime, ProjectData, ProjectMeta, Relation, Template, TimelineEvent, Worldline,
} from '@/types'
import { CURRENT_SCHEMA_VERSION } from '@/types'
import { db } from '@/storage/db'
import { LocalRepository } from '@/storage/local'
import type { EntityRef } from '@/storage/repository'
import { DirtyTracker } from '@/utils/dirty'
import { uuid, nowIso } from '@/utils/id'
import { palettePick } from '@/utils/colors'
import { builtinTemplates } from '@/data/builtinTemplates'
import { insertIndex, applyOrder, parseStatus } from '@/utils/branchOrder'
import { removeEventCascade } from '@/utils/integrity'

export const BUILTIN_CODEX_TYPES: { key: string; name: string }[] = [
  { key: 'location', name: '地点' },
  { key: 'faction', name: '势力' },
  { key: 'race', name: '种族' },
  { key: 'item', name: '物品' },
  { key: 'system', name: '规则体系' },
  { key: 'free', name: '自由' },
]

let flushHooked = false
const LAST_KEY = 'woc-last-project'

/** 启动时自动重开上次项目（G4：刷新后当前项目上下文不丢） */
export async function reopenLastProject(): Promise<boolean> {
  let last: string | null
  try { last = localStorage.getItem(LAST_KEY) } catch { return false }
  if (!last) return false
  const store = useProjectStore()
  return store.openProject(last)
}

export const useProjectStore = defineStore('project', () => {
  const repo = new LocalRepository(db)
  const current = ref<ProjectData | null>(null)
  const assets = ref<AssetMeta[]>([])
  const projects = ref<ProjectMeta[]>([])
  const saving = ref(false)
  const objectUrls = new Map<string, string>()
  let tracker: DirtyTracker | null = null

  // ---- 项目列表 / 生命周期 ----
  async function refreshProjects(): Promise<void> {
    projects.value = await repo.listProjects()
  }

  function defaultProjectData(name: string): ProjectData {
    const id = uuid()
    const now = nowIso()
    const codexTypes = BUILTIN_CODEX_TYPES.map((t) => ({ id: uuid(), ...t }))
    return {
      meta: { id, name, schemaVersion: CURRENT_SCHEMA_VERSION, createdAt: now, updatedAt: now },
      settings: {
        relationTypes: [
          { id: uuid(), name: '亲属', color: palettePick(0), arrow: 'none' },
          { id: uuid(), name: '敌对', color: palettePick(2), arrow: 'single' },
        ],
        codexTypes,
        worldlines: [{
          id: uuid(), name: '主世界线', parentWorldlineId: null, forkPointEventId: null,
          color: palettePick(0), status: 'active', order: 0,
        }],
      },
      relations: [],
      templates: builtinTemplates(),
      characters: [], codex: [], events: [],
    }
  }

  async function createProject(name: string): Promise<ProjectMeta> {
    const data = defaultProjectData(name)
    await repo.createProject(name, data)
    await refreshProjects()
    return data.meta
  }

  async function openProject(id: string): Promise<boolean> {
    await flush()
    const loaded = await repo.loadProject(id)
    if (!loaded) {
      try { localStorage.removeItem(LAST_KEY) } catch { /* ignore */ }
      return false
    }
    try { localStorage.setItem(LAST_KEY, id) } catch { /* 隐私模式忽略 */ }
    current.value = loaded.data
    assets.value = loaded.assets
    tracker = new DirtyTracker({
      delay: 500,
      onFlush: async (refs) => {
        if (!current.value) return
        saving.value = true
        try {
          await repo.saveEntities(id, current.value, refs)
          await refreshProjects()
        } finally {
          saving.value = false
        }
      },
    })
    hookFlush()
    return true
  }

  function hookFlush(): void {
    if (flushHooked) return
    flushHooked = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush()
    })
    window.addEventListener('beforeunload', () => { void flush() })
  }

  async function flush(): Promise<void> {
    if (tracker) await tracker.flush()
  }

  async function closeProject(): Promise<void> {
    await flush()
    for (const url of objectUrls.values()) URL.revokeObjectURL(url)
    objectUrls.clear()
    tracker?.clear()
    tracker = null
    current.value = null
    assets.value = []
    try { localStorage.removeItem(LAST_KEY) } catch { /* ignore */ }
  }

  async function deleteProject(id: string): Promise<void> {
    if (current.value?.meta.id === id) await closeProject()
    await repo.deleteProject(id)
    await refreshProjects()
  }

  async function renameProject(id: string, name: string): Promise<void> {
    if (current.value?.meta.id === id) {
      current.value.meta = { ...current.value.meta, name }
      mark({ kind: 'meta' })
      await flush()
    } else {
      const loaded = await repo.loadProject(id)
      if (loaded) {
        await repo.saveEntities(id, { ...loaded.data, meta: { ...loaded.data.meta, name } }, [{ kind: 'meta' }, { kind: 'settings' }, { kind: 'relations' }, { kind: 'templates' }, { kind: 'character' }, { kind: 'codex' }, { kind: 'event' }])
      }
    }
    await refreshProjects()
  }

  function mark(ref: EntityRef): void {
    tracker?.mark(ref)
  }

  // ---- 实体 CRUD（写内存 + 标脏；删除走级联函数后标脏）----
  function upsertCharacter(c: Character): void {
    if (!current.value) return
    const i = current.value.characters.findIndex((x) => x.id === c.id)
    const updated = { ...c, updatedAt: nowIso() }
    if (i >= 0) current.value.characters[i] = updated
    else current.value.characters.push(updated)
    mark({ kind: 'character', id: c.id })
  }

  function upsertCodex(e: CodexEntry): void {
    if (!current.value) return
    const i = current.value.codex.findIndex((x) => x.id === e.id)
    if (i >= 0) current.value.codex[i] = e
    else current.value.codex.push(e)
    mark({ kind: 'codex', id: e.id })
  }

  function upsertEvent(e: TimelineEvent): void {
    if (!current.value) return
    const i = current.value.events.findIndex((x) => x.id === e.id)
    if (i >= 0) current.value.events[i] = e
    else current.value.events.push(e)
    mark({ kind: 'event', id: e.id })
  }

  function updateSettings(): void {
    if (!current.value) return
    current.value.settings = { ...current.value.settings }
    mark({ kind: 'settings' })
  }

  function updateRelations(): void {
    if (!current.value) return
    current.value.relations = [...current.value.relations]
    mark({ kind: 'relations' })
  }

  function updateTemplates(): void {
    if (!current.value) return
    current.value.templates = [...current.value.templates]
    mark({ kind: 'templates' })
  }

  // ---- 世界线 ----
  function worldlineById(id: string | null): Worldline | undefined {
    if (!id || !current.value) return undefined
    return current.value.settings.worldlines.find((w) => w.id === id)
  }

  function forkWorldline(fromEventId: string, name: string): Worldline | null {
    if (!current.value) return null
    const ev = current.value.events.find((e) => e.id === fromEventId)
    if (!ev) return null
    const parent = worldlineById(ev.worldlineId)
    if (!parent) return null
    const wl: Worldline = {
      id: uuid(), name, parentWorldlineId: parent.id, forkPointEventId: fromEventId,
      color: palettePick(current.value.settings.worldlines.length), status: 'active',
      order: current.value.settings.worldlines.length,
    }
    current.value.settings.worldlines.push(wl)
    updateSettings()
    return wl
  }

  // ---- 事件时间与线内排序（v3：rank 为线内顺序唯一真源，软解析只算插入位）----
  function reindexBranch(worldlineId: string | null): void {
    if (!worldlineId) return
    const branch = current.value?.events.filter((e) => e.worldlineId === worldlineId) ?? []
    const order = [...branch].sort((a, b) => a.rank - b.rank).map((e) => e.id)
    applyOrder(branch, order) // 删除/换线后可能出现空洞，统一重编号
    for (const e of branch) mark({ kind: 'event', id: e.id })
  }

  function setEventTime(eventId: string, time: EventTime, worldlineId: string): void {
    if (!current.value) return
    const ev = current.value.events.find((e) => e.id === eventId)
    if (!ev) return
    const branch = current.value.events.filter((e) => e.worldlineId === worldlineId && e.id !== eventId)
    const order = [...branch].sort((a, b) => a.rank - b.rank).map((e) => e.id)
    const idx = insertIndex(order.map((id) => current.value!.events.find((x) => x.id === id)!), time)
    order.splice(idx, 0, eventId)
    ev.time = time
    ev.worldlineId = worldlineId
    applyOrder([...branch, ev], order)
    for (const b of [...branch, ev]) mark({ kind: 'event', id: b.id })
  }

  function moveToDraft(eventId: string): void {
    const ev = current.value?.events.find((e) => e.id === eventId)
    if (!ev) return
    const oldLine = ev.worldlineId
    ev.time = null
    ev.worldlineId = null
    ev.rank = 0
    mark({ kind: 'event', id: eventId })
    if (oldLine) reindexBranch(oldLine)
  }

  function moveToWorldline(eventId: string, targetWorldlineId: string): void {
    if (!current.value) return
    const ev = current.value.events.find((e) => e.id === eventId)
    if (!ev || !ev.time) return
    const oldLine = ev.worldlineId
    ev.worldlineId = targetWorldlineId
    const branch = current.value.events.filter((e) => e.worldlineId === targetWorldlineId)
    const order = [...branch].sort((a, b) => a.rank - b.rank).map((e) => e.id)
    ev.rank = order.length // 落尾
    for (const b of branch) mark({ kind: 'event', id: b.id })
    if (oldLine) reindexBranch(oldLine)
  }

  function reorderBranch(worldlineId: string, newOrderIds: string[]): void {
    const branch = current.value?.events.filter((e) => e.worldlineId === worldlineId) ?? []
    const { changed } = applyOrder(branch, newOrderIds)
    for (const c of changed) {
      const e = branch.find((x) => x.id === c.id)
      if (!e) continue
      if (parseStatus(e.time) !== 'auto') e.manualPlaced = true
      mark({ kind: 'event', id: e.id })
    }
  }

  function removeEvent(eventId: string): void {
    const ev = current.value?.events.find((e) => e.id === eventId)
    if (!current.value) return
    removeEventCascade(current.value, eventId)
    if (ev?.worldlineId) reindexBranch(ev.worldlineId)
  }

  // ---- 资产（图片即时落盘，不走防抖）----
  async function addAsset(file: File): Promise<AssetMeta | null> {
    if (!current.value) return null
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const meta: AssetMeta = {
      id: uuid(), projectId: current.value.meta.id, ext,
      name: file.name, mime: file.type || 'image/png', size: file.size,
    }
    await repo.saveAsset(meta, file)
    assets.value = [...assets.value, meta]
    return meta
  }

  async function assetUrl(id: string): Promise<string | null> {
    const cached = objectUrls.get(id)
    if (cached) return cached
    const blob = await repo.loadAssetBlob(id)
    if (!blob) return null
    const url = URL.createObjectURL(blob)
    objectUrls.set(id, url)
    return url
  }

  async function deleteAssets(ids: string[]): Promise<void> {
    for (const id of ids) {
      const url = objectUrls.get(id)
      if (url) { URL.revokeObjectURL(url); objectUrls.delete(id) }
    }
    await repo.deleteAssets(ids)
    assets.value = assets.value.filter((a) => !ids.includes(a.id))
  }

  // ---- zip ----
  async function exportZip(): Promise<Blob> {
    if (!current.value) throw new Error('未打开项目')
    await flush()
    return repo.exportZip(current.value.meta.id)
  }

  async function importZip(file: Blob, mode: 'overwrite' | 'copy'): Promise<{ meta: ProjectMeta; warnings: string[] }> {
    return repo.importZip(file, mode)
  }

  // ---- 查询辅助 ----
  const characterById = computed(() => {
    const map = new Map<string, Character>()
    for (const c of current.value?.characters ?? []) map.set(c.id, c)
    return (id: string | null | undefined) => (id ? map.get(id) : undefined)
  })
  const codexById = computed(() => {
    const map = new Map<string, CodexEntry>()
    for (const c of current.value?.codex ?? []) map.set(c.id, c)
    return (id: string | null | undefined) => (id ? map.get(id) : undefined)
  })
  const eventById = computed(() => {
    const map = new Map<string, TimelineEvent>()
    for (const e of current.value?.events ?? []) map.set(e.id, e)
    return (id: string | null | undefined) => (id ? map.get(id) : undefined)
  })

  return {
    current, assets, projects, saving,
    refreshProjects, createProject, openProject, closeProject, deleteProject, renameProject,
    flush, mark,
    upsertCharacter, upsertCodex, upsertEvent, updateSettings, updateRelations, updateTemplates,
    worldlineById, forkWorldline,
    setEventTime, moveToWorldline, moveToDraft, reorderBranch, removeEvent,
    addAsset, assetUrl, deleteAssets,
    exportZip, importZip,
    characterById, codexById, eventById,
  }
})

export type { Relation, Template }
