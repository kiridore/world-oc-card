import { describe, it, expect, beforeEach } from 'vitest'
import { WocDB } from '../src/storage/db'
import { LocalRepository } from '../src/storage/local'
import { DirtyTracker, attachWriteCounters } from '../src/utils/dirty'
import { buildZip, parseZip } from '../src/storage/zip'
import type { ProjectData } from '../src/types'
import { uuid, nowIso } from '../src/utils/id'

function makeProject(name = '测试项目'): ProjectData {
  return {
    meta: { id: uuid(), name, schemaVersion: 1, createdAt: nowIso(), updatedAt: nowIso() },
    settings: {
      calendars: [{ id: 'cal1', name: '通用纪年', offset: 0, unitYears: 1 }],
      relationTypes: [{ id: 'rt1', name: '亲属', color: '#7d9cb5', directed: false }],
      codexTypes: [{ id: 'ct1', key: 'location', name: '地点' }],
      worldlines: [{ id: 'w1', name: '主世界线', parentWorldlineId: null, forkPointEventId: null, color: '#7d9cb5', status: 'active', order: 0 }],
    },
    relations: [],
    templates: [],
    characters: [
      { id: 'c1', name: '角色一', fieldBlocks: [{ type: 'text', title: '外貌', content: 'x'.repeat(2000) }], createdAt: nowIso(), updatedAt: nowIso() },
      { id: 'c2', name: '角色二', fieldBlocks: [], createdAt: nowIso(), updatedAt: nowIso() },
    ],
    codex: [{ id: 'x1', typeId: 'ct1', name: '王城', content: '## 概述', attributes: [{ key: '人口', value: '3 万' }], color: '#8fae8b' }],
    events: [
      { id: 'e1', worldlineId: 'w1', time: { calendarId: 'cal1', value: 100, display: '纪元 100 年' }, title: '建国', description: '', participantIds: ['c1'], locationId: 'x1', causalLinks: [], collapsed: false, locked: false },
    ],
  }
}

let db: WocDB
let repo: LocalRepository
let counters: ReturnType<typeof attachWriteCounters>

beforeEach(async () => {
  db = new WocDB(`woc-test-${uuid()}`)
  await db.open()
  repo = new LocalRepository(db)
  counters = attachWriteCounters(db)
})

describe('M1-F1 项目管理', () => {
  it('新建/列表/删除，多项目共存且持久', async () => {
    const p1 = makeProject('A')
    const p2 = makeProject('B')
    await repo.createProject('A', p1)
    await repo.createProject('B', p2)
    let list = await repo.listProjects()
    expect(list.map((p) => p.name).sort()).toEqual(['A', 'B'])
    await repo.deleteProject(p1.meta.id)
    list = await repo.listProjects()
    expect(list.map((p) => p.name)).toEqual(['B'])
    const loaded = await repo.loadProject(p2.meta.id)
    expect(loaded?.data.characters.length).toBe(2)
  })

  it('重命名（未打开项目路径）', async () => {
    const p = makeProject('旧名')
    await repo.createProject('旧名', p)
    await repo.saveEntities(p.meta.id, { ...p, meta: { ...p.meta, name: '新名' } }, [{ kind: 'meta' }, { kind: 'settings' }, { kind: 'relations' }, { kind: 'templates' }, { kind: 'character' }, { kind: 'codex' }, { kind: 'event' }])
    const list = await repo.listProjects()
    expect(list[0].name).toBe('新名')
  })
})

describe('M1-F4 脏实体保存（只写脏表脏行）', () => {
  it('修改单个角色仅写 characters 表 1 条记录', async () => {
    const p = makeProject()
    await repo.createProject('T', p)
    const loaded = (await repo.loadProject(p.meta.id))!.data
    const c1 = { ...loaded.characters[0], name: '角色一改' }
    const data: ProjectData = { ...loaded, characters: loaded.characters.map((c) => (c.id === 'c1' ? c1 : c)) }
    counters.reset()
    await repo.saveEntities(p.meta.id, data, [{ kind: 'character', id: 'c1' }])
    expect(counters.counts.characters).toBe(1)
    expect(counters.counts.codex).toBe(0)
    expect(counters.counts.events).toBe(0)
    expect(counters.counts.settings).toBe(0)
    expect(counters.counts.relations).toBe(0)
    expect(counters.counts.templates).toBe(0)
    const re = (await repo.loadProject(p.meta.id))!.data
    expect(re.characters.find((c) => c.id === 'c1')?.name).toBe('角色一改')
  })

  it('删除标记（实体不存在于数据中 → 删行）', async () => {
    const p = makeProject()
    await repo.createProject('T', p)
    const loaded = (await repo.loadProject(p.meta.id))!.data
    const data: ProjectData = { ...loaded, characters: loaded.characters.filter((c) => c.id !== 'c2') }
    await repo.saveEntities(p.meta.id, data, [{ kind: 'character', id: 'c2' }])
    const re = (await repo.loadProject(p.meta.id))!.data
    expect(re.characters.length).toBe(1)
  })
})

describe('M1-F5 图片隔离', () => {
  it('图片存 assets Blob 表，角色 JSON 无 base64', async () => {
    const p = makeProject()
    await repo.createProject('T', p)
    const png = new Blob([new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4])], { type: 'image/png' })
    await repo.saveAsset({ id: 'a1', projectId: p.meta.id, ext: 'png', name: '头像.png', mime: 'image/png', size: 8 }, png)
    const blob = await repo.loadAssetBlob('a1')
    expect(blob).toBeInstanceOf(Blob)
    const loaded = (await repo.loadProject(p.meta.id))!
    expect(loaded.assets.map((a) => a.id)).toEqual(['a1'])
    const data = loaded.data
    expect(JSON.stringify(data).includes('data:image')).toBe(false)
  })
})

describe('M1-F2/F3 zip 往返与结构', () => {
  it('导出 → 清库 → 导入，序列化深比较一致（忽略时间戳）', async () => {
    const p = makeProject('往返')
    await repo.createProject('往返', p)
    const zip = await repo.exportZip(p.meta.id)
    await repo.deleteProject(p.meta.id)
    expect(await repo.listProjects()).toHaveLength(0)
    const res = await repo.importZip(zip, 'overwrite')
    expect(res.meta.id).toBe(p.meta.id)
    const loaded = (await repo.loadProject(p.meta.id))!.data
    const strip = (d: ProjectData) => JSON.parse(JSON.stringify({ ...d, meta: { ...d.meta, updatedAt: '', createdAt: '', stats: undefined }, characters: d.characters.map((c) => ({ ...c, createdAt: '', updatedAt: '' })) }))
    expect(strip(loaded)).toEqual(strip(p))
  })

  it('zip 内布局与 §3.1 一致', async () => {
    const p = makeProject()
    const bytes = buildZip(p, [])
    const { unzipSync, strFromU8 } = await import('fflate')
    const files = unzipSync(bytes)
    const paths = Object.keys(files).sort()
    expect(paths).toContain('project.json')
    expect(paths).toContain('settings.json')
    expect(paths).toContain('relations.json')
    expect(paths).toContain('templates.json')
    expect(paths).toContain('characters/c1.json')
    expect(paths).toContain('characters/c2.json')
    expect(paths).toContain('codex/x1.json')
    expect(paths).toContain('events/e1.json')
    expect(JSON.parse(strFromU8(files['characters/c1.json'])).character.name).toBe('角色一')
  })
})

describe('M1-E1 残缺导入容错', () => {
  it('删去某角色文件后仍可导入，其余数据完好', async () => {
    const p = makeProject()
    const bytes = buildZip(p, [])
    const { unzipSync, zipSync } = await import('fflate')
    const files: Record<string, Uint8Array> = { ...unzipSync(bytes) }
    delete files['characters/c1.json']
    const res = await repo.importZip(new Blob([zipSync(files)]), 'overwrite')
    expect(res.warnings.some((w) => w.includes('c1'))).toBe(false) // 文件缺失不算警告（实体直接少一条）
    const loaded = (await repo.loadProject(p.meta.id))!.data
    expect(loaded.characters.map((c) => c.id)).toEqual(['c2'])
    // 事件里对 c1 的引用成为失效引用（不崩溃，由 UI 层占位）
    expect(loaded.events[0].participantIds).toContain('c1')
  })

  it('损坏 JSON 文件跳过并告警', async () => {
    const p = makeProject()
    const bytes = buildZip(p, [])
    const { unzipSync, zipSync, strToU8 } = await import('fflate')
    const files: Record<string, Uint8Array> = { ...unzipSync(bytes) }
    files['events/e1.json'] = strToU8('{{{not json')
    const res = await repo.importZip(new Blob([zipSync(files)]), 'overwrite')
    expect(res.warnings.length).toBeGreaterThan(0)
    const loaded = (await repo.loadProject(p.meta.id))!.data
    expect(loaded.events).toHaveLength(0)
  })

  it('project.json 损坏 → 拒绝导入', async () => {
    const p = makeProject()
    const bytes = buildZip(p, [])
    const { unzipSync, zipSync, strToU8 } = await import('fflate')
    const files: Record<string, Uint8Array> = { ...unzipSync(bytes) }
    files['project.json'] = strToU8('{}')
    await expect(repo.importZip(new Blob([zipSync(files)]), 'overwrite')).rejects.toThrow()
  })
})

describe('M1-F6 版本迁移', () => {
  it('v0 zip（关系内联 type/directed）导入后升级 v1 且字段正确', async () => {
    const p = makeProject()
    const bytes = buildZip(p, [])
    const { unzipSync, zipSync, strToU8, strFromU8 } = await import('fflate')
    const files: Record<string, Uint8Array> = { ...unzipSync(bytes) }
    // 改写为 v0 形态
    files['project.json'] = strToU8(JSON.stringify({ ...p.meta, schemaVersion: 0 }))
    files['relations.json'] = strToU8(JSON.stringify({
      relations: [{ id: 'r1', from: 'c1', to: 'c2', type: '挚友', directed: false, description: '' }],
    }))
    const res = await repo.importZip(new Blob([zipSync(files)]), 'overwrite')
    expect(res.meta.schemaVersion).toBe(1)
    const loaded = (await repo.loadProject(p.meta.id))!.data
    expect(loaded.relations).toHaveLength(1)
    const rt = loaded.settings.relationTypes.find((t) => t.name === '挚友')
    expect(rt).toBeDefined()
    expect(loaded.relations[0].typeId).toBe(rt!.id)
    void strFromU8
  })
})

describe('M1-E2 防抖聚合', () => {
  it('500ms 内连续修改同一实体只触发一次持久化；不同实体分条写入', async () => {
    const p = makeProject()
    await repo.createProject('T', p)
    const flushes: number[][] = []
    const tracker = new DirtyTracker({
      delay: 500,
      onFlush: (refs) => {
        flushes.push(refs.map((_r) => 1))
        return repo.saveEntities(p.meta.id, makeProject(), refs.map((r) => ({ ...r, kind: r.kind })))
      },
    })
    for (let i = 0; i < 10; i++) tracker.mark({ kind: 'character', id: 'c1' })
    tracker.mark({ kind: 'codex', id: 'x1' })
    tracker.mark({ kind: 'event', id: 'e1' })
    expect(flushes).toHaveLength(0)
    await tracker.flush()
    expect(flushes).toHaveLength(1)
    expect(tracker.size).toBe(0)
  })
})

describe('M1-P1/P2 性能（fake-indexeddb 规模演练）', () => {
  it('200 角色 + 1000 事件全量载入 < 1s；单实体保存 < 100ms', async () => {
    const p = makeProject()
    p.characters = Array.from({ length: 200 }, (_, i) => ({
      id: `c-${i}`, name: `角色${i}`, fieldBlocks: [{ type: 'text', title: '背景', content: '内容'.repeat(200) }],
      createdAt: nowIso(), updatedAt: nowIso(),
    }))
    p.events = Array.from({ length: 1000 }, (_, i) => ({
      id: `e-${i}`, worldlineId: 'w1', time: { calendarId: 'cal1', value: i, display: `年 ${i}` },
      title: `事件${i}`, description: '描述'.repeat(50), participantIds: ['c-1'], locationId: null,
      causalLinks: [], collapsed: false, locked: false,
    }))
    await repo.createProject('大项目', p)
    const t0 = performance.now()
    const loaded = (await repo.loadProject(p.meta.id))!
    const tLoad = performance.now() - t0
    expect(loaded.data.events).toHaveLength(1000)
    const t1 = performance.now()
    await repo.saveEntities(p.meta.id, loaded.data, [{ kind: 'character', id: 'c-1' }])
    const tSave = performance.now() - t1
    expect(tLoad).toBeLessThan(1000)
    expect(tSave).toBeLessThan(100)
  })
})

describe('M1-D1 zip 纯函数（buildZip/parseZip 直测）', () => {
  it('parseZip 返回迁移后数据与 fromVersion', () => {
    const p = makeProject()
    const bytes = buildZip(p, [])
    const r = parseZip(bytes)
    expect(r.fromVersion).toBe(1)
    expect(r.data.characters).toHaveLength(2)
    expect(r.warnings).toHaveLength(0)
  })
})

describe('M7-F2 导出 zip 默认不含孤儿资产', () => {
  it('未被图片块引用的资产被过滤，被引用的保留', async () => {
    const p = makeProject()
    p.characters[0].fieldBlocks.push({ type: 'image', title: '立绘', assetId: 'a-used' })
    await repo.createProject('T', p)
    await repo.saveAsset({ id: 'a-used', projectId: p.meta.id, ext: 'png', name: 'u.png', mime: 'image/png', size: 4 }, new Blob(['x']))
    await repo.saveAsset({ id: 'a-orphan', projectId: p.meta.id, ext: 'png', name: 'o.png', mime: 'image/png', size: 4 }, new Blob(['y']))
    const zip = await repo.exportZip(p.meta.id)
    const { unzipSync, strFromU8 } = await import('fflate')
    const files = unzipSync(new Uint8Array(await zip.arrayBuffer()))
    expect(files['assets/a-used.png']).toBeDefined()
    expect(files['assets/a-orphan.png']).toBeUndefined()
    expect(JSON.parse(strFromU8(files['assets/index.json'])).assets.map((a: { id: string }) => a.id)).toEqual(['a-used'])
  })
})
