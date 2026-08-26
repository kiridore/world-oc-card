import { describe, it, expect } from 'vitest'
import { sanitizeFilename, dedupeNames, yamlFront, codexToMarkdown, eventToMarkdown, buildWorkspaceZip } from '../src/utils/workspace'
import { unzipSync, strFromU8 } from 'fflate'
import type { ProjectData } from '../src/types'
import { builtinTemplates } from '../src/data/builtinTemplates'

function makeData(): ProjectData {
  return {
    meta: { id: 'p1', name: '工作区测试', schemaVersion: 3, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    settings: {
      relationTypes: [],
      codexTypes: [{ id: 'ct1', key: 'location', name: '地点' }, { id: 'ct2', key: 'faction', name: '势力' }],
      worldlines: [{ id: 'w1', name: '主世界线', parentWorldlineId: null, forkPointEventId: null, color: '#7d9cb5', status: 'active', order: 0 }],
    },
    relations: [],
    templates: builtinTemplates(),
    characters: [{ id: 'c0', name: '角色0', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', fieldBlocks: [] }],
    codex: [
      { id: 'x1', typeId: 'ct2', name: '王城', content: '参见 [[苍之海]]', attributes: [{ key: '人口', value: '3 万' }], color: '#8fae8b' },
      { id: 'x2', typeId: 'ct1', name: '苍之海', content: '毗邻 [[王城]]', attributes: [], color: '#7fb3ae' },
    ],
    events: [
      { id: 'e0', worldlineId: 'w1', time: { mode: 'calendar', era: '通用纪年', year: '217', month: '3', day: '' }, title: '建国', description: '描述正文', participantIds: ['c0'], relatedCodexIds: ['x1'], rank: 0, manualPlaced: false, collapsed: false, locked: false },
      { id: 'e1', worldlineId: null, time: null, title: '草稿事件', description: '', participantIds: [], relatedCodexIds: [], rank: 0, manualPlaced: false, collapsed: false, locked: false },
    ],
  }
}

describe('v2.4-F1 文件名工具', () => {
  it('非法字符替换 / 空名兜底', () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j')
    expect(sanitizeFilename('  名字 ')).toBe('名字')
    expect(sanitizeFilename('名字...')).toBe('名字')
    expect(sanitizeFilename('')).toBe('未命名')
  })
  it('重名去重：首个不变，后续加 -2/-3', () => {
    expect(dedupeNames(['王城', '苍之海', '王城', '王城'])).toEqual(['王城', '苍之海', '王城-2', '王城-3'])
  })
})

describe('v2.4-F1 frontmatter', () => {
  it('含 # / : 的值自动加引号；空值跳过；空对象输出空串', () => {
    expect(yamlFront({ color: '#8fae8b', time: '通用纪年 217 年 3 月', rank: '0' })).toBe(
      '---\ncolor: "#8fae8b"\ntime: 通用纪年 217 年 3 月\nrank: 0\n---\n',
    )
    expect(yamlFront({ a: '', b: undefined })).toBe('')
  })
})

describe('v2.4-F1 百科 → md', () => {
  it('frontmatter 含类型名与颜色；属性成表；[[链接]] 原样保留', () => {
    const md = codexToMarkdown(makeData().codex[0], '势力', true)
    expect(md.startsWith('---\n')).toBe(true)
    expect(md).toContain('type: 势力')
    expect(md).toContain('color: "#8fae8b"')
    expect(md).toContain('# 王城')
    expect(md).toContain('| 人口 | 3 万 |')
    expect(md).toContain('参见 [[苍之海]]')
  })
  it('frontmatter=false 时无 --- 头', () => {
    // 注：正文表格分隔行 | --- | --- | 本就含 ---，断言意图是「无 YAML frontmatter 头」
    expect(codexToMarkdown(makeData().codex[0], '势力', false).startsWith('---\n')).toBe(false)
  })
})

describe('v2.4-F1 事件 → md', () => {
  it('时间字段 = displayTime；参与者/关联百科成 [[双链]]；草稿事件 worldline 标草稿', () => {
    const d = makeData()
    const md = eventToMarkdown(d.events[0], d, true)
    expect(md).toContain('time: 通用纪年 217 年 3 月')
    expect(md).toContain('# 建国')
    expect(md).toContain('[[角色0]]')
    expect(md).toContain('[[王城]]')
    expect(md).toContain('描述正文')
    const draft = eventToMarkdown(d.events[1], d, true)
    expect(draft).toContain('worldline: 草稿')
    expect(draft).not.toContain('time:')
  })
})

describe('v2.4-F1 buildWorkspaceZip 整包', () => {
  const d = makeData()
  d.characters[0].fieldBlocks = [
    { type: 'image', title: '立绘', assetId: 'a1' },
    { type: 'link', title: '认识', targetType: 'character', targetId: 'c1' },
  ]
  d.characters.push({ id: 'c1', name: '角色0', createdAt: '', updatedAt: '', fieldBlocks: [] }) // 重名角色
  const assets = [{ meta: { id: 'a1', ext: 'png', name: '立绘.png', mime: 'image/png', size: 4 }, bytes: new Uint8Array([1, 2, 3, 4]) }]

  function unzip(z: Uint8Array): Record<string, string> {
    const files = unzipSync(z)
    return Object.fromEntries(Object.entries(files).map(([p, u8]) => [p, strFromU8(u8)]))
  }

  it('逐实体断言：文件名去重 / 图片相对路径 / [[链接]] / frontmatter 时间字段', () => {
    const files = unzip(buildWorkspaceZip(d, assets, { frontmatter: true }))
    expect(Object.keys(files).sort()).toEqual([
      'assets/a1.png', 'characters/角色0-2.md', 'characters/角色0.md', 'codex/王城.md', 'codex/苍之海.md', 'events/建国.md', 'events/草稿事件.md',
    ].sort())
    expect(files['characters/角色0.md']).toContain('![立绘](../assets/a1.png)')
    expect(files['characters/角色0.md']).toContain('- 认识：[[角色0]]') // 链接文本=实体原名；重名文件去重后双链落首个同名文件（ponytail 取舍）
    expect(files['events/建国.md']).toContain('time: 通用纪年 217 年 3 月')
    expect(files['codex/王城.md']).toContain('参见 [[苍之海]]')
  })

  it('读回校验：每个实体的 md 标题与关键内容可逐项还原', () => {
    const files = unzip(buildWorkspaceZip(d, assets, { frontmatter: true }))
    // 角色：标题 + 名字可从文件名还原
    const charFiles = Object.keys(files).filter((p) => p.startsWith('characters/'))
    for (const p of charFiles) {
      const c = d.characters.find((x) => p === `characters/${x.name}.md`) ?? d.characters.find((x) => p.startsWith(`characters/${x.name}`))
      expect(c).toBeTruthy()
      expect(files[p]).toContain(`# ${c!.name}`)
    }
    // 百科：标题 + 属性键值 + [[链接]] 全在
    expect(files['codex/王城.md']).toContain('# 王城')
    expect(files['codex/王城.md']).toContain('| 人口 | 3 万 |')
    // 事件：标题 + 参与者 + 描述
    expect(files['events/建国.md']).toContain('# 建国')
    expect(files['events/建国.md']).toContain('[[角色0]]')
    expect(files['events/建国.md']).toContain('描述正文')
  })

  it('frontmatter=false：无 --- 头；未引用资产不进包', () => {
    const files = unzip(buildWorkspaceZip(d, [...assets, { meta: { id: 'a9', ext: 'png', name: '孤儿.png', mime: 'image/png', size: 1 }, bytes: new Uint8Array([9]) }], { frontmatter: false }))
    expect(files['codex/王城.md'].startsWith('# 王城')).toBe(true)
    expect(Object.keys(files)).not.toContain('assets/a9.png')
  })
})
