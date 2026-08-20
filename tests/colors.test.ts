import { describe, it, expect } from 'vitest'
import {
  DATA_PALETTE, isUsableDataColor, palettePick,
  resolveDataColor, contrastRatio, THEME_BG,
} from '../src/utils/colors'

describe('M4-S1 / G11 数据语义调色板双主题预检', () => {
  it('12 色调色板齐全无重复', () => {
    expect(DATA_PALETTE.length).toBe(12)
    expect(new Set(DATA_PALETTE).size).toBe(12)
  })

  it('每色经主题解析后在暗/亮主题背景上对比度 ≥ 3:1', () => {
    for (const hex of DATA_PALETTE) {
      for (const theme of ['dark', 'light'] as const) {
        const resolved = resolveDataColor(hex, theme)
        const c = contrastRatio(resolved, THEME_BG[theme])
        expect(c, `${hex} → ${resolved} @${theme} = ${c}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('调色板保持低饱和（HSL S ≤ 45%，莫兰迪倾向）', () => {
    for (const hex of DATA_PALETTE) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const l = (max + min) / 2
      const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1))
      expect(Math.round(s * 100), `${hex}`).toBeLessThanOrEqual(45)
    }
  })

  it('palettePick 循环取色', () => {
    expect(palettePick(0)).toBe(DATA_PALETTE[0])
    expect(palettePick(12)).toBe(DATA_PALETTE[0])
    expect(palettePick(13)).toBe(DATA_PALETTE[1])
  })

  it('isUsableDataColor 原始对比度不足返回 false', () => {
    expect(isUsableDataColor('#4f7189')).toBe(true) // 双主题原始对比度均达标
    expect(isUsableDataColor('#ffffff')).toBe(false) // 暗背景上偏亮且亮背景上无对比
    expect(isUsableDataColor('#f4f5f6')).toBe(false) // 与亮主题背景同色
  })
})
