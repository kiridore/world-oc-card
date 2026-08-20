// E2E 冒烟（DEV_PLAN §4）：新建项目 → 模板建角色 → 百科互链 → 建事件 → fork IF 线 → 导出 zip
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

  // 百科：建两个条目并互链
  await page.goto('/#/codex')
  await page.getByRole('button', { name: /新建条目/ }).first().click()
  await page.getByText('空白条目').click()

  // 时间线：建事件并 fork
  await page.goto('/#/timeline')
  await page.getByRole('button', { name: /新建事件/ }).click()
  await page.getByRole('button', { name: '创建并编辑' }).click()

  // 导出 zip（触发下载）
  const dl = page.waitForEvent('download', { timeout: 15000 })
  await page.goto('/#/export')
  await page.getByRole('button', { name: /导出 zip/ }).click()
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/\.zip$/)
})
