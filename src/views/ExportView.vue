<template>
  <EmptyProject>
    <div class="page export">
      <h1>导出与分享</h1>

      <section class="panel card">
        <div class="card-head">
          <h3><Archive :size="16" /> 项目完整备份（zip）</h3>
          <n-button
            size="small"
            type="primary"
            :loading="busy.zip"
            @click="doExportZip"
          >
            导出 zip
          </n-button>
        </div>
        <p class="desc">
          包含角色 / 百科 / 事件 / 世界线 / 模板 / 图片全部数据，目录结构与设计文档 §3.1 一致；可在任意设备重新导入。
        </p>
      </section>

      <section class="panel card">
        <div class="card-head">
          <h3><FileText :size="16" /> 角色卡 Markdown</h3>
          <div class="ops">
            <n-select
              v-model:value="mdCharId"
              size="small"
              clearable
              placeholder="全部角色"
              :options="characterOptions"
              style="width: 200px"
            />
            <n-button
              size="small"
              type="primary"
              :loading="busy.md"
              @click="doExportMd"
            >
              导出 Markdown
            </n-button>
          </div>
        </div>
        <p class="desc">
          覆盖全部字段块结构：分组→小节、键值→表格、表格块→MD 表格、图片→assets 引用；未选择角色时导出全部角色合集。
        </p>
      </section>

      <section class="panel card">
        <div class="card-head">
          <h3><FolderOutput :size="16" /> Markdown 工作区导出</h3>
          <div class="ops">
            <n-checkbox
              v-model:checked="wsFrontmatter"
              size="small"
            >
              frontmatter 元数据
            </n-checkbox>
            <n-button
              size="small"
              type="primary"
              :loading="busy.ws"
              @click="doExportWorkspace"
            >
              导出工作区 zip
            </n-button>
          </div>
        </div>
        <p class="desc">
          每个角色 / 百科 / 事件一个 .md 文件（characters / codex / events 三文件夹），保留 [[条目名]] 双链与 assets 相对路径图片引用；解压后可直接用 Obsidian / Typora / VS Code 打开编辑。frontmatter 含类型 / 颜色 / 历法时间。
        </p>
      </section>

      <section class="panel card">
        <div class="card-head">
          <h3><Share2 :size="16" /> 分享快照（单文件 HTML）</h3>
          <n-button
            size="small"
            type="primary"
            :loading="busy.snap"
            @click="doExportSnapshot"
          >
            生成快照
          </n-button>
        </div>
        <p class="desc">
          生成只读浏览页（角色 / 百科 / 时间线三个标签，双主题可切换，内联全部文本数据与小图）。断网状态下双击文件即可查看。
        </p>
      </section>

      <section class="panel card">
        <div class="card-head">
          <h3><ImageDown :size="16" /> 图片导出（PNG）</h3>
        </div>
        <div class="png-row">
          <n-button
            size="small"
            :disabled="!graphReady"
            @click="exportGraphPng"
          >
            <Share2 :size="14" /> 关系图谱{{ graphReady ? '' : '（先打开图谱页）' }}
          </n-button>
          <n-button
            size="small"
            @click="router.push('/timeline')"
          >
            时间轴 → 在时间轴页点「导出 PNG」（当前视口）
          </n-button>
          <n-button
            size="small"
            @click="router.push('/characters')"
          >
            角色卡 → 在角色页卡片区点「导出 PNG」
          </n-button>
        </div>
        <p class="desc">
          PNG 按当前主题导出（含冷灰大理石质感）。
        </p>
      </section>

      <section class="panel card">
        <div class="card-head">
          <h3><ShieldCheck :size="16" /> 完整性巡检</h3>
          <n-button
            size="small"
            @click="showIntegrity = true"
          >
            打开巡检
          </n-button>
        </div>
        <p class="desc">
          扫描全部失效引用与孤儿资产（事件 / 关系 / 世界线 / 字段链接），定位损坏数据来源。
        </p>
      </section>
    </div>
  </EmptyProject>
  <IntegrityDrawer v-model:show="showIntegrity" />
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NSelect, NCheckbox, useMessage } from 'naive-ui'
import { Archive, FileText, Share2, ImageDown, ShieldCheck, FolderOutput } from 'lucide-vue-next'
import EmptyProject from '@/components/EmptyProject.vue'
import IntegrityDrawer from '@/components/IntegrityDrawer.vue'
import { useProjectStore } from '@/stores/project'
import { projectToMarkdown, characterToMarkdown } from '@/utils/mdExport'
import { buildSnapshotHtml, type SnapshotAsset } from '@/utils/snapshot'
import { getGraphInstance } from '@/utils/graphHolder'
import { downloadBlob, downloadText } from '@/utils/download'
import { buildWorkspaceZip } from '@/utils/workspace'
import type { AssetMeta } from '@/types'

const store = useProjectStore()
const showIntegrity = ref(false)
const router = useRouter()
const message = useMessage()

const busy = reactive({ zip: false, md: false, snap: false, ws: false })
const mdCharId = ref<string | null>(null)
const wsFrontmatter = ref(true)
const graphReady = ref(false)
let poller: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  poller = setInterval(() => { graphReady.value = !!getGraphInstance() }, 800)
})
onUnmounted(() => { if (poller) clearInterval(poller) })

const characterOptions = computed(() => (store.current?.characters ?? []).map((c) => ({ label: c.name, value: c.id })))

async function doExportZip(): Promise<void> {
  busy.zip = true
  try {
    const blob = await store.exportZip()
    downloadBlob(blob, `${store.current?.meta.name ?? '项目'}.zip`)
    message.success('zip 备份已导出')
  } catch (e) {
    message.error(`导出失败：${e instanceof Error ? e.message : e}`)
  } finally {
    busy.zip = false
  }
}

async function doExportMd(): Promise<void> {
  if (!store.current) return
  busy.md = true
  try {
    const md = mdCharId.value
      ? characterToMarkdown(store.current.characters.find((c) => c.id === mdCharId.value)!, store.current, store.assets).md
      : projectToMarkdown(store.current, store.assets)
    const name = mdCharId.value
      ? store.current.characters.find((c) => c.id === mdCharId.value)?.name ?? '角色'
      : `${store.current.meta.name}-角色集`
    downloadText(md, `${name}.md`, 'text/markdown')
    message.success('Markdown 已导出')
  } finally {
    busy.md = false
  }
}

async function doExportWorkspace(): Promise<void> {
  if (!store.current) return
  busy.ws = true
  try {
    const zs: { meta: AssetMeta; bytes: Uint8Array }[] = []
    for (const m of store.assets) {
      const url = await store.assetUrl(m.id)
      if (!url) continue
      const blob = await (await fetch(url)).blob()
      zs.push({ meta: m, bytes: new Uint8Array(await blob.arrayBuffer()) })
    }
    const zip = buildWorkspaceZip(store.current, zs, { frontmatter: wsFrontmatter.value })
    downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), `${store.current.meta.name}-工作区.zip`)
    message.success('Markdown 工作区已导出')
  } catch (e) {
    message.error(`导出失败：${e instanceof Error ? e.message : e}`)
  } finally { busy.ws = false }
}

async function loadSnapshotAssets(): Promise<SnapshotAsset[]> {
  const out: SnapshotAsset[] = []
  for (const m of store.assets) {
    const url = await store.assetUrl(m.id)
    if (!url) { out.push({ meta: m, dataUrl: null }); continue }
    try {
      const blob = await (await fetch(url)).blob()
      if (blob.size > 200 * 1024) { out.push({ meta: m, dataUrl: null }); continue } // 超限图片占位，控制快照体积
      const dataUrl = await new Promise<string | null>((resolve) => {
        const fr = new FileReader()
        fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : null)
        fr.onerror = () => resolve(null)
        fr.readAsDataURL(blob)
      })
      out.push({ meta: m, dataUrl })
    } catch {
      out.push({ meta: m, dataUrl: null })
    }
  }
  return out
}

async function doExportSnapshot(): Promise<void> {
  if (!store.current) return
  busy.snap = true
  try {
    const assets = await loadSnapshotAssets()
    const html = buildSnapshotHtml(store.current, assets)
    downloadText(html, `${store.current.meta.name}-快照.html`, 'text/html')
    message.success('分享快照已生成（断网双击即可打开）')
  } finally {
    busy.snap = false
  }
}

async function exportGraphPng(): Promise<void> {
  const graph = getGraphInstance()
  if (!graph) { message.warning('请先打开图谱页再导出'); return }
  try {
    const url = await graph.toDataURL({ type: 'image/png' })
    downloadBlob(await (await fetch(url)).blob(), '关系图谱.png')
    message.success('图谱 PNG 已导出')
  } catch {
    message.error('导出失败')
  }
}
</script>

<style scoped>
.export { display: flex; flex-direction: column; gap: var(--space-2); max-width: 860px; }
h1 { margin: 0 0 var(--space-1); font-size: 20px; }
.card { padding: var(--space-3); }
.card-head { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
h3 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 15px; }
.desc { margin: 10px 0 0; font-size: 13px; color: var(--text-3); line-height: 1.7; }
.ops { display: flex; gap: 8px; align-items: center; }
.png-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
</style>
