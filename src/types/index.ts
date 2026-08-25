// 全部实体类型（DESIGN.md §2–§3）。与 zod schema 一一对应。
export type UUID = string

export type FieldBlockFlag = 'tags'

export type FieldBlock =
  | { type: 'group'; title: string; children: FieldBlock[] }
  | { type: 'kv'; title: string; items: { key: string; value: string }[] }
  | { type: 'text'; title: string; content: string }
  | { type: 'list'; title: string; items: string[]; flag?: FieldBlockFlag }
  | { type: 'image'; title: string; assetId: UUID }
  | { type: 'table'; title: string; header: string[]; rows: string[][] }
  | { type: 'link'; title: string; targetType: 'character' | 'codexEntry' | 'event'; targetId: UUID }

export interface Character {
  id: UUID
  name: string
  fieldBlocks: FieldBlock[]
  createdAt: string
  updatedAt: string
}

export type CodexBuiltinType = 'location' | 'faction' | 'race' | 'item' | 'system' | 'free'
export interface CodexType { id: UUID; key: CodexBuiltinType | string; name: string }

export interface CodexEntry {
  id: UUID
  typeId: UUID
  name: string // 项目内全局唯一（附录 A1）
  content: string // Markdown，支持 [[条目名]]
  attributes: { key: string; value: string }[]
  color: string
}

export type RelationArrow = 'none' | 'single' | 'double'
export interface RelationType { id: UUID; name: string; color: string; arrow: RelationArrow }

export interface Relation { id: UUID; from: UUID; to: UUID; typeId: UUID; description: string }

export interface Worldline {
  id: UUID
  name: string
  parentWorldlineId: UUID | null
  forkPointEventId: UUID | null
  color: string
  status: 'active' | 'abandoned'
  order: number
}

export type EventTime =
  | { mode: 'calendar'; era: string; year: string; month: string; day: string }
  | { mode: 'custom'; text: string }

export interface TimelineEvent {
  id: UUID
  worldlineId: UUID | null      // null = 草稿（未定时，不进任何世界线）
  time: EventTime | null        // null = 未定时草稿
  title: string
  description: string
  participantIds: UUID[]        // 角色 + 百科势力条目，合并一列
  relatedCodexIds: UUID[]       // 通用百科关联（取代 locationId）
  rank: number                  // 世界线内 0..n-1，顺序唯一真源
  manualPlaced: boolean         // 此事件位置曾被人为拖拽放置
  collapsed: boolean
  locked: boolean
}

export type TemplateScope = 'character' | 'codex'
export interface Template {
  id: UUID
  name: string
  scope: TemplateScope
  codexTypeId?: UUID
  payload:
    | { fieldBlocks: FieldBlock[] }
    | { attributeKeys: string[]; contentSkeleton?: string }
  builtin?: boolean
  createdAt: string
}

export interface ProjectStats {
  characters: number
  codex: number
  events: number
  worldlines: number
  relations: number
}

export interface ProjectMeta {
  id: UUID
  name: string
  schemaVersion: number
  createdAt: string
  updatedAt: string
  stats?: ProjectStats
}

export interface ProjectSettings {
  relationTypes: RelationType[]
  codexTypes: CodexType[]
  worldlines: Worldline[]
}

export interface ProjectData {
  meta: ProjectMeta
  settings: ProjectSettings
  relations: Relation[]
  templates: Template[]
  characters: Character[]
  codex: CodexEntry[]
  events: TimelineEvent[]
}

export interface AssetMeta { id: UUID; projectId: UUID; ext: string; name: string; mime: string; size: number }

export const CURRENT_SCHEMA_VERSION = 3
