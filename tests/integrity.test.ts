import { describe, it, expect } from 'vitest'
import type { ProjectData } from '../src/types'

function data(): ProjectData {
  return {
    meta: { id: 'p1', name: '测试', schemaVersion: 3, createdAt: '', updatedAt: '' },
    settings: {
      relationTypes: [{ id: 'rt1', name: '亲属', color: '#7d9cb5', arrow: 'none' as const }],
      codexTypes: [
        { id: 'ct1', key: 'location', name: '地点' },
        { id: 'ct2', key: 'faction', name: '势力' },
      ],
      worldlines: [
        { id: 'w1', name: '主世界线', parentWorldlineId: null, forkPointEventId: null, color: '#7d9cb5', status: 'active', order: 0 },
        { id: 'w2', name: 'IF 线', parentWorldlineId: 'w1', forkPointEventId: 'e1', color: '#8fae8b', status: 'active', order: 1 },
        { id: 'w3', name: '孙线', parentWorldlineId: 'w2', forkPointEventId: 'e2', color: '#c2917f', status: 'active', order: 2 },
      ],
    },
    relations: [{ id: 'r1', from: 'c1', to: 'c2', typeId: 'rt1', description: '' }],
    templates: [],
    characters: [
      {
        id: 'c1', name: '甲', createdAt: '', updatedAt: '', fieldBlocks: [
          { type: 'link', title: '挚友', targetType: 'character', targetId: 'c2' },
          { type: 'link', title: '故乡', targetType: 'codexEntry', targetId: 'x1' },
          { type: 'link', title: '成名战', targetType: 'event', targetId: 'e1' },
          { type: 'image', title: '立绘', assetId: 'a1' },
        ],
      },
      {
        id: 'c2', name: '乙', createdAt: '', updatedAt: '', fieldBlocks: [
          { type: 'image', title: '头像', assetId: 'a2' },
        ],
      },
    ],
    codex: [
      { id: 'x1', typeId: 'ct1', name: '王城', content: '参见 [[苍之海]]', attributes: [], color: '#8fae8b' },
      { id: 'x2', typeId: 'ct1', name: '苍之海', content: '毗邻 [[王城]]', attributes: [], color: '#7fb3ae' },
      { id: 'x3', typeId: 'ct2', name: '赤焰军', content: '', attributes: [], color: '#c2917f' },
    ],
    events: [
      { id: 'e1', worldlineId: 'w1', time: { mode: 'calendar', era: '第三纪元', year: '10', month: '', day: '' }, title: '建国', description: '', participantIds: ['c1', 'x3'], relatedCodexIds: ['x1'], rank: 0, manualPlaced: false, collapsed: false, locked: false },
      { id: 'e2', worldlineId: 'w2', time: { mode: 'calendar', era: '第三纪元', year: '15', month: '', day: '' }, title: '政变', description: '', participantIds: [], relatedCodexIds: ['x2'], rank: 0, manualPlaced: false, collapsed: false, locked: false },
      { id: 'e3', worldlineId: null, time: null, title: '草稿事件', description: '', participantIds: [], relatedCodexIds: [], rank: 0, manualPlaced: false, collapsed: false, locked: false },
    ],
  }
}

import {
  characterReferences, codexReferences, eventReferences,
  removeCharacterCascade, removeCodexCascade, removeEventCascade, removeWorldlineCascade,
  scanBrokenReferences, findOrphanAssets,
} from '../src/utils/integrity'
import { codexNameUnique, findCodexByName } from '../src/utils/codex'

describe('M2-E1 角色引用与级联删除', () => {
  it('引用扫描：事件参与者/关系边/link 块全部命中', () => {
    const hits = characterReferences(data(), 'c2')
    expect(hits.map((h) => h.kind).sort()).toEqual(['link-block', 'relation'])
  })

  it('级联删除清理 participantIds / 关系边 / link 块', () => {
    const d = data()
    removeCharacterCascade(d, 'c2')
    expect(d.characters.map((c) => c.id)).toEqual(['c1'])
    expect(d.relations).toHaveLength(0)
    expect(d.characters[0].fieldBlocks.filter((b) => b.type === 'link')).toHaveLength(2) // 剩 codex 与 event 链接
  })
})

describe('M3-E2 百科引用与级联删除', () => {
  it('引用扫描：事件百科关联/事件参与者(势力)/[[链接]]/角色 link 块', () => {
    const hits = codexReferences(data(), 'x1')
    expect(hits.map((h) => h.kind).sort()).toEqual(['codex-link', 'event-related', 'link-block'])
  })

  it('势力条目被事件参与者引用 → event-participant 命中', () => {
    const hits = codexReferences(data(), 'x3')
    expect(hits.map((h) => h.kind)).toEqual(['event-participant'])
  })

  it('级联删除：relatedCodexIds 清除、[[名]] 转失效占位、link 块移除', () => {
    const d = data()
    removeCodexCascade(d, 'x1')
    expect(d.codex.map((c) => c.id)).toEqual(['x2', 'x3'])
    expect(d.events[0].relatedCodexIds).not.toContain('x1')
    expect(d.codex[0].content).toContain('[[失效引用:王城]]')
    expect(d.characters[0].fieldBlocks.filter((b) => b.type === 'link' && b.targetType === 'codexEntry')).toHaveLength(0)
  })

  it('级联删除势力条目：participantIds 一并清除', () => {
    const d = data()
    removeCodexCascade(d, 'x3')
    expect(d.events[0].participantIds).toEqual(['c1'])
  })
})

describe('M4-E1/E2 事件与世界线级联', () => {
  it('事件引用：fork 点与角色 link 块命中，不再有因果连线', () => {
    const hits = eventReferences(data(), 'e1')
    expect(hits.map((h) => h.kind).sort()).toEqual(['fork-point', 'link-block'])
  })

  it('删除事件：fork 点置失效但世界线保留（无因果清理）', () => {
    const d = data()
    removeEventCascade(d, 'e1')
    expect(d.events.map((e) => e.id)).toEqual(['e2', 'e3'])
    expect(d.settings.worldlines.find((w) => w.id === 'w2')!.forkPointEventId).toBeNull()
  })

  it('删除世界线：级联删除其事件与全部后代线；草稿（无世界线）不受牵连', () => {
    const d = data()
    removeWorldlineCascade(d, 'w1') // 主线被删（测试级联），w2/w3 均为后代
    expect(d.settings.worldlines).toHaveLength(0)
    expect(d.events.map((e) => e.id)).toEqual(['e3']) // e3 是草稿，不属于任何线
  })

  it('删除子线：不影响父线与其事件', () => {
    const d = data()
    removeWorldlineCascade(d, 'w2') // w3 是 w2 后代一并删除；w1 保留
    expect(d.settings.worldlines.map((w) => w.id)).toEqual(['w1'])
    expect(d.events.find((e) => e.id === 'e1')).toBeDefined()
    expect(d.events.find((e) => e.id === 'e2')).toBeUndefined()
    expect(d.events.find((e) => e.id === 'e3')).toBeDefined()
  })
})

describe('M7-F1 引用巡检', () => {
  it('草稿（worldlineId null）不报"所属世界线不存在"', () => {
    expect(scanBrokenReferences(data())).toHaveLength(0)
  })

  it('发现全部失效引用（非势力参与者/失效关联/世界线/类型/链接目标）', () => {
    const d = data()
    d.events[0].participantIds = ['c1', 'ghost', 'x1'] // ghost 不存在；x1 非势力类型
    d.events[1].relatedCodexIds = ['x1', 'ghost2'] // ghost2 不存在
    d.relations[0].typeId = 'rt-x' // 类型失效
    d.characters[0].fieldBlocks.push({ type: 'link', title: '幽灵', targetType: 'character', targetId: 'ghost' })
    const broken = scanBrokenReferences(d)
    const details = broken.map((b) => b.detail).join('\n')
    expect(details).toContain('ghost')
    expect(details).toContain('非势力条目')
    expect(details).toContain('百科关联 ghost2 不存在')
    expect(details).toContain('关系类型不存在')
    expect(details).toContain('链接目标不存在')
  })
})

describe('M7-F2 孤儿资产', () => {
  it('未被 image 块引用的资产被识别', () => {
    const d = data()
    const assets = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }]
    expect(findOrphanAssets(d, assets)).toEqual(['a3'])
  })
})

describe('M3-E1 名称全局唯一', () => {
  it('跨类型重名被拒绝；改名时排除自身', () => {
    const d = data()
    expect(codexNameUnique(d, '王城')).toBe(false)
    expect(codexNameUnique(d, '王城', 'x1')).toBe(true)
    expect(codexNameUnique(d, '新地名')).toBe(true)
  })

  it('findCodexByName 全局唯一解析无歧义', () => {
    const d = data()
    expect(findCodexByName(d, '王城')?.id).toBe('x1')
    expect(findCodexByName(d, '不存在')).toBeUndefined()
  })
})
