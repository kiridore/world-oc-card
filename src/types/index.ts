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

export interface RelationType { id: UUID; name: string; color: string; directed: boolean }

export interface Relation { id: UUID; from: UUID; to: UUID; typeId: UUID; description: string }

export interface Calendar {
  id: UUID
  name: string
  offset: number // 该历法 value=0 对应的绝对纪元数值
  unitYears: number // 1 单位 = 多少年（月历法为 1/12）
}

export interface Worldline {
  id: UUID
  name: string
  parentWorldlineId: UUID | null
  forkPointEventId: UUID | null
  color: string
  status: 'active' | 'abandoned'
  order: number
}

export interface EventTime { calendarId: UUID; value: number; display: string }

export interface TimelineEvent {
  id: UUID
  worldlineId: UUID
  time: EventTime | null // null = 未定时草稿（仅画布）
  title: string
  description: string
  participantIds: UUID[]
  locationId: UUID | null
  causalLinks: UUID[]
  canvasPos?: { x: number; y: number }
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
  calendars: Calendar[]
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

export const CURRENT_SCHEMA_VERSION = 1
