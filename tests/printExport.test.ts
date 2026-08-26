import { describe, it, expect } from 'vitest'
import { characterToPrintHtml } from '../src/utils/printExport'
import type { AssetMeta, ProjectData } from '../src/types'
import { builtinTemplates } from '../src/data/builtinTemplates'

// 底座同 tests/workspace.test.ts，c0 为全块型角色（标题集合与 brief Step 1 断言一致）
function makeData(): ProjectData {
  return {
    meta: { id: 'p1', name: '打印测试项目', schemaVersion: 3, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    settings: {
      relationTypes: [],
      codexTypes: [{ id: 'ct1', key: 'location', name: '地点' }],
      worldlines: [{ id: 'w1', name: '主世界线', parentWorldlineId: null, forkPointEventId: null, color: '#7d9cb5', status: 'active', order: 0 }],
    },
    relations: [],
    templates: builtinTemplates(),
    characters: [{
      id: 'c0', name: '角色0', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      fieldBlocks: [
        { type: 'kv', title: '基本信息', items: [{ key: '年龄', value: '不详' }] },
        { type: 'text', title: '背景', content: '**幼年**流落 [王城](x)\n\n第二段' },
        { type: 'list', title: '标签', items: ['主角', '剑士'], flag: 'tags' },
        { type: 'image', title: '立绘', assetId: 'a1' },
        { type: 'table', title: '属性', header: ['项', '值'], rows: [['身高', '165']] },
        { type: 'link', title: '挚友', targetType: 'character', targetId: 'c9' }, // 失效引用
        { type: 'group', title: '深层', children: [
          { type: 'text', title: '秘密', content: '身世成谜' },
        ] },
      ],
    }],
    codex: [],
    events: [],
  }
}

const assets: AssetMeta[] = [
  { id: 'a1', projectId: 'p1', ext: 'png', name: '立绘.png', mime: 'image/png', size: 1024 },
]

const TOKENS = { '--bg': '#fff', '--surface': '#fafafa', '--text-1': '#222', '--text-2': '#555', '--text-3': '#888', '--border': '#ddd', '--accent-weak': '#eee', '--font-serif': 'serif', '--font-ui': 'sans-serif' }

describe('v2.4-F3 角色卡打印 HTML', () => {
  it('包含全部块标题与内容（无截断）+ 打印分页规则 + 双主题 token 内联', () => {
    const d = makeData()
    const html = characterToPrintHtml(d.characters[0], d, TOKENS)
    expect(html).toContain('<!DOCTYPE html>')
    for (const t of ['基本信息', '背景', '标签', '立绘', '属性', '挚友', '深层']) expect(html).toContain(t)
    expect(html).toContain('**幼年**'.replace(/\*\*/g, '')) // marked 渲染后 <strong>幼年</strong> 或纯文本，标题级断言即可
    expect(html).toMatch(/break-inside:\s*avoid/)
    expect(html).toContain('@page')
    for (const v of Object.values(TOKENS)) expect(html).toContain(v)
  })

  it('每个 ## 块包 <section>（分页原子单元）；失效图片引用走占位', () => {
    const d = makeData()
    const html = characterToPrintHtml(d.characters[0], d, TOKENS)
    expect((html.match(/<section>/g) ?? []).length).toBe(6) // 6 个带标题 depth-2 块（link 块无标题，并入前块 section）
    expect(html).toContain('</section>')
    expect(html).toContain('失效引用：a1') // 未传 assets → 占位（预检裁定：纯函数测试不测图）
  })

  it('opts.assetUrl 透传：URL 指定图片引用；返回 null 走失效占位', () => {
    const d = makeData()
    const html = characterToPrintHtml(d.characters[0], d, TOKENS, { assetUrl: (a) => `blob:${a.id}` }, assets)
    expect(html).toContain('src="blob:a1"')
    const ph = characterToPrintHtml(d.characters[0], d, TOKENS, { assetUrl: () => null }, assets)
    expect(ph).toContain('失效引用：a1')
    expect(ph).not.toContain('src="blob:')
  })
})
