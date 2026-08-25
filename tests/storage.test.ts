import { describe, it, expect, beforeEach } from 'vitest'
import { WocDB } from '../src/storage/db'
import { LocalRepository } from '../src/storage/local'
import { DirtyTracker, attachWriteCounters } from '../src/utils/dirty'
import { buildZip, parseZip } from '../src/storage/zip'
import { migrateProject } from '../src/storage/migration'
import type { ProjectData } from '../src/types'
import { uuid, nowIso } from '../src/utils/id'

function makeProject(name = '测试项目'): ProjectData {
  return {
    meta: { id: uuid(), name, schemaVersion: 3, createdAt: nowIso(), updatedAt: nowIso() },
    settings: {
      relationTypes: [{ id: 'rt1', name: '亲属', color: '#7d9cb5', arrow: 'none' as const }],
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
      { id: 'e1', worldlineId: 'w1', time: { mode: 'calendar', era: '通用纪年', year: '100', month: '', day: '' }, title: '建国', description: '', participantIds: ['c1'], relatedCodexIds: ['x1'], rank: 0, manualPlaced: false, collapsed: false, locked: false },
    ],
  }
}

/** v2 旧形状事件（calendarId/value 数值纪年，含 locationId/causalLinks/canvasPos）——迁移测试夹具 */
function legacyV2Event() {
  return {
    id: 'e1', worldlineId: 'w1', time: { calendarId: 'cal1', value: 100, display: '通用纪年 100 年' },
    title: '建国', description: '', participantIds: ['c1'], locationId: 'x1', causalLinks: [],
    collapsed: false, locked: false,
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
  it('v0 zip（关系内联 type/directed）导入后升级到当前版本且字段正确（directed=false → arrow=none）', async () => {
    const p = makeProject()
    const bytes = buildZip(p, [])
    const { unzipSync, zipSync, strToU8 } = await import('fflate')
    const files: Record<string, Uint8Array> = { ...unzipSync(bytes) }
    // 改写为 v0 形态（事件也降级为 v2 旧形状，否则 v2→v3 迁移会按旧字段误读 v3 事件）
    files['project.json'] = strToU8(JSON.stringify({ ...p.meta, schemaVersion: 0 }))
    files['relations.json'] = strToU8(JSON.stringify({
      relations: [{ id: 'r1', from: 'c1', to: 'c2', type: '挚友', directed: false, description: '' }],
    }))
    files['events/e1.json'] = strToU8(JSON.stringify({ event: legacyV2Event() }))
    const res = await repo.importZip(new Blob([zipSync(files)]), 'overwrite')
    expect(res.meta.schemaVersion).toBe(3)
    const loaded = (await repo.loadProject(p.meta.id))!.data
    expect(loaded.relations).toHaveLength(1)
    const rt = loaded.settings.relationTypes.find((t) => t.name === '挚友')
    expect(rt).toBeDefined()
    expect(rt!.arrow).toBe('none')
    expect(loaded.relations[0].typeId).toBe(rt!.id)
  })

  it('v1 zip（relationTypes.directed 布尔）导入后升级 v2：true→single / false→none', async () => {
    const p = makeProject()
    const bytes = buildZip(p, [])
    const { unzipSync, zipSync, strToU8, strFromU8 } = await import('fflate')
    const files: Record<string, Uint8Array> = { ...unzipSync(bytes) }
    files['project.json'] = strToU8(JSON.stringify({ ...p.meta, schemaVersion: 1 }))
    files['events/e1.json'] = strToU8(JSON.stringify({ event: legacyV2Event() }))
    const settings = JSON.parse(strFromU8(files['settings.json']))
    settings.calendars = [{ id: 'cal1', name: '通用纪年', offset: 0, unitYears: 1 }]
    settings.relationTypes = [
      { id: 'rt-old-1', name: '师徒', color: '#7d9cb5', directed: true },
      { id: 'rt-old-2', name: '同盟', color: '#8fae8b', directed: false },
    ]
    files['settings.json'] = strToU8(JSON.stringify(settings))
    const res = await repo.importZip(new Blob([zipSync(files)]), 'overwrite')
    expect(res.meta.schemaVersion).toBe(3)
    expect(res.warnings.some((w) => w.includes('v1 迁移到 v2'))).toBe(true)
    expect(res.warnings.some((w) => w.includes('v2 迁移到 v3'))).toBe(true)
    const loaded = (await repo.loadProject(p.meta.id))!.data
    expect(loaded.settings.relationTypes.find((t) => t.name === '师徒')!.arrow).toBe('single')
    expect(loaded.settings.relationTypes.find((t) => t.name === '同盟')!.arrow).toBe('none')
    // 事件随迁移转为字符串纪年（era=历法名, year=String(value)）
    const e1 = loaded.events.find((e) => e.id === 'e1')!
    expect(e1.time).toEqual({ mode: 'calendar', era: '通用纪年', year: '100', month: '', day: '' })
  })

  it('存量 v1 数据（直接写库，非 zip 导入）在 loadProject 时升级并回写到 v3', async () => {
    const p = makeProject()
    p.relations.push({ id: 'r-arrow', from: 'c1', to: 'c2', typeId: 'rt-old-1', description: '' })
    await repo.createProject('T', p)
    // 手工把库内数据降级为 v1 形态（事件也降级为 v2 旧形状，走完整 1→2→3 管道）
    await db.projects.put({ ...p.meta, schemaVersion: 1 })
    await db.settings.put({
      projectId: p.meta.id,
      calendars: [{ id: 'cal1', name: '通用纪年', offset: 0, unitYears: 1 }],
      relationTypes: [
        { id: 'rt-old-1', name: '宿敌', color: '#c2917f', directed: true },
      ] as never,
      codexTypes: p.settings.codexTypes,
      worldlines: p.settings.worldlines,
    } as never)
    await db.events.put({ projectId: p.meta.id, ...legacyV2Event() } as never)
    const loaded = (await repo.loadProject(p.meta.id))!.data
    expect(loaded.meta.schemaVersion).toBe(3)
    expect(loaded.settings.relationTypes[0].arrow).toBe('single')
    const e1 = loaded.events.find((e) => e.id === 'e1')!
    expect(e1.time).toEqual({ mode: 'calendar', era: '通用纪年', year: '100', month: '', day: '' })
    expect(e1.rank).toBe(0)
    // 回写持久化：再次加载仍是 v3
    const again = (await repo.loadProject(p.meta.id))!.data
    expect(again.meta.schemaVersion).toBe(3)
    expect(again.settings.relationTypes[0].arrow).toBe('single')
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
      id: `e-${i}`, worldlineId: 'w1', time: { mode: 'calendar', era: '通用纪年', year: String(i), month: '', day: '' },
      title: `事件${i}`, description: '描述'.repeat(50), participantIds: ['c-1'], relatedCodexIds: [],
      rank: i, manualPlaced: false, collapsed: false, locked: false,
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

describe('M1-F6 v2→v3 迁移（字符串纪年）', () => {
  it('migrateProject：数值纪元 → 双模式字符串；locationId 并入；因果/画布丢弃；草稿置空；rank 推导；历法删除', () => {
    // v2 旧形状内联字面量（Calendar 类型已删，用局部形状 + 断言约束）
    const v2Data = {
      meta: { id: 'p', name: '迁移', schemaVersion: 2, createdAt: nowIso(), updatedAt: nowIso() },
      settings: {
        calendars: [
          { id: 'cal-year', name: '第三纪元', offset: 100, unitYears: 1 },
          { id: 'cal-month', name: '星历', offset: 0, unitYears: 1 / 12 },
        ],
        relationTypes: [], codexTypes: [],
        worldlines: [
          { id: 'w1', name: '主线', parentWorldlineId: null, forkPointEventId: null, color: '#7d9cb5', status: 'active', order: 0 },
          { id: 'w2', name: 'IF 线', parentWorldlineId: 'w1', forkPointEventId: 'e1', color: '#8fae8b', status: 'active', order: 1 },
        ],
      },
      relations: [], templates: [], characters: [], codex: [],
      events: [
        { id: 'e1', worldlineId: 'w1', time: { calendarId: 'cal-year', value: 10, display: '第三纪元 10 年' }, title: '建国', description: '', participantIds: [], locationId: 'loc1', causalLinks: ['e2'], canvasPos: { x: 1, y: 2 }, collapsed: false, locked: false },
        { id: 'e2', worldlineId: 'w1', time: { calendarId: 'cal-year', value: 5, display: '第三纪元 5 年' }, title: '更早', description: '', participantIds: [], locationId: null, causalLinks: [], collapsed: false, locked: false },
        { id: 'e3', worldlineId: 'w1', time: { calendarId: 'cal-year', value: 30, display: '第三纪元 30 年' }, title: '更晚', description: '', participantIds: [], locationId: null, causalLinks: [], collapsed: false, locked: false },
        { id: 'e4', worldlineId: 'w2', time: { calendarId: 'cal-month', value: 18, display: '星历 18 月' }, title: '月历事件', description: '', participantIds: [], locationId: null, causalLinks: [], collapsed: false, locked: false },
        { id: 'e5', worldlineId: 'w1', time: null, title: '草稿', description: '', participantIds: [], locationId: null, causalLinks: [], collapsed: false, locked: false },
      ],
    }
    const res = migrateProject(v2Data as unknown as ProjectData)
    expect(res.data.meta.schemaVersion).toBe(3)
    expect(res.warnings.some((w) => w.includes('v2 迁移到 v3'))).toBe(true)
    expect(res.warnings.some((w) => w.includes('causalLinks'))).toBe(true)

    const ev = (id: string) => res.data.events.find((e) => e.id === id)!
    // 年历法 → calendar 模式：era=历法名, year=String(value)
    expect(ev('e1').time).toEqual({ mode: 'calendar', era: '第三纪元', year: '10', month: '', day: '' })
    // 月历法 → custom 模式：text=旧 display 保真
    expect(ev('e4').time).toEqual({ mode: 'custom', text: '星历 18 月' })
    // 旧草稿 → worldlineId null && time null
    expect(ev('e5').worldlineId).toBeNull()
    expect(ev('e5').time).toBeNull()
    // locationId 并入 relatedCodexIds
    expect(ev('e1').relatedCodexIds).toEqual(['loc1'])
    // causalLinks / canvasPos 键不存在
    expect('causalLinks' in ev('e1')).toBe(false)
    expect('canvasPos' in ev('e1')).toBe(false)
    // settings.calendars 键被删除
    expect((res.data.settings as Record<string, unknown>).calendars).toBeUndefined()
    // rank：w1 按绝对纪元升序 5<10<30 → e2=0, e1=1, e3=2
    const w1 = res.data.events.filter((e) => e.worldlineId === 'w1').sort((a, b) => a.rank - b.rank)
    expect(w1.map((e) => e.id)).toEqual(['e2', 'e1', 'e3'])
    expect(ev('e4').rank).toBe(0)
    expect(ev('e1').manualPlaced).toBe(false)
  })

  it('v2 zip（旧字段形状）导入零丢失：迁移到 v3 且事件数不变', async () => {
    const p = makeProject()
    const bytes = buildZip(p, [])
    const { unzipSync, zipSync, strToU8, strFromU8 } = await import('fflate')
    const files: Record<string, Uint8Array> = { ...unzipSync(bytes) }
    files['project.json'] = strToU8(JSON.stringify({ ...p.meta, schemaVersion: 2 }))
    // settings 恢复 v2 形状（含 calendars，relationTypes 已为 arrow 三态）
    const settings = JSON.parse(strFromU8(files['settings.json']))
    settings.calendars = [{ id: 'cal1', name: '通用纪年', offset: 0, unitYears: 1 }]
    files['settings.json'] = strToU8(JSON.stringify(settings))
    // 事件恢复 v2 形状
    files['events/e1.json'] = strToU8(JSON.stringify({ event: legacyV2Event() }))
    const res = await repo.importZip(new Blob([zipSync(files)]), 'overwrite')
    expect(res.meta.schemaVersion).toBe(3)
    expect(res.warnings.some((w) => w.includes('v2 迁移到 v3'))).toBe(true)
    const loaded = (await repo.loadProject(p.meta.id))!.data
    expect(loaded.events).toHaveLength(1)
    const e1 = loaded.events[0]
    expect(e1.time).toEqual({ mode: 'calendar', era: '通用纪年', year: '100', month: '', day: '' })
    expect(e1.relatedCodexIds).toEqual(['x1'])
    expect(e1.rank).toBe(0)
  })
})

describe('M1-D1 zip 纯函数（buildZip/parseZip 直测）', () => {
  it('parseZip 返回迁移后数据与 fromVersion', () => {
    const p = makeProject()
    const bytes = buildZip(p, [])
    const r = parseZip(bytes)
    expect(r.fromVersion).toBe(3)
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
