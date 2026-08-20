import type { AssetMeta, ProjectData, ProjectMeta } from '@/types'

// 存储抽象层（DESIGN.md §4）：V1 LocalRepository(dexie)，V2 只新增 RemoteRepository
export type EntityKind = 'meta' | 'settings' | 'relations' | 'templates' | 'character' | 'codex' | 'event'
export interface EntityRef { kind: EntityKind; id?: string }

export interface LoadedProject {
  data: ProjectData
  assets: AssetMeta[]
}

export interface Repository {
  listProjects(): Promise<ProjectMeta[]>
  createProject(name: string, data: ProjectData): Promise<void>
  deleteProject(id: string): Promise<void>
  loadProject(id: string): Promise<LoadedProject | null>
  /** 只写脏实体（M1-F4）；同时更新 meta.updatedAt 与统计 */
  saveEntities(projectId: string, data: ProjectData, dirty: EntityRef[]): Promise<void>
  saveAsset(asset: AssetMeta, blob: Blob): Promise<void>
  loadAssetBlob(id: string): Promise<Blob | null>
  deleteAssets(ids: string[]): Promise<void>
  exportZip(id: string): Promise<Blob>
  /** mode: overwrite=同 id 覆盖；copy=同 id 时另存副本（重生成 id） */
  importZip(file: Blob, mode: 'overwrite' | 'copy'): Promise<{ meta: ProjectMeta; warnings: string[] }>
}
