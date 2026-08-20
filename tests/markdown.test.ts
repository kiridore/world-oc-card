import { describe, it, expect } from 'vitest'
import { preprocessCodexLinks, renderMarkdown, extractCodexLinks } from '../src/utils/markdown'

describe('M3-F2 [[..]] 双向链接语法', () => {
  it('[[名]] 转为带 data-codex-name 的链接', () => {
    const html = preprocessCodexLinks('参见 [[王城]] 与 [[苍之海]]')
    expect(html).toContain('data-codex-name="王城"')
    expect(html).toContain('data-codex-name="苍之海"')
    expect(html).toContain('>王城</a>')
  })

  it('失效引用占位弱化展示', () => {
    const html = preprocessCodexLinks('见 [[失效引用:王城]]')
    expect(html).toContain('class="broken-ref"')
    expect(html).not.toContain('data-codex-name')
  })

  it('正常 Markdown 渲染（表格/标题/加粗）', () => {
    const html = renderMarkdown('## 标题\n\n**粗体**\n\n| a | b |\n|---|---|\n| 1 | 2 |')
    expect(html).toContain('<h2>标题</h2>')
    expect(html).toContain('<strong>粗体</strong>')
    expect(html).toContain('<table>')
  })

  it('extractCodexLinks 提取去重且忽略失效占位', () => {
    expect(extractCodexLinks('[[王城]] 和 [[王城]] 与 [[失效引用:王城]]')).toEqual(['王城'])
  })
})
