// 模板系统纯逻辑（DESIGN.md §2.6）
import type { FieldBlock, Template, TemplateScope } from '@/types'
import { parseWith, templateFileSchema } from '@/schemas'
import { uuid, nowIso } from '@/utils/id'

export function cloneBlocks(blocks: FieldBlock[]): FieldBlock[] {
  return JSON.parse(JSON.stringify(blocks))
}

/** 保存模板时剥离内容、保留结构（M2-F5）：
 *  text.content='' / kv.value='' / list.items=[] / table.rows=[]；header 与标题保留；
 *  image/link 的引用 ID 因 schema 要求非空而保留原值（插入到缺引用的项目时显示失效引用占位）。 */
export function stripBlockValues(blocks: FieldBlock[]): FieldBlock[] {
  const walk = (bs: FieldBlock[]): FieldBlock[] =>
    bs.map((b) => {
      switch (b.type) {
        case 'group': return { ...b, children: walk(b.children) }
        case 'text': return { ...b, content: '' }
        case 'kv': return { ...b, items: b.items.map((i) => ({ key: i.key, value: '' })) }
        case 'list': return { type: 'list', title: b.title, items: [], flag: b.flag }
        case 'table': return { ...b, rows: [] }
        default: return { ...b }
      }
    })
  return walk(cloneBlocks(blocks))
}

export function makeTemplatePayload(blocks: FieldBlock[], keepValues: boolean) {
  return { fieldBlocks: keepValues ? cloneBlocks(blocks) : stripBlockValues(blocks) }
}

export function newTemplate(name: string, scope: TemplateScope, payload: Template['payload'], opts?: { codexTypeId?: string; builtin?: boolean }): Template {
  return { id: uuid(), name, scope, payload, codexTypeId: opts?.codexTypeId, builtin: opts?.builtin, createdAt: nowIso() }
}

/** 编辑中"从模板插入"：把模板块追加到当前卡尾部，不动已有内容（M2-F6） */
export function insertTemplateBlocks(current: FieldBlock[], tplBlocks: FieldBlock[]): FieldBlock[] {
  return [...current, ...cloneBlocks(tplBlocks)]
}

/** 单模板文件导入导出（M2-F8） */
export function serializeTemplateFile(tpl: Template): string {
  return JSON.stringify({ template: tpl }, null, 2)
}

export function parseTemplateFile(text: string): { ok: true; template: Template } | { ok: false; error: string } {
  let json: unknown
  try { json = JSON.parse(text) } catch { return { ok: false, error: '不是合法 JSON' } }
  const r = parseWith(templateFileSchema, json)
  if (!r.ok) return { ok: false, error: `模板校验失败：${r.error}` }
  return { ok: true, template: r.data.template }
}

/** 列表页全文搜索：序列化所有块的文本（M2-F3） */
export function serializeBlocksText(blocks: FieldBlock[]): string {
  const parts: string[] = []
  const walk = (bs: FieldBlock[]) => {
    for (const b of bs) {
      parts.push(b.title)
      if (b.type === 'group') walk(b.children)
      else if (b.type === 'kv') for (const i of b.items) parts.push(i.key, i.value)
      else if (b.type === 'text') parts.push(b.content)
      else if (b.type === 'list') parts.push(...b.items)
      else if (b.type === 'table') parts.push(...b.header, ...b.rows.flat())
    }
  }
  walk(blocks)
  return parts.join('\n')
}

/** 收集被标记为标签块的条目（M2-F4） */
export function collectTags(blocks: FieldBlock[]): string[] {
  const out: string[] = []
  const walk = (bs: FieldBlock[]) => {
    for (const b of bs) {
      if (b.type === 'group') walk(b.children)
      else if (b.type === 'list' && b.flag === 'tags') out.push(...b.items)
    }
  }
  walk(blocks)
  return out
}
