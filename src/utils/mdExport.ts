// 角色卡 → Markdown（M6-F2）：覆盖全部块结构
import type { AssetMeta, Character, FieldBlock, ProjectData } from '@/types'

export interface MdExportResult { md: string; usedAssets: AssetMeta[] }

export interface MdRenderOptions {
  /** 图片引用路径（默认 assets/<id>.<ext>） */
  assetUrl?: (a: AssetMeta) => string
  /** 实体链接展示（默认纯名字；工作区导出传 [[名字]]） */
  linkText?: (name: string) => string
}

function blockToMd(b: FieldBlock, ctx: { assets: AssetMeta[]; resolveName: (b: FieldBlock) => string | null; assetUrl?: (a: AssetMeta) => string; linkText?: (name: string) => string }, depth: number, lines: string[], usedAssets: AssetMeta[]): void {
  const h = (level: number, text: string) => `${'#'.repeat(Math.min(level, 6))} ${text}`
  switch (b.type) {
    case 'group':
      lines.push('', h(depth, b.title || '分组'))
      for (const child of b.children) blockToMd(child, ctx, depth + 1, lines, usedAssets)
      break
    case 'kv':
      lines.push('', h(depth, b.title || '信息'))
      lines.push('| 键 | 值 |', '| --- | --- |')
      for (const i of b.items) lines.push(`| ${i.key} | ${i.value} |`)
      break
    case 'text':
      lines.push('', h(depth, b.title || '正文'))
      lines.push('', b.content)
      break
    case 'list':
      lines.push('', h(depth, b.title || '列表'))
      if (b.flag === 'tags') lines.push('', b.items.map((t) => `\`${t}\``).join(' '))
      else for (const i of b.items) lines.push(`- ${i}`)
      break
    case 'image': {
      lines.push('', h(depth, b.title || '图片'))
      const asset = ctx.assets.find((a) => a.id === b.assetId)
      if (asset) {
        usedAssets.push(asset)
        const url = ctx.assetUrl ? ctx.assetUrl(asset) : `assets/${asset.id}.${asset.ext}`
        lines.push('', `![${b.title || '图片'}](${url})`)
      } else {
        lines.push('', `> 图片（失效引用：${b.assetId}）`)
      }
      break
    }
    case 'table':
      lines.push('', h(depth, b.title || '表格'))
      lines.push('', `| ${b.header.join(' | ')} |`)
      lines.push('', `| ${b.header.map(() => '---').join(' | ')} |`)
      for (const row of b.rows) lines.push(`| ${row.join(' | ')} |`)
      break
    case 'link': {
      const name = ctx.resolveName(b)
      lines.push('', `- ${b.title}：${name === null ? '失效引用' : (ctx.linkText ? ctx.linkText(name) : name)}`)
      break
    }
  }
}

export function characterToMarkdown(c: Character, data: ProjectData, assets: AssetMeta[], opts: MdRenderOptions = {}): MdExportResult {
  const lines: string[] = [`# ${c.name}`]
  const usedAssets: AssetMeta[] = []
  const resolveName = (b: FieldBlock): string | null => {
    if (b.type !== 'link') return null
    if (b.targetType === 'character') return data.characters.find((x) => x.id === b.targetId)?.name ?? null
    if (b.targetType === 'codexEntry') return data.codex.find((x) => x.id === b.targetId)?.name ?? null
    return data.events.find((x) => x.id === b.targetId)?.title ?? null
  }
  for (const b of c.fieldBlocks) blockToMd(b, { assets, resolveName, assetUrl: opts.assetUrl, linkText: opts.linkText }, 2, lines, usedAssets)
  return { md: lines.join('\n') + '\n', usedAssets }
}

export function projectToMarkdown(data: ProjectData, assets: AssetMeta[]): string {
  const parts: string[] = [`# ${data.meta.name} · 角色集`, `> 导出于 ${new Date().toLocaleString('zh-CN')}`]
  for (const c of data.characters) {
    parts.push(characterToMarkdown(c, data, assets).md)
    parts.push('\n---\n')
  }
  return parts.join('\n')
}
