// Markdown 渲染 + [[条目名]] 双向链接（DESIGN.md §2.2）
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: false })

export interface CodexLinkHit { name: string; index: number }

/** [[名]] → <a class="codex-link" data-codex-name="名">名</a>；失效引用占位 [[失效引用:名]] 原样弱化展示 */
export function preprocessCodexLinks(md: string): string {
  return md.replace(/\[\[失效引用:([^\]]+)\]\]/g, '<span class="broken-ref">失效引用：$1</span>')
    .replace(/\[\[([^[\]]+)\]\]/g, (_m, name: string) => {
      const esc = String(name).replace(/"/g, '&quot;').replace(/</g, '&lt;')
      return `<a class="codex-link" data-codex-name="${esc}" href="javascript:void(0)">${esc}</a>`
    })
}

export function renderMarkdown(md: string): string {
  return marked.parse(preprocessCodexLinks(md ?? '')) as string
}

/** 提取正文中出现的 [[条目名]]（不含失效引用占位） */
export function extractCodexLinks(md: string): string[] {
  const out: string[] = []
  const re = /\[\[([^[\]]+)\]\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(md ?? ''))) {
    if (!m[1].startsWith('失效引用:') && !out.includes(m[1])) out.push(m[1])
  }
  return out
}
