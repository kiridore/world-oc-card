<template>
  <EmptyProject>
    <div class="page graph">
      <div class="toolbar panel">
        <div class="types">
          <label
            v-for="t in relationTypes"
            :key="t.id"
            class="type-filter"
          >
            <input
              type="checkbox"
              :checked="enabledTypes.has(t.id)"
              @change="toggleType(t.id)"
            >
            <span
              class="dot"
              :style="{ background: lineColor(t.color) }"
            />
            <span>{{ t.name }}{{ arrowSymbol(t.arrow) }}</span>
            <span class="count">{{ countOf(t.id) }}</span>
          </label>
        </div>
        <div class="ops">
          <n-button
            size="small"
            @click="showNewRelation = true"
          >
            <Plus :size="14" /> 新建关系
          </n-button>
          <n-button
            size="small"
            @click="showTypeMgr = true"
          >
            <Settings2 :size="14" /> 关系类型
          </n-button>
          <n-button
            size="small"
            @click="exportPng"
          >
            <ImageDown :size="14" /> 导出 PNG
          </n-button>
        </div>
      </div>
      <div class="graph-wrap panel">
        <div
          ref="containerEl"
          class="g6-container"
        />
        <n-empty
          v-if="characters.length === 0"
          class="overlay"
          description="还没有角色——先去角色页创建角色，图谱以角色为节点"
        />
      </div>
    </div>
  </EmptyProject>

  <!-- 新建/编辑关系 -->
  <n-modal
    v-model:show="showNewRelation"
    preset="dialog"
    :title="editing ? '编辑关系' : '新建关系'"
  >
    <div class="rel-form">
      <n-select
        v-model:value="relForm.from"
        filterable
        placeholder="角色 A"
        :options="characterOptions"
      />
      <n-select
        v-model:value="relForm.to"
        filterable
        placeholder="角色 B"
        :options="characterOptions"
      />
      <n-select
        v-model:value="relForm.typeId"
        placeholder="关系类型"
        :options="typeOptions"
      />
      <n-input
        v-model:value="relForm.description"
        placeholder="描述（可选）"
      />
      <div class="row-ops">
        <n-button
          size="small"
          type="primary"
          :disabled="!relFormOk"
          @click="saveRelation"
        >
          {{ editing ? '更新' : '创建' }}
        </n-button>
        <n-button
          v-if="editing"
          size="small"
          type="error"
          quaternary
          @click="deleteRelation"
        >
          删除关系
        </n-button>
      </div>
    </div>
  </n-modal>

  <!-- 关系类型管理 -->
  <n-modal
    v-model:show="showTypeMgr"
    preset="dialog"
    title="关系类型"
  >
    <div class="type-mgr">
      <div
        v-for="t in relationTypes"
        :key="t.id"
        class="trow"
      >
        <input
          v-model="t.name"
          class="tname"
          @change="store.updateSettings()"
        >
        <input
          v-model="t.color"
          type="color"
          class="tcolor"
          @change="store.updateSettings()"
        >
        <n-select
          :value="t.arrow"
          size="tiny"
          style="width: 104px"
          :options="arrowOptions"
          @update:value="(v: 'none' | 'single' | 'double') => { t.arrow = v; store.updateSettings() }"
        />
        <button
          class="mini danger"
          @click="removeType(t)"
        >
          <Trash2 :size="13" />
        </button>
      </div>
      <div class="new-t">
        <n-button
          size="small"
          @click="addType"
        >
          <Plus :size="13" /> 加类型
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Graph } from '@antv/g6'
import { NButton, NEmpty, NModal, NSelect, NInput, useDialog, useMessage } from 'naive-ui'
import { Plus, Trash2, Settings2, ImageDown } from 'lucide-vue-next'
import EmptyProject from '@/components/EmptyProject.vue'
import { useProjectStore } from '@/stores/project'
import { useThemeStore } from '@/stores/theme'
import { chartColors } from '@/utils/tokens'
import { resolveDataColor, palettePick } from '@/utils/colors'
import { setGraphInstance } from '@/utils/graphHolder'
import { downloadBlob } from '@/utils/download'
import { uuid } from '@/utils/id'
import type { RelationType } from '@/types'

const store = useProjectStore()
const theme = useThemeStore()
const router = useRouter()
const dialog = useDialog()
const message = useMessage()

const containerEl = ref<HTMLElement | null>(null)
const showNewRelation = ref(false)
const showTypeMgr = ref(false)
const editing = ref<string | null>(null) // 编辑中的关系 id
const relForm = reactive({ from: null as string | null, to: null as string | null, typeId: null as string | null, description: '' })
const enabledTypes = ref<Set<string>>(new Set())

let graph: Graph | null = null
let resizeObs: ResizeObserver | null = null
// 上次渲染的数据+主题指纹：相同则跳过重建（避免后台数据重读/重复触发导致视口被意外复位）
let lastRenderKey = ''

const characters = computed(() => store.current?.characters ?? [])
const relations = computed(() => store.current?.relations ?? [])
const relationTypes = computed(() => store.current?.settings.relationTypes ?? [])

const characterOptions = computed(() => characters.value.map((c) => ({ label: c.name, value: c.id })))
const typeOptions = computed(() => relationTypes.value.map((t) => ({ label: t.name + arrowSymbol(t.arrow), value: t.id })))

const relFormOk = computed(() => Boolean(relForm.from && relForm.to && relForm.typeId)) // 自环关系允许（M5-E1）

watch(relationTypes, (list) => {
  const next = new Set(enabledTypes.value)
  for (const t of list) if (!next.has(t.id) && !next.size) next.add(t.id) // 初始全部启用
  if (!enabledTypes.value.size) for (const t of list) next.add(t.id)
  enabledTypes.value = next
}, { immediate: true })

function lineColor(hex: string): string {
  return resolveDataColor(hex, theme.isDark ? 'dark' : 'light')
}

function countOf(typeId: string): number {
  return relations.value.filter((r) => r.typeId === typeId).length
}

function toggleType(id: string): void {
  const next = new Set(enabledTypes.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  enabledTypes.value = next
}

/** 箭头三态符号：无 / 单 → / 双 ↔ */
function arrowSymbol(arrow: 'none' | 'single' | 'double'): string {
  return arrow === 'single' ? ' →' : arrow === 'double' ? ' ↔' : ''
}

const arrowOptions = [
  { label: '无箭头', value: 'none' },
  { label: '单箭头 →', value: 'single' },
  { label: '双箭头 ↔', value: 'double' },
]

function graphData(): { nodes: { id: string; data: { name: string } }[]; edges: { id: string; source: string; target: string; type: 'quadratic' | 'line'; data: { color: string; arrow: 'none' | 'single' | 'double'; name: string } }[] } {
  const c = chartColors()
  void c
  return {
    nodes: characters.value.map((ch) => ({ id: ch.id, data: { name: ch.name } })),
    edges: relations.value
      .filter((r) => enabledTypes.value.has(r.typeId))
      .map((r) => {
        const t = relationTypes.value.find((x) => x.id === r.typeId)
        return {
          id: r.id, source: r.from, target: r.to,
          // 关系连线为二次贝塞尔曲线（curveOffset 默认 30）；自环保持默认渲染避免端点重合退化
          type: r.from === r.to ? 'line' : 'quadratic',
          data: { color: lineColor(t?.color ?? palettePick(9)), arrow: t?.arrow ?? 'none', name: t?.name ?? '' },
        }
      }),
  }
}

let rendering = false
let renderQueued = false

// ---- 图谱节点位置持久化（视图偏好，localStorage 按项目隔离；不进 zip/数据）----
interface SavedPos { x: number; y: number }
function posKey(): string {
  return `woc:graph-pos:${store.current?.meta.id ?? 'none'}`
}
function loadPositions(): Record<string, SavedPos> {
  try {
    const raw = localStorage.getItem(posKey())
    const parsed = raw ? JSON.parse(raw) : {}
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}
function savePositions(map: Record<string, SavedPos>): void {
  try { localStorage.setItem(posKey(), JSON.stringify(map)) } catch { /* 容量/隐私模式忽略 */ }
}
function nodeXY(id: string): SavedPos | null {
  // G6 v5：布局/平移后的节点位置在 style.x / style.y（非顶层 x/y）
  const d = graph?.getNodeData(id) as unknown as { style?: { x?: number; y?: number } } | undefined
  if (d && typeof d.style?.x === 'number' && typeof d.style?.y === 'number') return { x: d.style.x, y: d.style.y }
  return null
}

/** 深层变更可能连续触发多次，串行化并在结束后补一次尾随渲染，避免销毁/重建竞态 */
async function render(): Promise<void> {
  if (rendering) {
    renderQueued = true
    return
  }
  rendering = true
  try {
    await doRender()
  } finally {
    rendering = false
    if (renderQueued) {
      renderQueued = false
      void render()
    }
  }
}

async function doRender(): Promise<void> {
  if (!containerEl.value) return
  const c = chartColors()
  const el = containerEl.value
  const data = graphData()
  const key = JSON.stringify(data) + c.text1
  if (graph && key === lastRenderKey) return
  lastRenderKey = key
  // G6 v5.1 增量更新路径（setData+render）创建的边元素先于布局落位，路径退化不可见；
  // 统一销毁重建走挂载路径（preLayoutDraw 先布局后建元素），代价仅为视图复位（与 autoFit 行为一致）
  if (graph) graph.destroy()
  graph = new Graph({
    container: el,
    // 自适应视图但钳制缩放：少节点时不过度放大（≤1.25），大图可充分缩小（≥0.15）
    autoFit: 'view',
    padding: 120,
    zoomRange: [0.15, 1.25],
    data,
    layout: { type: 'force', linkDistance: 140, nodeStrength: -60, collide: 22 },
    node: {
      style: ((d: unknown) => {
        const name = ((d as { data?: { name?: string } }).data ?? {}).name ?? ''
        return {
          size: 38,
          fill: c.surface2,
          stroke: c.border,
          lineWidth: 1.5,
          labelText: name,
          labelFill: c.text1,
          labelFontSize: 12,
          labelPlacement: 'bottom',
        }
      }) as never,
    },
    edge: {
      style: ((d: unknown) => {
        const data = (d as { data?: { color?: string; arrow?: 'none' | 'single' | 'double'; name?: string } }).data ?? {}
        const arrow = data.arrow ?? 'none'
        return {
          stroke: data.color ?? c.border,
          lineWidth: 1.6,
          endArrowSize: arrow === 'none' ? 0 : 6,     // 单/双箭头：终点箭头
          startArrowSize: arrow === 'double' ? 6 : 0, // 双箭头：起点箭头
          labelText: data.name ?? '',
          labelFill: c.text3,
          labelFontSize: 10,
          labelBackground: true,
          labelBackgroundFill: c.surface,
        }
      }) as never,
    },
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
    animation: false,
  })
  graph.on('node:click', ((e: { target: { id: string } }) => {
    router.push({ path: '/characters', query: { id: e.target.id } })
  }) as never)
  graph.on('edge:click', ((e: { target: { id: string } }) => {
    openEditRelation(e.target.id)
  }) as never)
  // 点阵背景跟随视口：aftertransform 时用两点探测换算平移/缩放，同步 CSS 变量
  graph.on('aftertransform', (syncDotGrid as () => void))
  // 节点位置持久化：afterlayout 后恢复已存位置；首次布局落盘（已有位置时不覆盖）
  graph.on('afterlayout', (() => {
    let handled = false
    return () => {
      if (handled || !graph) return
      handled = true
      const saved = loadPositions()
      const ids = new Set(data.nodes.map((n) => n.id))
      const toRestore = Object.entries(saved).filter(([id]) => ids.has(id))
      if (toRestore.length > 0) {
        void graph.translateElementTo(
          Object.fromEntries(toRestore.map(([id, p]) => [id, [p.x, p.y] as [number, number]])),
          false,
        )
        return
      }
      const map: Record<string, SavedPos> = {}
      for (const d of graph.getNodeData()) {
        const p = nodeXY(d.id)
        if (p) map[d.id] = p
      }
      savePositions(map)
    }
  })())
  // 拖拽结束 → 单节点增量保存
  graph.on('node:dragend', ((e: { target: { id: string } }) => {
    const p = nodeXY(e.target.id)
    if (p) {
      const map = loadPositions()
      map[e.target.id] = p
      savePositions(map)
    }
  }) as never)
  setGraphInstance(graph)
  ;(window as unknown as { __wocGraph?: unknown }).__wocGraph = graph // E2E 接缝
  await graph.render()
  syncDotGrid()
}

/** 用 getViewportByCanvas 两点探测视口变换（canvas→屏幕），把平移量/缩放比同步到点阵背景 */
function syncDotGrid(): void {
  if (!graph || !containerEl.value) return
  try {
    // G6 Point 为 [x, y] 元组
    const p0 = graph.getViewportByCanvas([0, 0])
    const p1 = graph.getViewportByCanvas([100, 0])
    const scale = (p1[0] - p0[0]) / 100 || 1
    let size = 26 * scale
    while (size < 10) size *= 5 // 缩远时点阵抽稀，避免糊成一片
    const el = containerEl.value
    el.style.setProperty('--dot-size', `${Math.round(size)}px`)
    el.style.setProperty('--dot-x', `${Math.round(p0[0])}px`)
    el.style.setProperty('--dot-y', `${Math.round(p0[1])}px`)
  } catch { /* 读取失败保持默认静态点阵 */ }
}

function openEditRelation(id: string): void {
  const r = relations.value.find((x) => x.id === id)
  if (!r) return
  editing.value = id
  relForm.from = r.from
  relForm.to = r.to
  relForm.typeId = r.typeId
  relForm.description = r.description
  showNewRelation.value = true
}

function saveRelation(): void {
  if (!store.current || !relForm.from || !relForm.to || !relForm.typeId) return
  const exists = editing.value ? relations.value.find((r) => r.id === editing.value) : null
  if (exists) {
    Object.assign(exists, { from: relForm.from, to: relForm.to, typeId: relForm.typeId, description: relForm.description })
  } else {
    store.current.relations.push({ id: uuid(), from: relForm.from, to: relForm.to, typeId: relForm.typeId, description: relForm.description })
  }
  store.updateRelations()
  showNewRelation.value = false
  editing.value = null
  message.success(exists ? '关系已更新' : '关系已创建')
}

function deleteRelation(): void {
  if (!store.current || !editing.value) return
  store.current.relations = store.current.relations.filter((r) => r.id !== editing.value)
  store.updateRelations()
  showNewRelation.value = false
  editing.value = null
  message.success('关系已删除')
}

function addType(): void {
  if (!store.current) return
  const n = store.current.settings.relationTypes.length
  store.current.settings.relationTypes.push({
    id: uuid(), name: `新类型 ${n + 1}`, color: palettePick(n), arrow: 'single',
  })
  store.updateSettings()
}

function removeType(t: RelationType): void {
  if (!store.current) return
  const used = countOf(t.id)
  if (used > 0) { message.warning(`类型「${t.name}」仍被 ${used} 条关系使用`); return }
  store.current.settings.relationTypes = store.current.settings.relationTypes.filter((x) => x.id !== t.id)
  store.updateSettings()
}

async function exportPng(): Promise<void> {
  if (!graph) return
  try {
    const url = await graph.toDataURL({ type: 'image/png' })
    const res = await fetch(url)
    downloadBlob(await res.blob(), `关系图谱.png`)
    message.success('图谱 PNG 已导出')
  } catch {
    message.error('导出失败')
  }
}

// deep：关系/角色是原地 push/assign 变更（引用不变），浅 watch 不会触发，导致图谱页内新建关系不重绘
watch([relations, characters, enabledTypes, () => theme.theme], () => { void render() }, { deep: true })

onMounted(async () => {
  await nextTick()
  void render()
  resizeObs = new ResizeObserver(() => {
    if (graph && containerEl.value) graph.setSize(containerEl.value.clientWidth, containerEl.value.clientHeight)
  })
  if (containerEl.value) resizeObs.observe(containerEl.value)
})

onUnmounted(() => {
  resizeObs?.disconnect()
  setGraphInstance(null)
  graph?.destroy()
  graph = null
  lastRenderKey = ''
})
</script>

<style scoped>
.graph { display: flex; flex-direction: column; gap: var(--space-2); height: 100%; }
.toolbar { padding: 10px var(--space-2); display: flex; justify-content: space-between; gap: var(--space-2); flex-wrap: wrap; }
.types { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
.type-filter { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
.type-filter .dot { width: 10px; height: 10px; border-radius: 50%; }
.count { font-size: 11px; color: var(--text-3); }
.ops { display: flex; gap: 8px; }
.graph-wrap { flex: 1; min-height: 0; position: relative; background: var(--surface); overflow: hidden; }
/* 底部点阵（移动暗示）：背景画在 G6 容器上，跟随视口平移/缩放移动（syncDotGrid 写 CSS 变量），token 取色随主题切换 */
.g6-container {
  width: 100%; height: 100%;
  background-image: radial-gradient(var(--border) 1.1px, transparent 1.1px);
  background-size: var(--dot-size, 26px) var(--dot-size, 26px);
  background-position: var(--dot-x, 0px) var(--dot-y, 0px);
}
.g6-container { width: 100%; height: 100%; }
.overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.rel-form { display: flex; flex-direction: column; gap: 10px; }
.row-ops { display: flex; gap: 8px; }
.type-mgr { display: flex; flex-direction: column; gap: 8px; }
.trow { display: flex; align-items: center; gap: 10px; }
.tname { flex: 1; background: var(--bg); border: 1px solid var(--border-weak); border-radius: var(--radius-s); color: var(--text-1); padding: 5px 10px; font-size: 13px; outline: none; }
.tcolor { width: 34px; height: 26px; border: none; background: transparent; cursor: pointer; padding: 0; }
.tdir { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-2); white-space: nowrap; }
.mini { border: none; background: transparent; color: var(--text-3); cursor: pointer; padding: 3px; }
.mini.danger:hover { color: var(--text-1); }
.new-t { margin-top: 6px; }
</style>
