<template>
  <EmptyProject>
    <div
      class="page timeline"
      :class="orientation"
    >
      <!-- 顶栏：世界线管理 -->
      <div class="wl-bar panel">
        <div class="wl-chips">
          <div
            v-for="w in worldlines"
            :key="w.id"
            class="wl-chip"
            :class="{ hidden: !visibleLanes.has(w.id), abandoned: w.status === 'abandoned' }"
          >
            <button
              class="dot"
              :style="{ background: lineColor(w.color) }"
              :title="visibleLanes.has(w.id) ? '隐藏轨道' : '显示轨道'"
              @click="toggleLane(w.id)"
            />
            <span
              class="wl-name"
              @dblclick="renameWorldline(w)"
            >{{ w.name }}</span>
            <n-tag
              v-if="w.parentWorldlineId"
              size="tiny"
              round
              :bordered="false"
            >
              IF
            </n-tag>
            <n-tag
              v-if="w.status === 'abandoned'"
              size="tiny"
              round
              :bordered="false"
            >
              废弃
            </n-tag>
            <button
              class="mini"
              :title="w.status === 'active' ? '标记废弃' : '恢复'"
              @click="toggleStatus(w)"
            >
              <Ban
                v-if="w.status === 'active'"
                :size="12"
              /><RotateCcw
                v-else
                :size="12"
              />
            </button>
            <button
              v-if="w.parentWorldlineId"
              class="mini danger"
              title="删除此线（含其事件与后代线）"
              @click="removeWorldline(w)"
            >
              <Trash2 :size="12" />
            </button>
          </div>
        </div>
        <div class="wl-bar-ops">
          <n-button
            size="small"
            @click="expandAbandoned = !expandAbandoned"
          >
            {{ expandAbandoned ? '折叠废弃线' : '展开废弃线' }}
          </n-button>
          <n-button
            size="small"
            @click="exportPng"
          >
            <ImageDown :size="14" /> 导出 PNG
          </n-button>
          <n-button
            size="small"
            @click="toggleOrientation"
          >
            <Columns
              v-if="orientation === 'v'"
              :size="14"
            /> 切换到{{ orientation === 'h' ? '纵向' : '横向' }}
          </n-button>
        </div>
      </div>

      <!-- 草稿箱（顶部固定区）：所有未定时事件 -->
      <div class="draft-box panel">
        <div class="draft-title">
          草稿箱（未定时）{{ drafts.length ? `· ${drafts.length}` : '' }}
        </div>
        <div class="draft-cards">
          <n-empty
            v-if="drafts.length === 0"
            size="small"
            description="无草稿"
          />
          <div
            v-for="d in drafts"
            :key="d.id"
            class="card draft"
            @click="openDrawer(d)"
          >
            <div class="card-title">
              {{ d.title }}
            </div>
            <span class="badge pending">待排序</span>
          </div>
          <n-button
            size="small"
            type="primary"
            @click="addDraft"
          >
            <Plus :size="14" /> 新建草稿事件
          </n-button>
        </div>
      </div>

      <!-- 泳道：每条世界线一条轨道；fork 线从锚点岔出（SVG 覆盖层绘制连接线） -->
      <div
        ref="lanesEl"
        class="lanes panel"
        @scroll.passive="refreshConnectors"
      >
        <svg
          v-if="connectors.length"
          class="fork-overlay"
          :width="overlayW"
          :height="overlayH"
        >
          <path
            v-for="c in connectors"
            :key="c.id"
            :d="c.d"
            :stroke="c.color"
            fill="none"
          />
        </svg>
        <div
          v-for="l in lanes"
          :key="l.wl.id"
          class="lane"
          :class="{ abandoned: l.wl.status === 'abandoned' }"
          :data-lane="l.wl.id"
        >
          <div class="lane-head">
            <span
              class="lane-dot"
              :style="{ background: lineColor(l.wl.color) }"
            />
            <span class="lane-name">
              {{ l.wl.name }}
            </span>
            <n-tag
              v-if="l.wl.forkPointEventId && !anchorExists(l.wl.id)"
              size="tiny"
              round
              :bordered="false"
            >
              分叉点失效
            </n-tag>
          </div>
          <div class="lane-cards">
            <n-empty
              v-if="branchEvents(l.wl.id).length === 0"
              size="small"
              description="空轨道"
            />
            <div
              v-for="{ event, badge } in branchEvents(l.wl.id)"
              :key="event.id"
              class="card"
              :class="{ locked: event.locked, collapsed: event.collapsed, dragging: draggingId === event.id }"
              :data-eid="event.id"
              draggable="true"
              @click="openDrawer(event)"
              @dragstart="onDragStart($event, l.wl.id, event.id)"
              @dragend="onDragEnd"
              @dragover.prevent
              @drop.prevent="onDrop($event, l.wl.id, event.id)"
            >
              <div class="card-title">
                {{ event.title }}
              </div>
              <div class="card-time">
                {{ displayTime(event.time) }}
              </div>
              <div
                v-if="badge"
                class="badge"
                :class="badge"
              >
                {{ badgeText[badge] }}
              </div>
            </div>
          </div>
        </div>
        <n-empty
          v-if="lanes.length === 0"
          size="small"
          description="暂无世界线"
        />
      </div>
    </div>
  </EmptyProject>

  <EventDrawer
    :event="selectedEvent"
    @close="selectedEvent = null"
    @forked="onForked"
  />
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { NButton, NTag, NEmpty, NInput, useDialog, useMessage } from 'naive-ui'
import { Plus, Trash2, Ban, RotateCcw, ImageDown, Columns } from 'lucide-vue-next'
import EmptyProject from '@/components/EmptyProject.vue'
import EventDrawer from '@/components/timeline/EventDrawer.vue'
import { useProjectStore } from '@/stores/project'
import { useThemeStore } from '@/stores/theme'
import { badgeFor, displayTime } from '@/utils/branchOrder'
import { resolveDataColor } from '@/utils/colors'
import { removeWorldlineCascade } from '@/utils/integrity'
import { uuid } from '@/utils/id'
import { downloadBlob } from '@/utils/download'
import type { TimelineEvent, Worldline } from '@/types'

const store = useProjectStore()
const theme = useThemeStore()
const dialog = useDialog()
const message = useMessage()

const selectedEvent = ref<TimelineEvent | null>(null)
const expandAbandoned = ref(false)
const visibleLanes = ref<Set<string>>(new Set())
const lanesEl = ref<HTMLElement | null>(null)
const overlayW = ref(0)
const overlayH = ref(0)

// ---- 横 / 纵布局（PC 默认横向，移动端默认纵向；用户切换存 localStorage）----
const orientation = ref<'h' | 'v'>(
  (localStorage.getItem('timelineOrientation') as 'h' | 'v')
    ?? (window.matchMedia('(max-width: 767px)').matches ? 'v' : 'h'),
)
function toggleOrientation(): void {
  orientation.value = orientation.value === 'h' ? 'v' : 'h'
  localStorage.setItem('timelineOrientation', orientation.value)
  void nextTick(refreshConnectors)
}

// ---- 世界线 ----
const worldlines = computed(() =>
  [...(store.current?.settings.worldlines ?? [])].sort((a, b) => a.order - b.order))

watch(worldlines, (list) => {
  const next = new Set<string>()
  for (const w of list) {
    if (w.status === 'active' || expandAbandoned.value) next.add(w.id)
    else if (visibleLanes.value.has(w.id)) next.add(w.id)
  }
  visibleLanes.value = next
}, { immediate: true })

watch(expandAbandoned, () => {
  const next = new Set(visibleLanes.value)
  for (const w of worldlines.value) {
    if (w.status === 'abandoned') {
      if (expandAbandoned.value) next.add(w.id)
      else next.delete(w.id)
    }
  }
  visibleLanes.value = next
})

// ---- 泳道树（父线先于子线渲染；fork 锚点 = 子线 forkPointEventId）----
interface Lane { wl: Worldline; anchorEventId: string | null }

const lanes = computed<Lane[]>(() => {
  const byParent = new Map<string | null, Worldline[]>()
  for (const w of worldlines.value) {
    if (!byParent.has(w.parentWorldlineId)) byParent.set(w.parentWorldlineId, [])
    byParent.get(w.parentWorldlineId)!.push(w)
  }
  const out: Lane[] = []
  const walk = (parentId: string | null) => {
    for (const w of byParent.get(parentId) ?? []) {
      if (!visibleLanes.value.has(w.id)) { walk(w.id); continue }
      out.push({ wl: w, anchorEventId: w.parentWorldlineId ? w.forkPointEventId : null })
      walk(w.id)
    }
  }
  walk(null)
  return out
})

/** 线内排序事件 + 徽标（badgeFor 需要前驱/后继） */
function branchEvents(wlId: string): { event: TimelineEvent; badge: ReturnType<typeof badgeFor> }[] {
  const all = store.current?.events ?? []
  const es = all
    .filter((e) => e.worldlineId === wlId)
    .sort((a, b) => a.rank - b.rank)
  return es.map((e, i) => ({ event: e, badge: badgeFor(e, es[i - 1] ?? null, es[i + 1] ?? null) }))
}

function anchorExists(wlId: string): boolean {
  const l = lanes.value.find((x) => x.wl.id === wlId)
  return l?.anchorEventId ? (store.current?.events ?? []).some((e) => e.id === l.anchorEventId) : true
}

const drafts = computed(() => (store.current?.events ?? []).filter((e) => e.worldlineId === null))

const badgeText: Record<string, string> = { pending: '待排序', manual: '手动序', 'era-boundary': '历法转接，请核对' }

// ---- 事件操作 ----
function openDrawer(e: TimelineEvent): void {
  selectedEvent.value = e
}

function addDraft(): void {
  const e: TimelineEvent = {
    id: uuid(), worldlineId: null, time: null,
    title: '未命名事件', description: '',
    participantIds: [], relatedCodexIds: [],
    rank: 0, manualPlaced: false, collapsed: false, locked: false,
  }
  store.upsertEvent(e)
  openDrawer(e)
  message.info('已加入草稿箱，补全时间后进入世界线')
}

function onNewEventShortcut(): void {
  addDraft()
}
onMounted(() => window.addEventListener('woc:new-event', onNewEventShortcut))
onUnmounted(() => window.removeEventListener('woc:new-event', onNewEventShortcut))

function onForked(): void {
  message.info('新 IF 线已出现在轨道中')
}

// ---- 世界线管理（沿用旧交互）----
function toggleLane(id: string): void {
  const next = new Set(visibleLanes.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  visibleLanes.value = next
}

function toggleStatus(w: Worldline): void {
  if (!store.current) return
  w.status = w.status === 'active' ? 'abandoned' : 'active'
  store.updateSettings()
}

function renameWorldline(w: Worldline): void {
  if (!store.current) return
  const nameRef = ref(w.name)
  dialog.create({
    title: '重命名世界线',
    content: () => h(NInput, { value: nameRef.value, 'onUpdate:value': (v: string) => (nameRef.value = v) }),
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      if (nameRef.value.trim()) { w.name = nameRef.value.trim(); store.updateSettings() }
    },
  })
}

function removeWorldline(w: Worldline): void {
  if (!store.current) return
  const data = store.current
  const subtree = new Set<string>([w.id])
  let grew = true
  while (grew) {
    grew = false
    for (const line of data.settings.worldlines) {
      if (line.parentWorldlineId && subtree.has(line.parentWorldlineId) && !subtree.has(line.id)) { subtree.add(line.id); grew = true }
    }
  }
  const removedEventIds = data.events.filter((e) => e.worldlineId !== null && subtree.has(e.worldlineId)).map((e) => e.id)
  dialog.warning({
    title: '删除世界线',
    content: `「${w.name}」及其 ${removedEventIds.length} 个事件（含全部后代线）将一并删除。主世界线不可删除。确定？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      removeWorldlineCascade(data, w.id)
      store.updateSettings()
      for (const id of removedEventIds) store.mark({ kind: 'event', id })
      await store.flush()
      message.success('世界线已删除')
    },
  })
}

// ---- 线内拖拽重排（HTML5 DnD；仅同线内）----
const draggingId = ref<string | null>(null)
const dragState = ref<{ fromLine: string; eventId: string } | null>(null)

function onDragStart(e: DragEvent, lineId: string, eventId: string): void {
  dragState.value = { fromLine: lineId, eventId }
  draggingId.value = eventId
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragEnd(): void {
  // 拖拽被取消（未落卡）时也清理状态
  draggingId.value = null
  dragState.value = null
}

function onDrop(e: DragEvent, lineId: string, targetEventId: string): void {
  const d = dragState.value
  draggingId.value = null
  if (!d || d.eventId === targetEventId) return
  if (d.fromLine !== lineId) return // 跨线移动请用事件抽屉的"所属世界线"选择器
  const order = branchEvents(lineId).map((x) => x.event.id)
  order.splice(order.indexOf(d.eventId), 1)
  order.splice(order.indexOf(targetEventId), 0, d.eventId)
  store.reorderBranch(lineId, order)
  dragState.value = null
}

// ---- fork 连接线（SVG 覆盖层，DOM 量测 + ResizeObserver）----
interface Connector { id: string; d: string; color: string }
const connectors = ref<Connector[]>([])

function refreshConnectors(): void {
  if (!lanesEl.value) return
  // 坐标用内容系（容器 scroll 偏移矫正），overlay 随内容滚动不漂移
  const cRect = lanesEl.value.getBoundingClientRect()
  const originX = cRect.left - lanesEl.value.scrollLeft
  const originY = cRect.top - lanesEl.value.scrollTop
  overlayW.value = lanesEl.value.scrollWidth
  overlayH.value = lanesEl.value.scrollHeight
  const out: Connector[] = []
  const hMode = orientation.value === 'h'
  for (const l of lanes.value) {
    const pid = l.wl.parentWorldlineId
    if (!l.anchorEventId || !pid || !lanesEl.value) continue
    const parentEl = lanesEl.value.querySelector<HTMLElement>(`[data-lane="${pid}"] [data-eid="${l.anchorEventId}"]`)
    const firstEl = lanesEl.value.querySelector<HTMLElement>(`[data-lane="${l.wl.id}"] .card`)
    if (!parentEl || !firstEl) continue
    const pr = parentEl.getBoundingClientRect()
    const fr = firstEl.getBoundingClientRect()
    const x1 = pr.left - originX + pr.width / 2
    const y1 = hMode ? pr.bottom - originY : pr.top - originY + pr.height / 2
    const x2 = fr.left - originX + fr.width / 2
    const y2 = hMode ? fr.top - originY : fr.top - originY + fr.height / 2
    const d = hMode
      ? `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`
      : `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`
    out.push({ id: l.wl.id, d, color: lineColor(l.wl.color) })
  }
  connectors.value = out
}

let resizeObs: ResizeObserver | null = null

// ---- 导出 PNG（当前泳道面板，按主题质感）----
async function exportPng(): Promise<void> {
  if (!lanesEl.value) return
  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(lanesEl.value, {
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(),
      scale: 2,
    })
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, '时间轴.png')
      message.success('时间轴 PNG 已导出')
    }, 'image/png')
  } catch {
    message.error('导出失败')
  }
}

function lineColor(hex: string): string {
  return resolveDataColor(hex, theme.isDark ? 'dark' : 'light')
}

onMounted(() => {
  resizeObs = new ResizeObserver(() => void nextTick(refreshConnectors))
  if (lanesEl.value) resizeObs.observe(lanesEl.value)
  void nextTick(refreshConnectors)
})
onUnmounted(() => {
  resizeObs?.disconnect()
  window.removeEventListener('woc:new-event', onNewEventShortcut)
})

// 事件/排序/可见线变化后重测连接线
watch(
  [() => (store.current?.events ?? []).map((e) => e.rank).join(','), lanes, orientation],
  () => void nextTick(refreshConnectors),
  { deep: true },
)
</script>

<style scoped>
.timeline { display: flex; flex-direction: column; gap: var(--space-2); height: 100%; min-height: 0; }
.wl-bar { padding: 10px var(--space-2); display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.wl-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.wl-chip { display: flex; align-items: center; gap: 6px; border: 1px solid var(--border-weak); border-radius: var(--radius-m); padding: 4px 10px; font-size: 13px; }
.wl-chip.hidden { opacity: 0.45; }
.wl-chip.abandoned .wl-name { text-decoration: line-through; }
.wl-chip .dot { width: 11px; height: 11px; border-radius: 50%; border: none; cursor: pointer; }
.wl-name { cursor: default; }
.mini { border: none; background: transparent; color: var(--text-3); cursor: pointer; padding: 2px; display: grid; place-items: center; }
.mini:hover { color: var(--text-1); }
.wl-bar-ops { display: flex; gap: 8px; }

/* 草稿箱（顶部固定区） */
.draft-box { padding: var(--space-2); display: flex; flex-direction: column; gap: 8px; }
.draft-title { font-size: 12px; color: var(--text-3); }
.draft-cards { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

/* 泳道区 */
.lanes {
  flex: 1; min-height: 0; position: relative; overflow: auto; padding: var(--space-3);
  display: flex; align-content: flex-start; gap: var(--space-3);
}
.fork-overlay { position: absolute; top: 0; left: 0; pointer-events: none; }
.fork-overlay path { stroke-width: 1.5; stroke-dasharray: 4 3; opacity: 0.8; }

/* 横向（默认）：泳道为整行，卡片从左向右流 */
.timeline.h .lanes { flex-direction: column; }
.timeline.h .lane { display: flex; flex-direction: column; }
.timeline.h .lane { flex: none; width: 100%; }
.timeline.h .lane-cards { display: flex; gap: var(--space-2); overflow-x: auto; padding-bottom: 4px; }

/* 纵向：泳道为列，卡片从上向下流 */
.timeline.v .lanes { flex-direction: row; align-items: flex-start; }
.timeline.v .lane { flex: 0 0 auto; width: 260px; }
.timeline.v .lane-cards { display: flex; flex-direction: column; gap: var(--space-2); }

.lane { display: flex; flex-direction: column; gap: 8px; }
.lane.abandoned { opacity: 0.55; }
.lane-head { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text-1); }
.lane-dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
.lane-name { white-space: nowrap; }
.lane-cards { max-height: 100%; }

/* 卡片 */
.card {
  display: flex; flex-direction: column; gap: 4px;
  border: 1px solid var(--border-weak); border-radius: var(--radius-m);
  background: var(--surface-2); padding: 10px 12px; cursor: pointer;
  min-width: 150px; max-width: 220px; flex-shrink: 0;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}
.card:hover { border-color: var(--accent); box-shadow: var(--shadow-1); }
.card.locked { border-color: var(--accent); }
.card.collapsed { opacity: 0.6; }
.card.dragging { opacity: 0.5; }
.card.draft { max-width: 180px; }
.card-title { font-size: 13px; font-weight: 600; color: var(--text-1); display: flex; align-items: center; gap: 4px; }
.card-time { font-size: 11px; color: var(--text-3); }
.lock { font-size: 11px; }

/* 排序徽标（纯 token 配色） */
.badge { align-self: flex-start; font-size: 10px; border-radius: var(--radius-s); padding: 1px 6px; }
.badge.pending { color: var(--text-2); background: var(--surface); border: 1px solid var(--border-weak); }
.badge.manual { color: var(--accent-text); background: var(--accent-weak); }
.badge.era-boundary { color: var(--surface); background: var(--accent); }
</style>
