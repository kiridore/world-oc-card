// 图表库（G6 / Vue Flow / 自研时间轴）颜色一律运行时读取 CSS token（G10），
// 主题切换时全应用无刷新换肤（G9）。
export function readToken(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v
}

export function chartColors(): Record<string, string> {
  return {
    bg: 'transparent',
    surface: readToken('--surface'),
    surface2: readToken('--surface-2'),
    text1: readToken('--text-1'),
    text2: readToken('--text-2'),
    text3: readToken('--text-3'),
    border: readToken('--border'),
    borderWeak: readToken('--border-weak'),
    accent: readToken('--accent'),
    accentText: readToken('--accent-text'),
    accentWeak: readToken('--accent-weak'),
  }
}
