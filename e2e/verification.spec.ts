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
  await expect(page.getByText('有向', { exact: false }).first()).toBeVisible()
  await page.keyboard.press('Escape')
  // 类型过滤图例存在
  await expect(page.getByText('亲属', { exact: false }).first()).toBeVisible()
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
