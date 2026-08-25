// E2E 功能验收（生产构建）：G9 双主题 / G4 持久化 / M4 fork / M4-E3 草稿箱 / M4-F8 横纵 / M4 DnD 重排 / M5 图谱 / M6 快照 / M7-E1 刷新
import { test, expect } from '@playwright/test'

async function freshProject(page: import('@playwright/test').Page, name: string): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: /新建项目/ }).first().click()
  await page.getByPlaceholder('项目名称，如：星陨大陆').fill(name)
  await page.getByRole('button', { name: '创建', exact: true }).click()
  await expect(page.getByRole('button', { name: /新建角色/ }).first()).toBeVisible({ timeout: 10000 })
}

/** 在时间线点「新建草稿事件」打开抽屉，填纪年法年字段并保存 → 关闭抽屉（保存后抽屉保持打开，其 mask 会拦截后续点击）*/
async function addTimedEvent(page: import('@playwright/test').Page, year: string): Promise<void> {
  await page.getByRole('button', { name: /新建草稿事件/ }).click()
  await page.getByText('纪年法', { exact: true }).first().click()
  await page.getByPlaceholder('年').fill(year)
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.keyboard.press('Escape') // 关抽屉
  await page.waitForTimeout(300)
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

test('M4-F2/F3 世界线 fork：草稿补时间入线后从此处创建 IF 线，新泳道出现', async ({ page }) => {
  await freshProject(page, 'Fork 验证')
  await page.goto('/#/timeline')
  await addTimedEvent(page, '217')
  await expect(page.locator('.lane')).toHaveCount(1)
  // 打开卡片 → 抽屉 → 从此处创建 IF 线
  await page.locator('.lane .lane-cards .card').first().click()
  await page.getByRole('button', { name: /从此处创建 IF 线/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: '创建', exact: true }).click()
  // 新泳道 + IF 标识出现
  await expect(page.locator('.lane')).toHaveCount(2, { timeout: 5000 })
  await expect(page.locator('.lane-name').filter({ hasText: 'IF' }).first()).toBeVisible()
  await page.keyboard.press('Escape')
})

test('M4 泳道背骨线 + 分叉相对定位 + 统一横滚', async ({ page }) => {
  await freshProject(page, '泳道连线验证')
  await page.goto('/#/timeline')
  // 主干 2 卡 → 1 条背骨
  await addTimedEvent(page, '217')
  await addTimedEvent(page, '300')
  await expect(page.locator('.fork-overlay path.backbone')).toHaveCount(1)
  // fork：从第一张卡创建 IF 线
  await page.locator('.lane .lane-cards .card').first().click()
  await page.getByRole('button', { name: /从此处创建 IF 线/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: '创建', exact: true }).click()
  await expect(page.locator('.lane')).toHaveCount(2, { timeout: 5000 })
  await page.keyboard.press('Escape')
  // IF 线加两张卡：草稿 → 世界线下拉选第二条线 → 纪年法保存（重复两次）
  async function addToIfLane(year: string): Promise<void> {
    await page.getByRole('button', { name: /新建草稿事件/ }).click()
    await page.getByText('纪年法', { exact: true }).first().click()
    await page.getByPlaceholder('年').fill(year)
    await page.locator('.row', { hasText: '世界线' }).locator('.n-select').first().click()
    await page.locator('.n-base-select-option').nth(1).click()
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }
  await addToIfLane('1')
  await addToIfLane('2')
  // IF 卡入泳道：背骨 2 条（主干 2 卡 1 条 + IF 线 2 卡 1 条）、fork 曲线 1 条
  await expect(page.locator('.fork-overlay path.backbone')).toHaveCount(2)
  await expect(page.locator('.fork-overlay path.fork')).toHaveCount(1)
  // 卡的内容系坐标（相对 .lanes 容器，含 scroll 矫正）
  const contentBox = (loc: import('@playwright/test').Locator) =>
    loc.evaluate((node) => {
      const lanes = document.querySelector('.lanes')!
      const lr = lanes.getBoundingClientRect()
      const r = node.getBoundingClientRect()
      return { left: r.left - lr.left + lanes.scrollLeft, top: r.top - lr.top + lanes.scrollTop, width: r.width, height: r.height }
    })
  // 分叉对齐（横）：IF 首卡是分叉点事件的**下一个**——左缘 = 锚点卡右缘 + 卡间距
  const anchor = page.locator('.lane').first().locator('.lane-cards .card').filter({ hasText: '217' }).first()
  const ifFirst = page.locator('.lane').nth(1).locator('.lane-cards .card').first()
  const gap = await page.locator('.lane-cards').first().evaluate((el) => parseFloat(getComputedStyle(el).gap) || 16)
  await expect(anchor).toHaveCount(1)
  const before = { anchor: await contentBox(anchor), ifCard: await contentBox(ifFirst) }
  expect(Math.abs(before.ifCard.left - (before.anchor.left + before.anchor.width + gap))).toBeLessThanOrEqual(2)
  // fork 曲线端点 x2 与 IF 首卡中心一致（量测未陈旧）
  const forkX2 = await page.locator('.fork-overlay path.fork').evaluate(
    (p) => parseFloat(p.getAttribute('d')!.split(' ')[6]!),
  )
  expect(Math.abs(forkX2 - (before.ifCard.left + before.ifCard.width / 2))).toBeLessThanOrEqual(2)
  // 统一横滚：横向模式下 lane-cards 无独立 overflow-x
  const ox = await page.locator('.lane-cards').first().evaluate((el) => getComputedStyle(el).overflowX)
  expect(ox).not.toBe('auto')
  // 手动重排后跟随：把主干第二张卡拖到锚点前 → 锚点右移，IF 首卡与 fork 端点同步跟随
  const dt = await page.evaluateHandle(() => new DataTransfer())
  const mainCards = page.locator('.lane').first().locator('.card')
  await mainCards.nth(1).dispatchEvent('dragstart', { dataTransfer: dt })
  await mainCards.nth(0).dispatchEvent('drop', { dataTransfer: dt })
  await page.waitForTimeout(600)
  const after = { anchor: await contentBox(anchor), ifCard: await contentBox(ifFirst) }
  expect(after.anchor.left).toBeGreaterThan(before.anchor.left + 100) // 锚点确实后移
  expect(Math.abs(after.ifCard.left - (after.anchor.left + after.anchor.width + gap))).toBeLessThanOrEqual(2) // IF 卡跟随
  const forkX2b = await page.locator('.fork-overlay path.fork').evaluate(
    (p) => parseFloat(p.getAttribute('d')!.split(' ')[6]!),
  )
  expect(Math.abs(forkX2b - (after.ifCard.left + after.ifCard.width / 2))).toBeLessThanOrEqual(2) // 曲线刷新
  // 纵向模式：IF 首卡上缘 = 锚点卡下缘 + 卡间距
  await page.getByRole('button', { name: /切换到纵向/ }).click()
  await page.waitForTimeout(400)
  const v = { anchor: await contentBox(anchor), ifCard: await contentBox(ifFirst) }
  expect(Math.abs(v.ifCard.top - (v.anchor.top + v.anchor.height + gap))).toBeLessThanOrEqual(2)
})

test('M4-E3 草稿箱：未定时进箱不进泳道；补时间入线；放回箱', async ({ page }) => {
  await freshProject(page, '草稿箱验证')
  await page.goto('/#/timeline')
  // 未定时草稿 → 草稿箱内、泳道无
  await page.getByRole('button', { name: /新建草稿事件/ }).click()
  await expect(page.locator('.draft-box .card.draft')).toHaveCount(1)
  await expect(page.locator('.lane-cards .card')).toHaveCount(0)
  await page.keyboard.press('Escape') // 关闭抽屉，草稿保留
  await page.waitForTimeout(300)
  // 放回操作经抽屉二次打开 → 补时间入线
  await page.locator('.draft-box .card.draft').first().click()
  await page.getByText('纪年法', { exact: true }).first().click()
  await page.getByPlaceholder('年').fill('9')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.keyboard.press('Escape') // 保存后抽屉保持打开，先关闭再断言泳道
  await expect(page.locator('.lane-cards .card')).toHaveCount(1, { timeout: 5000 })
  await expect(page.locator('.draft-box .card.draft')).toHaveCount(0)
  // 已定时 → 放回草稿箱 → 回箱、出土泳道
  await page.locator('.lane-cards .card').first().click()
  await page.getByRole('button', { name: /放回草稿箱/ }).click()
  await expect(page.locator('.draft-box .card.draft')).toHaveCount(1, { timeout: 5000 })
  await expect(page.locator('.lane-cards .card')).toHaveCount(0)
})

test('M4-F8 线内拖拽重排：HTML5 DnD 后卡片顺序交换', async ({ page }) => {
  await freshProject(page, 'DnD 验证')
  await page.goto('/#/timeline')
  await addTimedEvent(page, '1')
  await addTimedEvent(page, '2')
  await expect(page.locator('.lane-cards .card')).toHaveCount(2)

  const eids = async () => page.locator('.lane-cards .card').evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-eid')),
  )
  const before = await eids()
  expect(before).toHaveLength(2)

  // 把第 2 张卡拖到第 1 张卡上（dataTransfer 驱动；普通 DOM 卡，不涉及 G6 拖拽兼容坑）
  const dt = await page.evaluateHandle(() => new DataTransfer())
  const cards = page.locator('.lane-cards .card')
  await cards.nth(1).dispatchEvent('dragstart', { dataTransfer: dt })
  await cards.nth(0).dispatchEvent('drop', { dataTransfer: dt })
  await cards.nth(0).dispatchEvent('dragover', { dataTransfer: dt })
  await cards.nth(1).dispatchEvent('dragend', { dataTransfer: dt })
  await page.waitForTimeout(300)

  const after = await eids()
  expect(after).toEqual([before[1], before[0]])
})

test('M4-F8 横纵切换：class h↔v 翻转并 localStorage 持久化', async ({ page }) => {
  await freshProject(page, '横纵验证')
  await page.goto('/#/timeline')
  const root = page.locator('.page.timeline')
  await expect(root).toHaveClass(/h/)
  await page.getByRole('button', { name: /切换到纵向/ }).click()
  await expect(root).toHaveClass(/v/)
  await page.reload()
  await expect(root).toHaveClass(/v/) // localStorage 优先于默认识别
  await page.getByRole('button', { name: /切换到横向/ }).click()
  await expect(root).toHaveClass(/h/)
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

test('M5 页内新建关系：曲线边无需刷新立即渲染', async ({ page }) => {
  await freshProject(page, '曲线回归')
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /新建角色/ }).first().click()
    await page.getByText('跳过，直接创建空白角色').click()
    await page.waitForTimeout(400)
  }
  await page.goto('/#/graph')
  const wrap = page.locator('.graph-wrap')
  await expect(wrap.locator('canvas').first()).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(400)
  // 基线截图（仅两节点）
  const before = (await wrap.screenshot()) as Buffer
  await page.getByRole('button', { name: /新建关系/ }).click()
  const boxes = page.locator('.rel-form .n-base-selection')
  await boxes.nth(0).click()
  await page.keyboard.type('新角色')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await boxes.nth(1).click()
  await page.keyboard.type('新角色')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await boxes.nth(2).click()
  await page.keyboard.type('亲属')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '创建', exact: true }).click()
  await page.getByText('关系已创建').waitFor({ timeout: 5000 })
  // 等待布局重排与曲线边绘制完成
  await page.waitForTimeout(1500)
  const after = (await wrap.screenshot()) as Buffer
  // 画布内容必须发生变化：新建的曲线边（含标签）应已绘制，无需刷新页面
  expect(after.equals(before)).toBe(false)
})

test('M5 点阵背景跟随视口平移/缩放', async ({ page }) => {
  await freshProject(page, '点阵验证')
  await page.goto('/#/graph')
  const wrap = page.locator('.g6-container')
  await page.locator('.graph-wrap canvas').first().waitFor({ timeout: 8000 })
  // 就绪条件：初始 autoFit 后 syncDotGrid 已写入 CSS 变量（避免固定 sleep 的引擎间时序抖动）
  await page.waitForFunction(
    () => (document.querySelector('.g6-container')?.getAttribute('style') ?? '').includes('--dot-size'),
  )
  const vars = async () => (await wrap.first().getAttribute('style')) ?? ''
  const sizeOf = (s: string) => Number((s.match(/--dot-size:\s*([\d.]+)px/) ?? [])[1])

  // 滚轮缩放驱动视口变化（Playwright 合成拖拽在 firefox/edge 分支下不稳定，见 AGENTS.md 已知问题；
  // 拖拽与缩放共用 aftertransform → syncDotGrid → CSS 变量 同步链路）
  const box = await page.locator('.graph-wrap').boundingBox()
  await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5)
  const before = await vars()
  await page.mouse.wheel(0, 480) // 缩小 → 点阵尺寸应变小
  await page.waitForTimeout(400)
  const afterOut = await vars()
  expect(sizeOf(afterOut)).toBeLessThan(sizeOf(before))
  await page.mouse.wheel(0, -960) // 放大 → 点阵尺寸应变大
  await page.waitForTimeout(400)
  const afterIn = await vars()
  expect(sizeOf(afterIn)).toBeGreaterThan(sizeOf(afterOut))
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
  await page.goto('/#/timeline')
  await page.reload()
  await expect(page.locator('.draft-box')).toBeVisible({ timeout: 8000 })
  await page.goto('/#/graph')
  await page.reload()
  await expect(page.locator('.graph-wrap')).toBeVisible({ timeout: 8000 })
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
  await page.goto('/#/export')
  await page.waitForTimeout(1500)
  expect(errors).toEqual([])
})
