import { describe, it, expect } from 'vitest'
import {
  stripBlockValues, makeTemplatePayload, insertTemplateBlocks,
  serializeTemplateFile, parseTemplateFile, serializeBlocksText, collectTags, cloneBlocks,
} from '../src/utils/template'
import type { FieldBlock, Template } from '../src/types'

const blocks: FieldBlock[] = [
  { type: 'kv', title: '基本信息', items: [{ key: '年龄', value: '不详' }, { key: '性别', value: '女' }] },
  { type: 'text', title: '外貌', content: '银发红瞳' },
  { type: 'list', title: '标签', items: ['主角', '剑士'], flag: 'tags' },
  { type: 'group', title: '深层', children: [
    { type: 'text', title: '秘密', content: '身世成谜' },
  ] },
  { type: 'table', title: '属性', header: ['项', '值'], rows: [['身高', '165']] },
]

describe('M2-F5 模板保存（结构/值剥离）', () => {
  it('默认只留结构：值清空、键名标题保留', () => {
    const stripped = stripBlockValues(blocks)
    expect(stripped[0]).toMatchObject({ type: 'kv', title: '基本信息' })
    expect((stripped[0] as { items: { key: string; value: string }[] }).items).toEqual([
      { key: '年龄', value: '' }, { key: '性别', value: '' },
    ])
    expect((stripped[1] as { content: string }).content).toBe('')
    expect((stripped[2] as { items: string[] }).items).toEqual([])
    const group = stripped[3] as { children: FieldBlock[] }
    expect((group.children[0] as { content: string }).content).toBe('')
    expect((stripped[4] as { rows: string[][]; header: string[] }).header).toEqual(['项', '值'])
    expect((stripped[4] as { rows: string[][] }).rows).toEqual([])
  })

  it('不修改原数据（深拷贝）', () => {
    const original = JSON.parse(JSON.stringify(blocks))
    stripBlockValues(blocks)
    expect(blocks).toEqual(original)
  })

  it('keepValues=true 保留值', () => {
    const payload = makeTemplatePayload(blocks, true)
    expect(payload.fieldBlocks).toEqual(blocks)
  })

  it('两种产物均通过 zod 校验（templateFileSchema）', () => {
    for (const keep of [false, true]) {
      const tpl: Template = {
        id: 't1', name: '测试模板', scope: 'character',
        payload: makeTemplatePayload(blocks, keep), createdAt: '2026-01-01T00:00:00Z',
      }
      const parsed = parseTemplateFile(serializeTemplateFile(tpl))
      expect(parsed.ok).toBe(true)
    }
  })
})

describe('M2-F6 模板插入', () => {
  it('追加块且不动已有内容', () => {
    const current: FieldBlock[] = [{ type: 'text', title: '已有', content: '保留我' }]
    const merged = insertTemplateBlocks(current, blocks)
    expect(merged).toHaveLength(6)
    expect(merged[0]).toEqual({ type: 'text', title: '已有', content: '保留我' })
    expect(JSON.parse(JSON.stringify(merged[5]))).toEqual(blocks[4])
  })

  it('插入的是拷贝（改动模板源不影响角色）', () => {
    const current: FieldBlock[] = []
    const merged = insertTemplateBlocks(current, blocks)
    cloneBlocks(merged).splice(0)
    expect(blocks).toHaveLength(5)
  })
})

describe('M2-F8 单模板文件往返', () => {
  it('导出 → 导入 payload 深比较一致', () => {
    const tpl: Template = {
      id: 't9', name: '基础角色卡', scope: 'character', builtin: true,
      payload: makeTemplatePayload(blocks, false), createdAt: '2026-01-01T00:00:00Z',
    }
    const text = serializeTemplateFile(tpl)
    const parsed = parseTemplateFile(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.template.payload).toEqual(tpl.payload)
  })

  it('畸形文件被拒绝', () => {
    expect(parseTemplateFile('not json').ok).toBe(false)
    expect(parseTemplateFile('{"template":{"id":"x"}}').ok).toBe(false)
  })
})

describe('M2-F3/F4 全文搜索与标签块', () => {
  it('serializeBlocksText 覆盖全部块文本', () => {
    const text = serializeBlocksText(blocks)
    for (const needle of ['基本信息', '年龄', '不详', '银发红瞳', '主角', '深层', '秘密', '身世成谜', '属性', '身高', '165']) {
      expect(text).toContain(needle)
    }
  })

  it('collectTags 只收集标记 tags 的 list 块', () => {
    expect(collectTags(blocks)).toEqual(['主角', '剑士'])
    expect(collectTags([{ type: 'list', title: '别名', items: ['小白'] }])).toEqual([])
  })
})
