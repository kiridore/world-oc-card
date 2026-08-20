import { describe, it, expect } from 'vitest'
import { characterToMarkdown, projectToMarkdown } from '../src/utils/mdExport'
import { buildSnapshotHtml, buildSnapshotModel } from '../src/utils/snapshot'
import type { AssetMeta, ProjectData } from '../src/types'
import { builtinTemplates } from '../src/data/builtinTemplates'

function makeData(charCount = 2, eventCount = 3): ProjectData {
  return {
    meta: { id: 'p1', name: '快照测试项目', schemaVersion: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    settings: {
      calendars: [{ id: 'cal1', name: '通用纪年', offset: 0, unitYears: 1 }],
      relationTypes: [{ id: 'rt1', name: '亲属', color: '#7d9cb5', directed: false }],
      codexTypes: [{ id: 'ct1', key: 'location', name: '地点' }],
      worldlines: [
        { id: 'w1', name: '主世界线', parentWorldlineId: null, forkPointEventId: null, color: '#7d9cb5', status: 'active', order: 0 },
        { id: 'w2', name: 'IF 线', parentWorldlineId: 'w1', forkPointEventId: 'e0', color: '#8fae8b', status: 'active', order: 1 },
      ],
    },
    relations: [],
    templates: builtinTemplates(),
    characters: Array.from({ length: charCount }, (_, i) => ({
      id: `c${i}`, name: `角色${i}`, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      fieldBlocks: [
        { type: 'kv', title: '基本信息', items: [{ key: '年龄', value: '不详' }] },
        { type: 'text', title: '背景', content: '**幼年**流落 [王城](x)\n\n第二段' },
        { type: 'list', title: '标签', items: ['主角', '剑士'], flag: 'tags' as const },
        { type: 'image', title: '立绘', assetId: 'a1' },
        { type: 'table', title: '属性', header: ['项', '值'], rows: [['身高', '165']] },
        { type: 'link', title: '挚友', targetType: 'character' as const, targetId: 'c9' }, // 失效引用
        { type: 'group', title: '深层', children: [
          { type: 'text', title: '秘密', content: '身世成谜' },
        ] },
      ],
    })),
    codex: [
      { id: 'x1', typeId: 'ct1', name: '王城', content: '参见 [[苍之海]]', attributes: [{ key: '人口', value: '3 万' }], color: '#8fae8b' },
      { id: 'x2', typeId: 'ct1', name: '苍之海', content: '毗邻 [[王城]] 与 [[不存在之地]]', attributes: [], color: '#7fb3ae' },
    ],
    events: Array.from({ length: eventCount }, (_, i) => ({
      id: `e${i}`, worldlineId: 'w1', time: { calendarId: 'cal1', value: i * 10, display: `纪元 ${i * 10} 年` },
      title: `事件${i}`, description: '', participantIds: i === 0 ? ['c0'] : [], locationId: null,
      causalLinks: [], collapsed: false, locked: false,
    })),
  }
}

const assets: AssetMeta[] = [
  { id: 'a1', projectId: 'p1', ext: 'png', name: '立绘.png', mime: 'image/png', size: 1024 },
]

describe('M6-F2 角色 Markdown 导出', () => {
  it('覆盖全部块结构：分组→小节、kv→表格、表格块→MD 表格、图片→assets 引用、失效链接占位', () => {
    const d = makeData()
    const { md, usedAssets } = characterToMarkdown(d.characters[0], d, assets)
    expect(md).toContain('# 角色0')
    expect(md).toContain('## 基本信息')
    expect(md).toContain('| 键 | 值 |')
    expect(md).toContain('| 年龄 | 不详 |')
    expect(md).toContain('**幼年**')
    expect(md).toContain('`主角`')
    expect(md).toContain('![立绘](assets/a1.png)')
    expect(usedAssets.map((a) => a.id)).toEqual(['a1'])
    expect(md).toContain('| 项 | 值 |')
    expect(md).toContain('身高')
    expect(md).toContain('挚友：失效引用')
    expect(md).toContain('## 深层')
    expect(md).toContain('### 秘密')
    // 空白角色（M2-E3）
    const blank = characterToMarkdown({ ...d.characters[0], fieldBlocks: [] }, d, assets)
    expect(blank.md).toBe('# 角色0\n')
  })

  it('projectToMarkdown 汇总全部角色', () => {
    const md = projectToMarkdown(makeData(3), assets)
    expect(md).toContain('# 角色0')
    expect(md).toContain('# 角色2')
  })
})

describe('M6-F4 单文件 HTML 快照', () => {
  it('内联数据完整：角色/百科/时间线三模块数据均在', () => {
    const html = buildSnapshotHtml(makeData(), [{ meta: assets[0], dataUrl: 'data:image/png;base64,xxx' }])
    expect(html).toContain('快照测试项目')
    expect(html).toContain('角色0')
    expect(html).toContain('王城')
    expect(html).toContain('苍之海')
    expect(html).toContain('事件0')
    expect(html).toContain('纪元 0 年')
  })

  it('零外部请求（无 http src/href、无 link/script 外链）→ 断网 file:// 可用', () => {
    const html = buildSnapshotHtml(makeData(), [])
    expect(html).not.toMatch(/src\s*=\s*"http/)
    expect(html).not.toMatch(/href\s*=\s*"http/)
    expect(html).not.toMatch(/<link[^>]+href/)
    expect(html).not.toMatch(/url\(\s*['"]?http/)
  })

  it('双主题内联可切换', () => {
    const html = buildSnapshotHtml(makeData(), [])
    expect(html).toContain("data-theme='dark'")
    expect(html).toContain("data-theme='light'")
    expect(html).toContain('themeBtn')
  })

  it('失效引用占位（图片/链接/百科 [[不存在]]）', () => {
    const model = buildSnapshotModel(makeData(), [])
    expect(model.characters[0].blocks.some((b) => b.html.includes('失效引用'))).toBe(true)
    expect(model.codex.some((c) => c.html.includes('不存在之地'))).toBe(true)
  })

  it('fork 继承事件进入时间线模型（dim 标记）', () => {
    const d = makeData()
    d.events.push({ id: 'e9', worldlineId: 'w1', time: { calendarId: 'cal1', value: 999, display: '纪元 999 年' }, title: '主线后续', description: '', participantIds: [], locationId: null, causalLinks: [], collapsed: false, locked: false })
    const model = buildSnapshotModel(d, [])
    const ifLane = model.lanes.find((l) => l.name === 'IF 线')!
    expect(ifLane.events.some((e) => e.title === '事件0' && e.dim)).toBe(true)   // ≤ fork 点继承
    expect(ifLane.events.some((e) => e.title === '主线后续')).toBe(false)          // fork 后不出现
    expect(ifLane.events.some((e) => e.title === '事件1' && !e.dim)).toBe(false)  // w2 无自有事件
  })

  it('M6-E1 规模：50 角色 + 300 事件快照体积 < 10MB', () => {
    const d = makeData(50, 300)
    const html = buildSnapshotHtml(d, [])
    expect(html.length).toBeLessThan(10 * 1024 * 1024)
    expect(html.length).toBeGreaterThan(1000)
  })
})
