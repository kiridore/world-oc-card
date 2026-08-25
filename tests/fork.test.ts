import { describe, it, expect } from 'vitest'
import type { ProjectData, TimelineEvent } from '../src/types'
import { visibleEventsFor, allWorldlineViews, worldlineDepth } from '../src/utils/fork'

let seq = 0
function ev(worldlineId: string | null, value: number | null, rank = 0): TimelineEvent {
  seq += 1
  return {
    id: `e${seq}`, worldlineId,
    time: value === null ? null : { mode: 'calendar', era: '第三纪元', year: String(value), month: '', day: '' },
    title: `事件@${worldlineId}:${value}`, description: '',
    participantIds: [], relatedCodexIds: [], rank, manualPlaced: false, collapsed: false, locked: false,
  }
}

function data(): ProjectData {
  return {
    meta: { id: 'p', name: '', schemaVersion: 3, createdAt: '', updatedAt: '' },
    settings: {
      relationTypes: [], codexTypes: [],
      worldlines: [
        { id: 'main', name: '主世界线', parentWorldlineId: null, forkPointEventId: null, color: '#7d9cb5', status: 'active', order: 0 },
        { id: 'if1', name: 'IF 线 A', parentWorldlineId: 'main', forkPointEventId: 'e-fork', color: '#8fae8b', status: 'active', order: 1 },
        { id: 'if2', name: '孙线 B', parentWorldlineId: 'if1', forkPointEventId: 'e-if1-20', color: '#c2917f', status: 'active', order: 2 },
      ],
    },
    relations: [], templates: [],
    characters: [],
    codex: [],
    events: [
      { ...ev('main', 10, 1), id: 'e-fork' },   // 主线 fork 点（rank=1）
      ev('main', 5, 0),                          // 主线更早
      ev('main', 30, 2),                         // 主线 fork 之后
      { ...ev('if1', 15, 0), id: 'e-if1-15' },
      { ...ev('if1', 20, 1), id: 'e-if1-20' },   // if1 的 fork 点（孙线自此分出）
      ev('if1', 40, 2),
      ev('if2', 25, 0),
      ev(null, null, 0),                         // 草稿（未定时，无世界线）
    ],
  }
}

describe('M4-F3 fork 继承语义', () => {
  it('子线显示 fork 点及之前的父线事件；父线此后新增不出现在子线', () => {
    const d = data()
    const view = visibleEventsFor(d, 'if1')
    const inheritedTitles = view.inherited.map((e) => e.title)
    expect(inheritedTitles).toContain('事件@main:10')   // fork 点本身（rank=1 ≤ boundary 1）
    expect(inheritedTitles).toContain('事件@main:5')    // 更早（rank=0）
    expect(inheritedTitles).not.toContain('事件@main:30') // fork 之后（rank=2 > 1）
    expect(view.own.map((t) => t.title)).toEqual(['事件@if1:15', '事件@if1:20', '事件@if1:40'])

    // 父线新增事件（rank 在 fork 之后）→ 子线不可见
    d.events.push(ev('main', 40, 3))
    const view2 = visibleEventsFor(d, 'if1')
    expect(view2.inherited.map((e) => e.title)).not.toContain('事件@main:40')
  })

  it('主世界线无继承', () => {
    const view = visibleEventsFor(data(), 'main')
    expect(view.inherited).toHaveLength(0)
    expect(view.own.length).toBe(3) // 定时事件：5 / 10(fork点) / 30
  })
})

describe('M4-F4 多级分叉（孙线）', () => {
  it('孙线继承 = if1 ≤20 的自有 + main ≤10 的继承', () => {
    const view = visibleEventsFor(data(), 'if2')
    const titles = [...view.inherited.map((e) => e.title), ...view.own.map((e) => e.title)]
    expect(titles).toContain('事件@if1:15')   // 父线 if1 rank≤1（boundary=20 的 rank）
    expect(titles).toContain('事件@if1:20')   // fork 点
    expect(titles).not.toContain('事件@if1:40')
    expect(titles).toContain('事件@main:10')  // 祖先 main rank≤1（boundary=10 的 rank）
    expect(titles).not.toContain('事件@main:30')
    expect(titles).toContain('事件@if2:25')
  })

  it('worldlineDepth 层级正确', () => {
    const d = data()
    expect(worldlineDepth(d, 'main')).toBe(0)
    expect(worldlineDepth(d, 'if1')).toBe(1)
    expect(worldlineDepth(d, 'if2')).toBe(2)
  })
})

describe('M4-E2 分叉点失效容错', () => {
  it('fork 点事件被删 → forkBroken 标记，继承父线全部定时事件，不崩溃', () => {
    const d = data()
    // 删除 if1 的 fork 点 e-fork（用级联函数模拟）
    d.events = d.events.filter((e) => e.id !== 'e-fork')
    d.settings.worldlines.find((w) => w.id === 'if1')!.forkPointEventId = null
    const view = visibleEventsFor(d, 'if1')
    expect(view.forkBroken).toBe(false) // forkPointEventId 已置 null：无边界但语义明确（继承全部）
    expect(view.inherited.map((e) => e.title)).toContain('事件@main:30')
  })

  it('fork 点 id 悬空（未清理）→ forkBroken 且不崩溃', () => {
    const d = data()
    d.events = d.events.filter((e) => e.id !== 'e-fork')
    const view = visibleEventsFor(d, 'if1')
    expect(view.forkBroken).toBe(true)
    expect(view.inherited.length).toBeGreaterThan(0)
  })

  it('fork 点事件存在但无时间 → 视为失效，继承全部', () => {
    const d = data()
    const fork = d.events.find((e) => e.id === 'e-fork')!
    fork.time = null
    const view = visibleEventsFor(d, 'if1')
    expect(view.forkBroken).toBe(true)
    expect(view.inherited.map((e) => e.title)).toContain('事件@main:30')
  })
})

describe('M4 轨道集合', () => {
  it('allWorldlineViews 按 order 输出全部线视图', () => {
    const views = allWorldlineViews(data())
    expect(views.map((v) => v.worldlineId)).toEqual(['main', 'if1', 'if2'])
  })
})
