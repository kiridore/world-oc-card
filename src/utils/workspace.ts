// v2.4-F1 Markdown 工作区导出：实体 → 可被 Obsidian/Typora/VS Code 打开的纯文本工作区。
// 不触碰 zip.ts 的项目格式（§3.1）；本文件只做「导出」，导回仍走 zip。
import type { Character, CodexEntry, ProjectData, TimelineEvent } from '@/types'
import { displayTime } from '@/utils/branchOrder'
import { characterToMarkdown, type MdRenderOptions } from '@/utils/mdExport'
import type { ZipAsset } from '@/storage/zip'
import { zipSync, strToU8 } from 'fflate'

/** Windows/Obsidian 双非法字符统一替换；空名兜底「未命名」 */
export function sanitizeFilename(name: string): string {
  const s = name.replace(/[\\/:*?"<>|#^]/g, '_').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '')
  return s || '未命名'
}

/** 重名自动 -2/-3 后缀（百科名项目内已唯一，角色/事件名不保证） */
// ponytail: 与既有字面名「名字-2」碰撞时不检测，重名实体罕见，接受
export function dedupeNames(names: string[]): string[] {
  const used = new Map<string, number>()
  return names.map((n) => {
    const c = used.get(n) ?? 0
    used.set(n, c + 1)
    return c === 0 ? n : `${n}-${c + 1}`
  })
}

/** 极简 YAML frontmatter：值含 # 或 : 时 JSON 引号包裹；空值字段跳过；全空返回空串 */
export function yamlFront(fields: Record<string, string | undefined>): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${/[:#]/.test(v!) ? JSON.stringify(v) : v}`)
  return lines.length ? `---\n${lines.join('\n')}\n---\n` : ''
}

export function codexToMarkdown(e: CodexEntry, typeName: string, frontmatter: boolean): string {
  const lines: string[] = [`# ${e.name}`]
  if (e.attributes.length) {
    lines.push('', '| 属性 | 值 |', '| --- | --- |')
    for (const a of e.attributes) lines.push(`| ${a.key} | ${a.value} |`)
  }
  if (e.content) lines.push('', e.content)
  const fm = frontmatter ? yamlFront({ type: typeName, color: e.color }) : ''
  return `${fm ? fm + '\n' : ''}${lines.join('\n')}\n`
}

export function eventToMarkdown(ev: TimelineEvent, data: ProjectData, frontmatter: boolean): string {
  const wl = data.settings.worldlines.find((w) => w.id === ev.worldlineId)
  const lines: string[] = [`# ${ev.title}`]
  const charName = (id: string) => data.characters.find((c) => c.id === id)?.name ?? null
  const codexName = (id: string) => data.codex.find((x) => x.id === id)?.name ?? null
  const ps = ev.participantIds.map((id) => charName(id) ?? codexName(id)).filter((n): n is string => n !== null)
  if (ps.length) lines.push('', `参与者：${ps.map((n) => `[[${n}]]`).join('、')}`)
  const cs = ev.relatedCodexIds.map(codexName).filter((n): n is string => n !== null)
  if (cs.length) lines.push('', `关联百科：${cs.map((n) => `[[${n}]]`).join('、')}`)
  if (ev.description) lines.push('', ev.description)
  const fm = frontmatter ? yamlFront({
    type: 'event',
    time: displayTime(ev.time) || undefined,
    worldline: wl?.name ?? '草稿',
    rank: String(ev.rank),
  }) : ''
  return `${fm ? fm + '\n' : ''}${lines.join('\n')}\n`
}

export interface WorkspaceOptions { frontmatter: boolean }

/** 整包工作区 zip：characters/codex/events 三文件夹 + 仅被引用的 assets；解压即纯文本工作区 */
export function buildWorkspaceZip(data: ProjectData, assets: ZipAsset[], opts: WorkspaceOptions): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  const typeName = (typeId: string) => data.settings.codexTypes.find((t) => t.id === typeId)?.name ?? '未分类'

  const charNames = dedupeNames(data.characters.map((c) => sanitizeFilename(c.name)))
  const render: MdRenderOptions = {
    assetUrl: (a) => `../assets/${a.id}.${a.ext}`,
    linkText: (n) => `[[${n}]]`,
  }
  // ponytail: [[名字]] 按 Obsidian basename 解析；重名被去重为 名字-2 后，指向首个同名文件的链接会落到 -1 文件，重名角色罕见，接受
  const usedAssetIds = new Set<string>()
  data.characters.forEach((c: Character, i: number) => {
    const fm = opts.frontmatter ? yamlFront({ type: 'character' }) : ''
    // ZipAsset.meta 无 projectId；补齐内存对象供 usedAssets 匹配（不落库）
    const { md, usedAssets } = characterToMarkdown(c, data, assets.map((a) => ({ ...a.meta, projectId: data.meta.id })), render)
    for (const a of usedAssets) usedAssetIds.add(a.id)
    entries[`characters/${charNames[i]}.md`] = strToU8(fm + md)
  })

  const codexNames = dedupeNames(data.codex.map((e) => sanitizeFilename(e.name)))
  data.codex.forEach((e, i) => { entries[`codex/${codexNames[i]}.md`] = strToU8(codexToMarkdown(e, typeName(e.typeId), opts.frontmatter)) })

  const evNames = dedupeNames(data.events.map((e) => sanitizeFilename(e.title)))
  data.events.forEach((e, i) => { entries[`events/${evNames[i]}.md`] = strToU8(eventToMarkdown(e, data, opts.frontmatter)) })

  for (const a of assets) if (usedAssetIds.has(a.meta.id)) entries[`assets/${a.meta.id}.${a.meta.ext}`] = a.bytes
  return zipSync(entries, { level: 6 })
}
