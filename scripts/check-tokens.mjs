/* G13 + G10 静态检查：
   1) tokens.css 两个主题的 chrome 色饱和度 S≤40%，主题级/通用 token 齐全；
   2) src 内 hex/rgb 颜色字面量只允许出现在白名单文件（token / 数据语义色 / 快照模板）。 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]+$/, '')
const tokensCss = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8')

const THEME_REQUIRED = [
  '--bg', '--surface', '--surface-2', '--text-1', '--text-2', '--text-3',
  '--border', '--border-weak', '--accent', '--accent-weak', '--accent-text',
  '--texture-opacity', '--texture-sheen', '--texture-url', '--texture-sheen-gradient',
  '--shadow-1', '--shadow-2',
]
const COMMON_REQUIRED = [
  '--radius-s', '--radius-m', '--radius-l',
  '--space-1', '--space-2', '--space-3', '--space-4', '--space-5',
  '--font-ui', '--font-serif',
]
const CHROME = [
  '--bg', '--surface', '--surface-2', '--text-1', '--text-2', '--text-3',
  '--border', '--border-weak', '--accent', '--accent-weak', '--accent-text',
]

let failed = 0
const fail = (msg) => { failed++; console.error('  ✗ ' + msg) }

function hexToHslS(hex) {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(v.slice(0, 2), 16) / 255
  const g = parseInt(v.slice(2, 4), 16) / 255
  const b = parseInt(v.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max === min) return 0
  const l = (max + min) / 2
  return Math.round(((max - min) / (1 - Math.abs(2 * l - 1))) * 100)
}

for (const theme of ['dark', 'light']) {
  const re = new RegExp(`:root\\[data-theme='${theme}'\\]\\s*\\{([\\s\\S]*?)\\}`, 'm')
  const m = tokensCss.match(re)
  if (!m) { fail(`缺少主题块 ${theme}`); continue }
  const vars = {}
  for (const line of m[1].split('\n')) {
    const vm = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);/)
    if (vm) vars[vm[1]] = vm[2].trim()
  }
  for (const t of THEME_REQUIRED) {
    if (!(t in vars)) fail(`主题 ${theme} 缺少 token ${t}`)
  }
  for (const t of CHROME) {
    const val = vars[t]
    if (!val) continue
    const hex = val.match(/#[0-9a-fA-F]{3,8}/)
    if (!hex) { fail(`chrome token ${t}(${theme}) 不是 hex 颜色`); continue }
    const s = hexToHslS(hex[0])
    if (s > 40) fail(`chrome token ${t}(${theme}) = ${hex[0]} 饱和度 ${s}% > 40%`)
  }
}
for (const t of COMMON_REQUIRED) {
  if (!tokensCss.includes(`${t}:`)) fail(`tokens.css 缺少通用 token ${t}`)
}

// G10：白名单之外的源码不允许颜色字面量
const ALLOW = new Set(['src/styles/tokens.css', 'src/utils/colors.ts', 'src/utils/snapshot.ts'])
const COLOR_RE = /#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F](?:[0-9a-fA-F]{3})?\b|rgba?\(/
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { if (name !== 'node_modules' && name !== 'dist') walk(p, out) }
    else if (['.vue', '.ts', '.css'].includes(extname(name))) out.push(p)
  }
  return out
}
for (const file of walk(join(root, 'src'))) {
  const rel = file.slice(root.length + 1).replace(/\\/g, '/')
  if (ALLOW.has(rel)) continue
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (COLOR_RE.test(line)) fail(`${rel}:${i + 1} 含硬编码颜色字面量（G10）: ${line.trim().slice(0, 80)}`)
  })
}

if (failed) { console.error(`\ntoken 检查未通过：${failed} 处`); process.exit(1) }
console.log('token 检查通过：双主题 token 齐全，chrome 饱和度 ≤ 40%，无白名单外颜色字面量')
