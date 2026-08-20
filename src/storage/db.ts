import Dexie, { type Table } from 'dexie'
import type { AssetMeta, Character, CodexEntry, ProjectMeta, ProjectSettings, Relation, Template, TimelineEvent } from '@/types'

// dexie 表结构与 §3.1 文件夹布局一一映射（DESIGN.md §3.2）
// characters/codex/events 的行 = 实体 + projectId（索引用）；zip 导出/内存态不含 projectId，由仓库层增删
export interface SettingsRow extends ProjectSettings { projectId: string }
export interface RelationsRow { projectId: string; relations: Relation[] }
export interface TemplatesRow { projectId: string; templates: Template[] }
export interface CharacterRow extends Character { projectId: string }
export interface CodexRow extends CodexEntry { projectId: string }
export interface EventRow extends TimelineEvent { projectId: string }
export interface AssetRow extends AssetMeta { blob: Blob }

export class WocDB extends Dexie {
  projects!: Table<ProjectMeta, string>
  settings!: Table<SettingsRow, string>
  relations!: Table<RelationsRow, string>
  templates!: Table<TemplatesRow, string>
  characters!: Table<CharacterRow, string>
  codex!: Table<CodexRow, string>
  events!: Table<EventRow, string>
  assets!: Table<AssetRow, string>

  constructor(name = 'world-oc-card') {
    super(name)
    this.version(1).stores({
      projects: 'id',
      settings: 'projectId',
      relations: 'projectId',
      templates: 'projectId',
      characters: 'id, projectId',
      codex: 'id, projectId',
      events: 'id, projectId',
      assets: 'id, projectId',
    })
  }
}

export const db = new WocDB()
