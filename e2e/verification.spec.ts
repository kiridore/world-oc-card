// E2E 功能验收（生产构建）：G9 双主题 / G4 持久化 / M4 fork / 画布 / M5 图谱 / M6 快照 / M7-E1 刷新
import { test, expect } from '@playwright/test'

async function freshProject(page: import('@playwright/test').Page, name: string): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: /新建项目/ }).first().click()
  await page.getByPlaceholder('项目名称，如：星陨大陆').fill(name)
  await page.getByRole('button', { name: '创建', exact: true }).click()
  await expect(page.getByRole('button', { name: /新建角色/ }).first()).toBeVisible({ timeout: 10000 })
}

test('G9 双主题：切换即时生效并持久化，跟随系统偏好', async ({ browser }) => {
  // 跟随系统（暗色）
  const darkCtx = await browser.newContext({ colorScheme: 'dark' })
  const p1 = await darkCtx.newPage()
  await p1.goto('/')
  await expect(p1.locator('html')).toHaveAttribute('data-theme', 'dark')
  await darkCtx.close()

  const lightCtx = await browser.newContext({ colorScheme: 'light' })
  const p = await lightCtx.newPage()
  await p.goto('/')
  await expect(p.locator('html')).toHaveAttribute('data-theme', 'light')
  // 手动切换 → 持久化
  await p.getByTitle('切换到暗色主题').click()
  await expect(p.locator('html')).toHaveAttribute('data-theme', 'dark')
  await p.reload()
  await expect(p.locator('html')).toHaveAttribute('data-theme', 'dark') // localStorage 优先于系统
  await lightCtx.close()
})

test('M4-F2/F3 世界线 fork：从事件创建 IF 线，轨道出现且继承展示', async ({ page }) => {
  await freshProject(page, 'Fork 验证')
  await page.goto('/#/timeline')
  await page.getByRole('button', { name: /新建事件/ }).click()
  await page.getByRole('button', { name: '创建并编辑' }).click()
  await page.waitForTimeout(500)
  // 抽屉里「从此处创建 IF 线」
  await page.getByRole('button', { name: /从此处创建 IF 线/ }).click()
  await page.getByRole('button', { name: '创建', exact: true }).click()
  await page.waitForTimeout(800)
  // 世界线 chips 出现 IF 线 + 主线事件文本渲染在轨道（继承）
  await expect(page.getByText(/IF 线/).first()).toBeVisible()
  await expect(page.getByText('新事件').first()).toBeVisible()
})

test('M4 画布视图：节点渲染 + 未定时草稿入口', async ({ page }) => {
  await freshProject(page, '画布验证')
  await page.goto('/#/timeline/canvas')
  await page.getByRole('button', { name: /新建草稿事件/ }).click()
  await page.waitForTimeout(900)
  await expect(page.locator('.vue-flow__node').first()).toBeVisible({ timeout: 5000 })
})

test('M5 图谱：G6 画布渲染 + 关系创建入口 + 类型过滤图例', async ({ page }) => {
  await freshProject(page, '图谱验证')
  // 先建两个角色作为节点
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /新建角色/ }).first().click()
    await page.getByText('跳过，直接创建空白角色').click()
    await page.waitForTimeout(400)
  }
  await page.goto('/#/graph')
  await page.waitForTimeout(1200)
  await expect(page.locator('.graph-wrap canvas').first()).toBeVisible({ timeout: 8000 })
  // 关系创建/类型管理弹窗可打开（边创建走浏览器人工验收，见 docs/acceptance）
  await page.getByRole('button', { name: /新建关系/ }).click()
  await expect(page.locator('.rel-form').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /关系类型/ }).click()
  await expect(page.getByText('单箭头', { exact: false }).first()).toBeVisible()
  // 三态箭头：把"亲属"切到双箭头 → 图例显示 ↔
  const selects = page.locator('.type-mgr .n-base-selection')
  await selects.first().click()
  await page.getByText('双箭头 ↔').first().click()
  await page.waitForTimeout(400)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await expect(page.getByText('亲属 ↔').first()).toBeVisible()
  await expect(page.getByText('敌对 →').first()).toBeVisible()
})

test('M5 点阵背景跟随视口平移/缩放', async ({ page }) => {
  await freshProject(page, '点阵验证')
  await page.goto('/#/graph')
  await page.waitForTimeout(1500)
  const wrap = page.locator('.g6-container')
  const vars = async () => (await wrap.first().getAttribute('style')) ?? ''
  const before = await vars()
  expect(before).toContain('--dot-size') // 初始（autoFit 后）已写入

  // 画布空白处拖拽平移 → 点阵偏移变化
  const box = await page.locator('.graph-wrap').boundingBox()
  const cx = box!.x + box!.width * 0.3
  const cy = box!.y + box!.height * 0.8
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 120, cy, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  const afterPan = await vars()
  expect(afterPan).not.toBe(before)

  // 滚轮缩放 → 点阵尺寸变化
  await page.mouse.wheel(0, -240)
  await page.waitForTimeout(400)
  const afterZoom = await vars()
  const sizeOf = (s: string) => Number((s.match(/--dot-size:\s*([\d.]+)px/) ?? [])[1])
  expect(sizeOf(afterZoom)).not.toBe(sizeOf(afterPan))
})

test('M6-F4 分享快照：生成单文件 HTML（无外部请求引用）', async ({ page }) => {
  await freshProject(page, '快照验证')
  await page.goto('/#/export')
  const dl = page.waitForEvent('download', { timeout: 15000 })
  await page.getByRole('button', { name: /生成快照/ }).click()
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/快照\.html$/)
  const path = await download.path()
  const fs = await import('node:fs')
  const html = fs.readFileSync(path!, 'utf8')
  expect(html).toContain('快照验证')
  expect(html).not.toMatch(/src\s*=\s*"http/)
  expect(html).toContain("data-theme='dark'")
})

test('G4 数据持久化：编辑后刷新不丢', async ({ page }) => {
  await freshProject(page, '持久化验证')
  await page.getByRole('button', { name: /新建角色/ }).first().click()
  await page.getByText('基础角色卡', { exact: false }).first().click()
  await page.waitForTimeout(1500) // 防抖 500ms 落盘
  await page.reload()
  await expect(page.getByText('新角色', { exact: false }).first()).toBeVisible({ timeout: 8000 })
})

test('M7-E1 子路由刷新不 404（hash 路由）', async ({ page }) => {
  await freshProject(page, '刷新验证')
  await page.goto('/#/codex')
  await page.reload()
  await expect(page.getByRole('button', { name: /新建条目/ }).first()).toBeVisible({ timeout: 8000 })
  await page.goto('/#/timeline/canvas')
  await page.reload()
  await expect(page.getByRole('button', { name: /新建草稿事件/ }).first()).toBeVisible({ timeout: 8000 })
})

test('M4 同刻多事件：折叠聚合点（×N）点击展开，轨道首行不被顶部遮挡', async ({ page }) => {
  await freshProject(page, '聚合点验证')
  await page.goto('/#/timeline')
  // 两个同刻事件（默认时间 0）
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /新建事件/ }).click()
    await page.getByRole('button', { name: '创建并编辑' }).click()
    await page.waitForTimeout(400)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }
  // 侧栏分组列表（可靠选中入口）
  await expect(page.getByText(/主世界线（2）/)).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.ev-row')).toHaveCount(2)

  // 轨道上折叠为聚合点：计数 2，点击展开为两个独立事件
  const cluster = page.locator('g.event.cluster')
  await expect(cluster).toHaveCount(1)
  await expect(page.locator('.cluster-count')).toHaveText('2')
  await cluster.click()
  await expect(page.locator('svg g.event:not(.cluster) circle:not(.hit)')).toHaveCount(2)
  await expect(page.getByText('收起 ×2')).toBeVisible()
  // 展开后点第一个事件圆点 → 抽屉打开
  await page.locator('svg g.event:not(.cluster) circle:not(.hit)').first().click()
  await expect(page.getByText(/事件：新事件/).first()).toBeVisible({ timeout: 5000 })
  // 首条轨道下移：事件圆点 y ≥ 60（不被顶部工具栏遮挡）
  const topCircleY = await page.locator('svg g.event:not(.cluster) circle:not(.hit)').first().boundingBox()
  expect(topCircleY?.y ?? 0).toBeGreaterThan(60)
})

test('M4 缩放尺度限制：极端放大/缩小后无错误且视图可恢复', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await freshProject(page, '缩放限制验证')
  await page.goto('/#/timeline')
  await page.getByRole('button', { name: /新建事件/ }).click()
  await page.getByRole('button', { name: '创建并编辑' }).click()
  await page.waitForTimeout(600)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  const board = page.locator('.board')
  const box = await board.boundingBox()
  const cx = box!.x + box!.width / 2
  const cy = box!.y + 100
  await page.mouse.move(cx, cy)
  // 极端放大（40 次）与极端缩小（80 次）——被钳制后不崩溃、事件仍在渲染
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, -120)
  for (let i = 0; i < 80; i++) await page.mouse.wheel(0, 120)
  await page.waitForTimeout(500)
  // 序位轴：等距排布，事件点下标注历法时间文本
  const timeLabels = await page.locator('.event-time').allTextContents()
  expect(timeLabels.length).toBeGreaterThan(0)
  expect(timeLabels.some((t) => t.includes('通用纪年'))).toBe(true)
  // 侧栏列表入口仍可选中事件（缩放丢失视野后的恢复路径）
  await page.locator('.ev-row').first().click()
  await expect(page.getByText(/事件：新事件/).first()).toBeVisible({ timeout: 5000 })
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

test('M4 时间轴拖拽惯性：松手后继续滑行且无错误', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await freshProject(page, '惯性别证')
  await page.goto('/#/timeline')
  await page.getByRole('button', { name: /新建事件/ }).click()
  await page.getByRole('button', { name: '创建并编辑' }).click()
  await page.waitForTimeout(500)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  const board = page.locator('.board')
  const box = await board.boundingBox()
  const cx = box!.x + box!.width / 2
  const cy = box!.y + 130
  // 快速拖拽释放：断言滑行（释放后圆点 x 仍在变化）
  await page.mouse.move(cx + 60, cy)
  await page.mouse.down()
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(cx + 60 - i * 18, cy, { steps: 1 })
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
  const dot = page.locator('svg g.event circle:not(.hit)').first()
  const x1 = Number(await dot.getAttribute('cx'))
  await page.waitForTimeout(120)
  const x2 = Number(await dot.getAttribute('cx'))
  await page.waitForTimeout(500)
  const x3 = Number(await dot.getAttribute('cx'))
  // x1→x2：惯性滑行中；x2→x3：已停止（衰减完成）
  expect(Math.abs(x2 - x1)).toBeGreaterThan(1)
  expect(Math.abs(x3 - x2)).toBeLessThan(Math.abs(x2 - x1))
  expect(errors).toEqual([])
})

test('M7 巡检面板打开显示健康状态', async ({ page }) => {
  await freshProject(page, '巡检验证')
  await page.getByTitle('完整性巡检（失效引用 / 孤儿资产）').click()
  await expect(page.getByText(/全部健康|未发现失效引用/).first()).toBeVisible({ timeout: 5000 })
})

test('G2 控制台无 error（主流程走查）', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await freshProject(page, '控制台验证')
  await page.goto('/#/codex')
  await page.goto('/#/timeline')
  await page.goto('/#/graph')
  await page.goto('/#/timeline/canvas')
  await page.goto('/#/export')
  await page.waitForTimeout(1500)
  expect(errors).toEqual([])
})
