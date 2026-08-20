// 数据语义色（DESIGN.md §5.4）：12 色低饱和调色板（莫兰迪倾向），
// 供世界线 / 关系类型 / 条目标识色使用——chrome 色饱和度纪律不适用于此文件。
// resolveDataColor() 按主题自动加深/提亮，保证两主题下与背景对比度 ≥ 3:1（G11/M4-S1）。

export const DATA_PALETTE: string[] = [
  '#7d9cb5', // 石青
  '#8fae8b', // 灰绿
  '#c2917f', // 陶土
  '#a292c0', // 雾紫
  '#c0a97e', // 沙金
  '#7fb3ae', // 青瓷
  '#b57f9a', // 灰玫
  '#93a7c4', // 雾蓝
  '#adad8a', // 橄榄
  '#8c8f9e', // 岩灰
  '#bf9a86', // 赭石
  '#79a3b8', // 黛蓝
]

export type ThemeName = 'dark' | 'light'

// 与 tokens.css 的 --surface 保持一致（数据色渲染所在背景）
export const THEME_BG: Record<ThemeName, string> = { dark: '#1e2024', light: '#f4f5f6' }

export function palettePick(index: number): string {
  return DATA_PALETTE[((index % DATA_PALETTE.length) + DATA_PALETTE.length) % DATA_PALETTE.length]
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

function mix(hex: string, target: [number, number, number], amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r + (target[0] - r) * amount, g + (target[1] - g) * amount, b + (target[2] - b) * amount)
}

function srgbChannel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

export function contrastOnThemes(hex: string): { dark: number; light: number } {
  return {
    dark: contrastRatio(hex, THEME_BG.dark),
    light: contrastRatio(hex, THEME_BG.light),
  }
}

const MAX_MIX = 0.6

// 按主题解析数据色的最终呈现色：不足 3:1 时向白（暗主题）/黑（亮主题）混合微调，
// 保色相的同时满足对比度；混合到上限仍不足则返回能达到的最佳值（供 UI 警告）。
export function resolveDataColor(hex: string, theme: ThemeName): string {
  const bg = THEME_BG[theme]
  if (contrastRatio(hex, bg) >= 3) return hex
  const target: [number, number, number] = theme === 'dark' ? [255, 255, 255] : [0, 0, 0]
  let best = hex
  let bestC = contrastRatio(hex, bg)
  for (let i = 1; i <= 12; i++) {
    const cand = mix(hex, target, (MAX_MIX / 12) * i)
    const c = contrastRatio(cand, bg)
    if (c > bestC) { best = cand; bestC = c }
    if (c >= 3) return cand
  }
  return best
}

// 自定义色值实时提示用：原始对比度任一主题不达标即提示（最终渲染仍会自动微调）
export function isUsableDataColor(hex: string): boolean {
  const c = contrastOnThemes(hex)
  return c.dark >= 3 && c.light >= 3
}
