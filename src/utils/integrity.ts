// 引用完整性（G5/M2-E1/M3-E2/M4-E2/M7-F1）：
// 删除前扫描引用；级联清理；巡检列出全部失效引用。
import type { FieldBlock, ProjectData, TimelineEvent } from '@/types'

export interface RefHit {
  kind: 'event-participant' | 'relation' | 'link-block' | 'event-related' | 'codex-link' | 'fork-point'
  /** 引用发生的位置描述（UI 展示用） */
  where: string
  id: string
}

/** 势力条目 id 集合：codexTypes 中 key==='faction' 的类型下辖条目 */
function factionIds(data: ProjectData): Set<string> {
  const factionTypeIds = new Set(data.settings.codexTypes.filter((t) => t.key === 'faction').map((t) => t.id))
  return new Set(data.codex.filter((c) => factionTypeIds.has(c.typeId)).map((c) => c.id))
}

function walkBlocks(blocks: FieldBlock[], fn: (b: FieldBlock, path: number[]) => void, path: number[] = []): void {
  blocks.forEach((b, i) => {
    fn(b, [...path, i])
    if (b.type === 'group') walkBlocks(b.children, fn, [...path, i])
  })
}

/** 谁引用了这个角色 */
export function characterReferences(data: ProjectData, characterId: string): RefHit[] {
  const hits: RefHit[] = []
  for (const e of data.events) {
    if (e.participantIds.includes(characterId)) {
      hits.push({ kind: 'event-participant', where: `事件「${e.title}」的参与者`, id: e.id })
    }
  }
  for (const r of data.relations) {
    if (r.from === characterId || r.to === characterId) {
      hits.push({ kind: 'relation', where: `关系边「${r.id}」`, id: r.id })
    }
  }
  for (const c of data.characters) {
    walkBlocks(c.fieldBlocks, (b, path) => {
      if (b.type === 'link' && b.targetType === 'character' && b.targetId === characterId) {
        hits.push({ kind: 'link-block', where: `角色「${c.name}」的字段块（第 ${path.join('.')} 块）`, id: c.id })
      }
    })
  }
  return hits
}

/** 谁引用了这个百科条目 */
export function codexReferences(data: ProjectData, entryId: string): RefHit[] {
  const hits: RefHit[] = []
  const entry = data.codex.find((c) => c.id === entryId)
  const name = entry?.name ?? entryId
  for (const e of data.events) {
    if (e.participantIds.includes(entryId)) {
      hits.push({ kind: 'event-participant', where: `事件「${e.title}」的参与者`, id: e.id })
    }
    if (e.relatedCodexIds.includes(entryId)) {
      hits.push({ kind: 'event-related', where: `事件「${e.title}」的百科关联`, id: e.id })
    }
  }
  for (const c of data.codex) {
    if (c.id !== entryId && c.content.includes(`[[${name}]]`)) {
      hits.push({ kind: 'codex-link', where: `条目「${c.name}」正文的 [[${name}]]`, id: c.id })
    }
  }
  for (const ch of data.characters) {
    walkBlocks(ch.fieldBlocks, (b, path) => {
      if (b.type === 'link' && b.targetType === 'codexEntry' && b.targetId === entryId) {
        hits.push({ kind: 'link-block', where: `角色「${ch.name}」的字段块（第 ${path.join('.')} 块）`, id: ch.id })
      }
    })
  }
  return hits
}

/** 谁引用了这个事件 */
export function eventReferences(data: ProjectData, eventId: string): RefHit[] {
  const hits: RefHit[] = []
  for (const w of data.settings.worldlines) {
    if (w.forkPointEventId === eventId) {
      hits.push({ kind: 'fork-point', where: `世界线「${w.name}」的分叉点（删除后该线标记分叉点失效）`, id: w.id })
    }
  }
  for (const ch of data.characters) {
    walkBlocks(ch.fieldBlocks, (b, path) => {
      if (b.type === 'link' && b.targetType === 'event' && b.targetId === eventId) {
        hits.push({ kind: 'link-block', where: `角色「${ch.name}」的字段块（第 ${path.join('.')} 块）`, id: ch.id })
      }
    })
  }
  return hits
}

/** 级联删除角色（M2-E1）：清 participantIds / 关系边 / link 块 */
export function removeCharacterCascade(data: ProjectData, characterId: string): void {
  for (const e of data.events) {
    if (e.participantIds.includes(characterId)) {
      e.participantIds = e.participantIds.filter((p) => p !== characterId)
    }
  }
  data.relations = data.relations.filter((r) => r.from !== characterId && r.to !== characterId)
  for (const c of data.characters) {
    if (c.id === characterId) continue
    const strip = (blocks: FieldBlock[]): FieldBlock[] =>
      blocks
        .filter((b) => !(b.type === 'link' && b.targetType === 'character' && b.targetId === characterId))
        .map((b) => (b.type === 'group' ? { ...b, children: strip(b.children) } : b))
    c.fieldBlocks = strip(c.fieldBlocks)
  }
  data.characters = data.characters.filter((c) => c.id !== characterId)
}

/** 级联删除百科条目（M3-E2）：清事件参与者/百科关联 / [[名]] 链接转占位 / link 块 */
export function removeCodexCascade(data: ProjectData, entryId: string): void {
  const name = data.codex.find((c) => c.id === entryId)?.name ?? ''
  for (const e of data.events) {
    e.participantIds = e.participantIds.filter((p) => p !== entryId)
    e.relatedCodexIds = e.relatedCodexIds.filter((r) => r !== entryId)
  }
  for (const c of data.codex) {
    if (c.id === entryId) continue
    if (name && c.content.includes(`[[${name}]]`)) {
      c.content = c.content.split(`[[${name}]]`).join(`[[失效引用:${name}]]`)
    }
  }
  for (const ch of data.characters) {
    const strip = (blocks: FieldBlock[]): FieldBlock[] =>
      blocks
        .filter((b) => !(b.type === 'link' && b.targetType === 'codexEntry' && b.targetId === entryId))
        .map((b) => (b.type === 'group' ? { ...b, children: strip(b.children) } : b))
    ch.fieldBlocks = strip(ch.fieldBlocks)
  }
  data.codex = data.codex.filter((c) => c.id !== entryId)
}

/** 级联删除事件（M4）：fork 点置失效（世界线保留，forkPointEventId=null）*/
export function removeEventCascade(data: ProjectData, eventId: string): void {
  for (const w of data.settings.worldlines) {
    if (w.forkPointEventId === eventId) w.forkPointEventId = null
  }
  for (const ch of data.characters) {
    const strip = (blocks: FieldBlock[]): FieldBlock[] =>
      blocks
        .filter((b) => !(b.type === 'link' && b.targetType === 'event' && b.targetId === eventId))
        .map((b) => (b.type === 'group' ? { ...b, children: strip(b.children) } : b))
    ch.fieldBlocks = strip(ch.fieldBlocks)
  }
  data.events = data.events.filter((e) => e.id !== eventId)
}

/** 级联删除世界线（M4-E1）：其全部事件与以它为父的子线的父引用一并处理 */
export function removeWorldlineCascade(data: ProjectData, worldlineId: string): void {
  const ids = new Set<string>([worldlineId])
  let grew = true
  while (grew) {
    grew = false
    for (const w of data.settings.worldlines) {
      if (w.parentWorldlineId && ids.has(w.parentWorldlineId) && !ids.has(w.id)) { ids.add(w.id); grew = true }
    }
  }
  data.events = data.events.filter((e) => !e.worldlineId || !ids.has(e.worldlineId))
  for (const w of data.settings.worldlines) {
    if (w.parentWorldlineId && ids.has(w.parentWorldlineId)) w.parentWorldlineId = null
  }
  data.settings.worldlines = data.settings.worldlines.filter((w) => !ids.has(w.id))
}

/** 全局巡检（M7-F1）：所有失效引用 */
export interface BrokenRef {
  type: string
  where: string
  detail: string
}

export function scanBrokenReferences(data: ProjectData): BrokenRef[] {
  const out: BrokenRef[] = []
  const charIds = new Set(data.characters.map((c) => c.id))
  const codexIds = new Set(data.codex.map((c) => c.id))
  const eventIds = new Set(data.events.map((e) => e.id))
  const worldlineIds = new Set(data.settings.worldlines.map((w) => w.id))
  const relationTypeIds = new Set(data.settings.relationTypes.map((t) => t.id))

  const factions = factionIds(data)
  for (const e of data.events as TimelineEvent[]) {
    if (e.worldlineId && !worldlineIds.has(e.worldlineId)) out.push({ type: '事件', where: `事件「${e.title}」`, detail: '所属世界线不存在' })
    for (const p of e.participantIds) {
      if (!charIds.has(p) && !factions.has(p)) out.push({ type: '事件', where: `事件「${e.title}」`, detail: `参与者 ${p} 不存在或非势力条目` })
    }
    for (const r of e.relatedCodexIds) if (!codexIds.has(r)) out.push({ type: '事件', where: `事件「${e.title}」`, detail: `百科关联 ${r} 不存在` })
  }
  for (const r of data.relations) {
    if (!charIds.has(r.from) || !charIds.has(r.to)) out.push({ type: '关系', where: `关系边「${r.id}」`, detail: '端点角色不存在' })
    if (!relationTypeIds.has(r.typeId)) out.push({ type: '关系', where: `关系边「${r.id}」`, detail: '关系类型不存在' })
  }
  for (const w of data.settings.worldlines) {
    if (w.parentWorldlineId && !worldlineIds.has(w.parentWorldlineId)) out.push({ type: '世界线', where: `世界线「${w.name}」`, detail: '父世界线不存在' })
    if (w.forkPointEventId && !eventIds.has(w.forkPointEventId)) out.push({ type: '世界线', where: `世界线「${w.name}」`, detail: '分叉点事件不存在（分叉点失效）' })
  }
  for (const ch of data.characters) {
    walkBlocks(ch.fieldBlocks, (b, path) => {
      if (b.type !== 'link') return
      const ok = b.targetType === 'character' ? charIds.has(b.targetId)
        : b.targetType === 'codexEntry' ? codexIds.has(b.targetId)
        : eventIds.has(b.targetId)
      if (!ok) out.push({ type: '角色字段', where: `角色「${ch.name}」第 ${path.join('.')} 块`, detail: `${b.title}：链接目标不存在` })
    })
  }
  return out
}

/** 孤儿资产（M7-F2）：未被任何 image 块引用的 assets */
export function findOrphanAssets(data: ProjectData, assets: { id: string }[]): string[] {
  const used = new Set<string>()
  for (const c of data.characters) {
    walkBlocks(c.fieldBlocks, (b) => {
      if (b.type === 'image') used.add(b.assetId)
    })
  }
  return assets.filter((a) => !used.has(a.id)).map((a) => a.id)
}
