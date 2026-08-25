// E2E 冒烟（DEV_PLAN §4）：新建项目 → 模板建角色 → 时间线草稿补时间入列 → 横纵切换 → 导出 zip
import { test, expect } from '@playwright/test'

test('主链路冒烟', async ({ page }) => {
  await page.goto('/')
  // 新建项目
  await page.getByRole('button', { name: /新建项目/ }).first().click()
  await page.getByPlaceholder('项目名称，如：星陨大陆').fill('冒烟测试世界')
  await page.getByRole('button', { name: '创建', exact: true }).click()
  // 创建成功后自动进入角色页
  await expect(page.getByRole('button', { name: /新建角色/ }).first()).toBeVisible({ timeout: 10000 })

  // 模板建角色（新建角色 → 选「基础角色卡」模板）
  await page.getByRole('button', { name: /新建角色/ }).first().click()
  await page.getByText('基础角色卡', { exact: false }).first().click()
  await expect(page.getByText('角色已创建', { exact: false })).toBeVisible({ timeout: 5000 })

  // 时间线：草稿箱可见 + 默认一条主世界线泳道
  await page.goto('/#/timeline')
  await expect(page.locator('.draft-box')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.lane')).toHaveCount(1)

  // 新建草稿事件 → 出现在草稿箱（不出现在泳道）
  await page.getByRole('button', { name: /新建草稿事件/ }).click()
  await expect(page.locator('.draft-box .card.draft')).toHaveCount(1)
  await expect(page.locator('.lane-cards .card')).toHaveCount(0)

  // 抽屉补时间：纪年法 + 年 → 保存 → 入线并带 displayTime 文本
  await page.getByText('纪年法', { exact: true }).first().click()
  await page.getByPlaceholder('年').fill('217')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  const laneCard = page.locator('.lane .lane-cards .card')
  await expect(laneCard).toHaveCount(1, { timeout: 5000 })
  await expect(laneCard.locator('.card-time')).toContainText('217')
  await page.keyboard.press('Escape') // 关抽屉（保存后仍打开，mask 拦截后续点击）
  await page.waitForTimeout(300)

  // 横纵切换：宽屏默认 h；点击 → v；再点 → h
  const root = page.locator('.page.timeline')
  await expect(root).toHaveClass(/h/)
  await page.getByRole('button', { name: /切换到纵向/ }).click()
  await expect(root).toHaveClass(/v/)
  await page.getByRole('button', { name: /切换到横向/ }).click()
  await expect(root).toHaveClass(/h/)

  // 导出 zip（触发下载）
  const dl = page.waitForEvent('download', { timeout: 15000 })
  await page.goto('/#/export')
  await page.getByRole('button', { name: /导出 zip/ }).click()
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/\.zip$/)
})
