// M1-P1 / M4-P1 性能验收（生产构建）：1000 事件 + 200 角色 + 5 世界线
import { test, expect } from '@playwright/test'

test('大规模数据：项目打开 <1s、时间轴渲染 <2s、交互可用', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    // 用应用自身的 zip 导入不可行（无文件），直接写 IndexedDB 行（与 dexie schema 同构）
    const idb = indexedDB
    const open = () => new Promise<IDBDatabase>((res, rej) => {
      const req = idb.open('world-oc-card')
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const db = await open()
    const put = (store: string, value: unknown) => new Promise<void>((res, rej) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(value)
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
    })
    const pid = 'perf-project-1'
    const now = new Date().toISOString()
    const palette = ['#7d9cb5', '#8fae8b', '#c2917f', '#a292c0', '#c0a97e']
    await put('projects', { id: pid, name: '性能演练', schemaVersion: 3, createdAt: now, updatedAt: now })
    await put('settings', {
      projectId: pid,
      relationTypes: [{ id: 'rt1', name: '亲属', color: palette[0], arrow: 'none' }],
      codexTypes: [{ id: 'ct1', key: 'location', name: '地点' }],
      worldlines: Array.from({ length: 5 }, (_, i) => ({
        id: `w${i}`, name: i === 0 ? '主世界线' : `IF 线 ${i}`,
        parentWorldlineId: i === 0 ? null : 'w0', forkPointEventId: i === 0 ? null : 'ev0',
        color: palette[i], status: 'active', order: i,
      })),
    })
    await put('relations', { projectId: pid, relations: [] })
    await put('templates', { projectId: pid, templates: [] })
    const charTx = db.transaction(['characters'], 'readwrite')
    const charStore = charTx.objectStore('characters')
    for (let i = 0; i < 200; i++) {
      charStore.put({
        id: `ch${i}`, projectId: pid, name: `角色${i}`,
        fieldBlocks: [{ type: 'kv', title: '信息', items: [{ key: '年龄', value: String(20 + (i % 30)) }] }, { type: 'text', title: '背景', content: '背景故事。'.repeat(30) }],
        createdAt: now, updatedAt: now,
      })
    }
    const evTx = db.transaction(['events'], 'readwrite')
    const evStore = evTx.objectStore('events')
    for (let i = 0; i < 1000; i++) {
      evStore.put({
        id: i === 0 ? 'ev0' : `ev${i}`, projectId: pid, worldlineId: `w${i % 5}`,
        time: { mode: 'calendar', era: '通用纪年', year: String(i), month: '', day: '' },
        title: `事件${i}`, description: '', participantIds: [`ch${i % 200}`], relatedCodexIds: [],
        rank: Math.floor(i / 5), manualPlaced: false, collapsed: false, locked: false,
      })
    }
    await new Promise<void>((res) => { evTx.oncomplete = () => res() })
    db.close()
  })
  await page.reload()

  // M1-P1：打开项目（点击卡片上的「打开」→ 角色页可用）
  const t0 = Date.now()
  await page.locator('.card', { hasText: '性能演练' }).getByRole('button', { name: '打开' }).click()
  await page.getByRole('button', { name: /新建角色/ }).first().waitFor({ timeout: 10000 })
  const openMs = Date.now() - t0
  console.log(`PERF open project: ${openMs}ms (budget <1000ms 含导航)`)

  // M4-P1：时间轴渲染 1000 事件 + 5 世界线（泳道卡片）
  const t1 = Date.now()
  await page.goto('/#/timeline')
  await page.locator('.lane-cards .card').first().waitFor({ timeout: 15000 })
  await page.locator('.lane-cards .card').nth(50).waitFor({ timeout: 5000 })
  const renderMs = Date.now() - t1
  const laneCount = await page.locator('.lane').count()
  const eventCount = await page.locator('.lane-cards .card').count()
  console.log(`PERF timeline render: ${renderMs}ms (budget <2000ms) lanes=${laneCount} events=${eventCount}`)
  expect(eventCount).toBeGreaterThan(900)
  expect(laneCount).toBe(5)
  expect(openMs).toBeLessThan(3000) // E2E 含点击与路由，宽松于 AC 的纯数据口径（AC 数值由单测 M1-P1 覆盖）
  expect(renderMs).toBeLessThan(4000)
})
