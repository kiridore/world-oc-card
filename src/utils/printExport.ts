// v2.4-F3：角色卡 Markdown → HTML → 打印（浏览器「另存为 PDF」）。双主题靠运行时收集 token 内联，不引入新依赖。
import { marked } from 'marked'
import type { AssetMeta, Character, ProjectData } from '@/types'
import { characterToMarkdown, type MdRenderOptions } from '@/utils/mdExport'

const TOKEN_NAMES = ['--bg', '--surface', '--text-1', '--text-2', '--text-3', '--border', '--accent-weak', '--font-serif', '--font-ui'] as const

export function collectPrintTokens(): Record<string, string> {
  const cs = getComputedStyle(document.documentElement)
  return Object.fromEntries(TOKEN_NAMES.map((n) => [n, cs.getPropertyValue(n).trim()]))
}

/** md 按 '\n## ' 切块，每块独立渲染并包 <section>（break-inside:avoid 的分页原子单元；### 子块留在父 section 内） */
export function characterToPrintHtml(
  c: Character,
  data: ProjectData,
  tokens: Record<string, string>,
  opts: MdRenderOptions = {},
  assets: AssetMeta[] = [],
): string {
  const { md } = characterToMarkdown(c, data, assets, opts)
  const chunks = md.split('\n## ')
  const header = marked.parse(chunks.shift() ?? '') as string
  const body = header + chunks.map((s) => `<section>${marked.parse('## ' + s) as string}</section>`).join('')
  const vars = Object.entries(tokens).map(([k, v]) => `${k}:${v}`).join(';')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${c.name}</title><style>
:root{${vars}}
@page{size:A4;margin:16mm}
body{background:var(--bg);color:var(--text-1);font-family:var(--font-ui);margin:0;padding:24px;line-height:1.8}
h1{font-family:var(--font-serif)}
img{max-width:100%;max-height:180mm;object-fit:contain}
table{border-collapse:collapse;width:100%}th,td{border:1px solid var(--border);padding:6px 10px}
h2,h3{border-bottom:1px solid var(--border);padding-bottom:4px}
section{break-inside:avoid}
</style></head><body>${body}</body></html>`
}

export function printHtml(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0'
  iframe.srcdoc = html
  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => iframe.remove(), 60_000) // ponytail: 简单延时清理；打印对话框阻塞时间不定，60s 兜底
  }
  document.body.appendChild(iframe)
}
