import { describe, it, expect } from 'vitest'
import { parseWith, characterSchema, fieldBlockSchema, eventSchema, settingsSchema, eventTimeSchema, legacyEventV2Schema, legacySettingsV2Schema } from '../src/schemas'
import type { Character, TimelineEvent } from '../src/types'

function sampleCharacter(): Character {
  return {
    id: 'c1',
    name: '测试角色',
    fieldBlocks: [
      { type: 'group', title: '基础', children: [
        { type: 'kv', title: '信息', items: [{ key: '年龄', value: '不详' }] },
        { type: 'list', title: '别名', items: ['小白'], flag: 'tags' },
        { type: 'group', title: '深层', children: [
          { type: 'group', title: '第三层', children: [{ type: 'text', title: '备注', content: '' }] },
        ] },
      ] },
      { type: 'table', title: '属性', header: ['项', '值'], rows: [['身高', '170']] },
      { type: 'link', title: '挚友', targetType: 'character', targetId: 'c2' },
      { type: 'image', title: '立绘', assetId: 'a1' },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

describe('M0-F3 FieldBlock 骨架校验', () => {
  it('七种块合法样例全部通过（含 group 嵌套 3 层）', () => {
    const r = parseWith(characterSchema, sampleCharacter())
    expect(r.ok).toBe(true)
  })

  it('未知块类型被拒绝', () => {
    const c = sampleCharacter()
    const group = c.fieldBlocks[0] as { type: 'group'; children: import('../src/types').FieldBlock[] }
    ;(group.children[0] as unknown as { type: string }).type = 'unknown'
    const r = parseWith(characterSchema, c)
    expect(r.ok).toBe(false)
  })

  it('group 嵌套非法（children 缺失）被拒绝', () => {
    const r = parseWith(fieldBlockSchema, { type: 'group', title: 'x' })
    expect(r.ok).toBe(false)
  })

  it('link 块引用格式非法被拒绝', () => {
    const r = parseWith(fieldBlockSchema, { type: 'link', title: 'x', targetType: 'galaxy', targetId: 'e1' })
    expect(r.ok).toBe(false)
  })
})

describe('M0-E1 非法数据拒绝且能定位字段路径', () => {
  it('缺 id / 缺 name 报错信息包含字段路径', () => {
    const c = sampleCharacter() as Partial<Character>
    delete c.id
    const r = parseWith(characterSchema, c)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('id')
  })

  it('畸形事件（未知字段）被拒绝并定位', () => {
    const e = {
      id: 'e1', worldlineId: 'w1', time: null, title: 't', description: '',
      participantIds: [], relatedCodexIds: [], rank: 0, manualPlaced: false,
      collapsed: false, locked: false, bogus: true,
    } as unknown as TimelineEvent
    const r = parseWith(eventSchema, e)
    expect(r.ok).toBe(false)
  })
})

describe('settings schema', () => {
  it('世界线合法样例通过', () => {
    const r = parseWith(settingsSchema, {
      relationTypes: [{ id: 'rt1', name: '亲属', color: '#7d9cb5', arrow: 'none' as const }],
      codexTypes: [{ id: 'ct1', key: 'location', name: '地点' }],
      worldlines: [{ id: 'w1', name: '主世界线', parentWorldlineId: null, forkPointEventId: null, color: '#7d9cb5', status: 'active', order: 0 }],
    })
    expect(r.ok).toBe(true)
  })
})

describe('v3 eventTimeSchema', () => {
  it('calendar 四段全空被拒绝；至少一字段通过', () => {
    const empty = parseWith(eventTimeSchema, { mode: 'calendar', era: '', year: '', month: '', day: '' })
    expect(empty.ok).toBe(false)
    const ok = parseWith(eventTimeSchema, { mode: 'calendar', era: '第三纪元', year: '217', month: '', day: '' })
    expect(ok.ok).toBe(true)
  })

  it('custom 空文本被拒绝', () => {
    expect(parseWith(eventTimeSchema, { mode: 'custom', text: '' }).ok).toBe(false)
    expect(parseWith(eventTimeSchema, { mode: 'custom', text: '黑暗时代' }).ok).toBe(true)
  })
})

describe('legacy 输入 schema', () => {
  it('legacyEventV2Schema 可解析 v2 旧事件形状', () => {
    const r = parseWith(legacyEventV2Schema, {
      id: 'e1', worldlineId: 'w1',
      time: { calendarId: 'cal1', value: 100, display: '纪元 100 年' },
      title: '建国', description: '',
      participantIds: ['c1'], locationId: 'x1', causalLinks: ['e2'],
      canvasPos: { x: 1, y: 2 }, collapsed: false, locked: false,
    })
    expect(r.ok).toBe(true)
  })

  it('legacySettingsV2Schema 可解析 v2 旧 settings（含 calendars）', () => {
    const r = parseWith(legacySettingsV2Schema, {
      calendars: [{ id: 'cal1', name: '第三纪元', offset: 0, unitYears: 1 }],
      relationTypes: [{ id: 'rt1', name: '亲属', color: '#7d9cb5', arrow: 'single' }],
      codexTypes: [{ id: 'ct1', key: 'location', name: '地点' }],
      worldlines: [{ id: 'w1', name: '主世界线', parentWorldlineId: null, forkPointEventId: null, color: '#7d9cb5', status: 'active', order: 0 }],
    })
    expect(r.ok).toBe(true)
  })
})
