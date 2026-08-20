<template>
  <EmptyProject>
    <div class="page timeline">
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
            type="primary"
            @click="addEventClicked = true"
          >
            <Plus :size="14" /> 新建事件
          </n-button>
        </div>
      </div>

      <div class="main-row">
        <!-- 时间轴画板（纯 surface 背景，无纹理叠加） -->
        <div
          ref="boardEl"
          class="board panel"
          @wheel.prevent="onWheel"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @click.self="onBoardClick"
        >
          <svg
            :width="boardW"
            :height="boardH"
            class="axis-svg"
          >
            <!-- 中心轴刻度 -->
            <g
              v-for="t in ticks"
              :key="t.x"
            >
              <line
                :x1="t.x"
                y1="0"
                :x2="t.x"
                :y2="boardH"
                class="tick-line"
              />
              <text
                :x="t.x"
                :y="boardH - 6"
                class="tick-text"
              >{{ t.label }}</text>
            </g>
            <!-- 轨道 -->
            <g
              v-for="lane in lanes"
              :key="lane.w.id"
            >
              <line
                :x1="pad"
                :y1="laneY(lane.index)"
                :x2="boardW - pad"
                :y2="laneY(lane.index)"
                :stroke="lineColor(lane.w.color)"
                :stroke-width="lane.w.status === 'abandoned' ? 1 : 2"
                :stroke-dasharray="lane.w.status === 'abandoned' ? '6 6' : undefined"
                :opacity="lane.w.status === 'abandoned' ? 0.5 : 0.7"
              />
              <text
                :x="pad - 8"
                :y="laneY(lane.index) + 4"
                text-anchor="end"
                class="lane-name"
                :fill="lineColor(lane.w.color)"
              >
                {{ lane.w.name }}{{ lane.view.forkBroken ? ' ⚠分叉点失效' : '' }}
              </text>
              <!-- fork 分叉曲线 -->
              <path
                v-if="lane.forkPoint"
                :d="lane.forkPoint.path"
                class="fork-curve"
                :stroke="lineColor(lane.w.color)"
                fill="none"
              />
              <!-- 继承事件（淡化；同刻事件纵向错开，保证可点选） -->
              <g
                v-for="e in lane.view.inherited"
                :key="'i' + e.id"
                class="event inherited"
                @click.stop="openEvent(e)"
              >
                <circle
                  :cx="xOf(e)"
                  :cy="eventY(lane, e)"
                  r="5"
                  :fill="lineColor(lane.w.color)"
                  opacity="0.45"
                />
                <text
                  :x="xOf(e)"
                  :y="eventY(lane, e) - 10"
                  class="event-label dim"
                  text-anchor="middle"
                >{{ e.title }}</text>
              </g>
              <!-- 本线事件 -->
              <g
                v-for="e in lane.view.own"
                :key="e.id"
                class="event"
                @click.stop="openEvent(e)"
              >
                <circle
                  :cx="xOf(e)"
                  :cy="eventY(lane, e)"
                  r="6"
                  :fill="lineColor(lane.w.color)"
                  :class="{ locked: e.locked }"
                />
                <text
                  :x="xOf(e)"
                  :y="eventY(lane, e) - 12"
                  class="event-label"
                  text-anchor="middle"
                >{{ e.title }}</text>
                <text
                  v-if="e.participantIds.length"
                  :x="xOf(e)"
                  :y="eventY(lane, e) + 18"
                  class="event-meta"
                  text-anchor="middle"
                >{{ e.participantIds.length }} 角色</text>
              </g>
            </g>
            <text
              v-if="lanes.length === 0"
              :x="boardW / 2"
              :y="boardH / 2"
              text-anchor="middle"
              class="empty-hint"
            >暂无世界线事件——点击「新建事件」开始书写历史</text>
          </svg>
        </div>

        <!-- 侧栏：未定时草稿 + 全部事件（按世界线分组、按时间排序） -->
        <aside class="untimed panel">
          <div class="untimed-title">
            未定时草稿（{{ untimedEvents.length }}）
          </div>
          <div
            v-for="e in untimedEvents"
            :key="e.id"
            class="untimed-item"
            @click="openEvent(e)"
          >
            <CircleDashed :size="13" /> {{ e.title }}
          </div>
          <n-empty
            v-if="untimedEvents.length === 0"
            size="small"
            description="无"
          />
          <n-button
            size="tiny"
            quaternary
            style="margin-top: 4px"
            @click="router.push('/timeline/canvas')"
          >
            去画布整理 <ArrowRight :size="12" />
          </n-button>

          <div class="untimed-divider" />
          <div class="untimed-title">
            全部事件（{{ timedTotal }}）
          </div>
          <div
            v-for="g in eventGroups"
            :key="g.w.id"
            class="ev-group"
          >
            <div
              class="ev-group-head"
              :style="{ color: lineColor(g.w.color) }"
            >
              <span
                class="ev-dot"
                :style="{ background: lineColor(g.w.color) }"
              />{{ g.w.name }}（{{ g.events.length }}）
            </div>
            <div
              v-for="e in g.events"
              :key="e.id"
              class="untimed-item ev-row"
              :title="e.time?.display"
              @click="openEvent(e)"
            >
              <span class="ev-time">{{ e.time?.display }}</span>{{ e.title }}
            </div>
          </div>
          <n-empty
            v-if="eventGroups.length === 0"
            size="small"
            description="暂无定时事件"
          />
        </aside>
      </div>
    </div>
  </EmptyProject>

  <EventDrawer
    :event="selectedEvent"
    @close="selectedEvent = null"
    @forked="onForked"
  />

  <!-- 新建事件：选线 + 时间 -->
  <n-modal
    v-model:show="addEventClicked"
    preset="dialog"
    title="新建事件"
  >
    <div class="new-ev">
      <n-select
        v-model:value="newEventWl"
        :options="worldlineOptions"
        placeholder="世界线"
      />
      <n-checkbox v-model:checked="newEventTimed">
        定时
      </n-checkbox>
      <n-input-number
        v-if="newEventTimed"
        v-model:value="newEventTime"
        :step="1"
        placeholder="纪年数值"
        style="width: 150px"
      />
    </div>
    <template #action>
      <n-button
        type="primary"
        @click="createEvent"
      >
        创建并编辑
      </n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, h, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton, NTag, NEmpty, NModal, NSelect, NInput, NInputNumber, NCheckbox, useDialog, useMessage,
} from 'naive-ui'
import { Plus, Trash2, Ban, RotateCcw, CircleDashed, ArrowRight, ImageDown } from 'lucide-vue-next'
import EmptyProject from '@/components/EmptyProject.vue'
import EventDrawer from '@/components/timeline/EventDrawer.vue'
import { useProjectStore } from '@/stores/project'
import { useThemeStore } from '@/stores/theme'
import { eventAbs } from '@/utils/calendar'
import { allWorldlineViews, type WorldlineView } from '@/utils/fork'
import { resolveDataColor } from '@/utils/colors'
import { removeWorldlineCascade } from '@/utils/integrity'
import { uuid } from '@/utils/id'
import { downloadBlob } from '@/utils/download'
import type { TimelineEvent, Worldline } from '@/types'

const store = useProjectStore()
const theme = useThemeStore()
const router = useRouter()
const dialog = useDialog()
const message = useMessage()

const boardEl = ref<HTMLElement | null>(null)
const boardW = ref(1000)
const boardH = ref(500)
const pad = 150
const laneGap = 90
const selectedEvent = ref<TimelineEvent | null>(null)
const addEventClicked = ref(false)
const newEventWl = ref<string | null>(null)
const newEventTimed = ref(true)
const newEventTime = ref(0)
const expandAbandoned = ref(false)
const visibleLanes = ref<Set<string>>(new Set())

// 视窗（绝对纪元域）：缩放 / 平移状态
const view = reactive({ start: 0, end: 100 })

const worldlines = computed(() =>
  [...(store.current?.settings.worldlines ?? [])].sort((a, b) => a.order - b.order))

const worldlineOptions = computed(() => worldlines.value.map((w) => ({
  label: w.name + (w.status === 'abandoned' ? '（已废弃）' : ''), value: w.id,
})))

watch(worldlines, (list) => {
  // 默认：active 线可见；废弃线随 expandAbandoned
  const next = new Set<string>()
  for (const w of list) {
    if (w.status === 'active' || expandAbandoned.value) next.add(w.id)
    else if (visibleLanes.value.has(w.id)) next.add(w.id)
  }
  visibleLanes.value = next
  if (!newEventWl.value && list[0]) newEventWl.value = list[0].id
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

const views = computed(() => (store.current ? allWorldlineViews(store.current) : []))

interface Lane {
  w: Worldline
  view: WorldlineView
  index: number
  forkPoint: { path: string } | null
  /** 同刻（相同绝对纪元）事件 → 纵向错开偏移，解决叠在一起无法点选 */
  offsets: Map<string, number>
}

/** 同刻事件纵向扇形错开：第 i 个偏移 ((i%5)-2)*16 → 0/±16/±32 循环 */
function clusterOffsets(events: TimelineEvent[]): Map<string, number> {
  const cal = store.current?.settings.calendars ?? []
  const sorted = [...events].sort((a, b) => (eventAbs(a, cal) ?? 0) - (eventAbs(b, cal) ?? 0))
  const map = new Map<string, number>()
  let key: number | null = null
  let group: TimelineEvent[] = []
  const flush = (): void => {
    group.forEach((e, i) => map.set(e.id, ((i % 5) - 2) * 16))
    group = []
  }
  for (const e of sorted) {
    const a = eventAbs(e, cal) ?? 0
    if (key !== null && a === key) group.push(e)
    else { flush(); key = a; group = [e] }
  }
  flush()
  return map
}

// 基础轨道（fork 曲线需要父线 y——父线必然排在子线前面）
const lanes0 = computed<Lane[]>(() => {
  let index = 0
  return views.value
    .filter((v) => visibleLanes.value.has(v.worldlineId))
    .map((v) => {
      const w = worldlines.value.find((x) => x.id === v.worldlineId)!
      return {
        w, view: v, index: index++, forkPoint: null,
        offsets: clusterOffsets([...v.inherited, ...v.own]),
      }
    })
})

function eventY(lane: Lane, e: TimelineEvent): number {
  return laneY(lane.index) + (lane.offsets.get(e.id) ?? 0)
}

const lanes = computed<Lane[]>(() => {
  const cal = store.current?.settings.calendars ?? []
  return lanes0.value.map((lane) => {
    const w = lane.w
    if (!w.forkPointEventId) return lane
    const fe = store.current?.events.find((e) => e.id === w.forkPointEventId)
    if (!fe || !fe.time) return lane
    const parentIdx = lanes0.value.findIndex((l) => l.w.id === w.parentWorldlineId)
    const px = xOfAbs(eventAbs(fe, cal) ?? 0)
    const y1 = parentIdx >= 0 ? laneY(lanes0.value[parentIdx].index) : laneY(lane.index) - laneGap
    const y2 = laneY(lane.index)
    return { ...lane, forkPoint: { path: `M ${px} ${y1} C ${px} ${y1 + 30}, ${px} ${y2 - 30}, ${px} ${y2}` } }
  })
})

const untimedEvents = computed(() =>
  (store.current?.events ?? []).filter((e) => e.time === null))

/** 侧栏「全部事件」：按世界线分组（order 序），组内按绝对纪元升序 */
const eventGroups = computed(() => {
  const data = store.current
  if (!data) return []
  const cal = data.settings.calendars
  return [...data.settings.worldlines]
    .sort((a, b) => a.order - b.order)
    .map((w) => ({
      w,
      events: data.events
        .filter((e) => e.worldlineId === w.id && e.time !== null)
        .sort((a, b) => (eventAbs(a, cal) ?? 0) - (eventAbs(b, cal) ?? 0)),
    }))
    .filter((g) => g.events.length > 0)
})

const timedTotal = computed(() => eventGroups.value.reduce((n, g) => n + g.events.length, 0))

// 时间域
const allAbs = computed(() => {
  const cal = store.current?.settings.calendars ?? []
  const vals: number[] = []
  for (const e of store.current?.events ?? []) {
    const a = e.time ? eventAbs(e, cal) : null
    if (a !== null) vals.push(a)
  }
  return vals
})

watch(allAbs, (vals) => {
  if (vals.length === 0) { view.start = 0; view.end = 100; return }
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = Math.max(max - min, 1)
  view.start = min - span * 0.1
  view.end = max + span * 0.1
}, { immediate: true })

const ticks = computed(() => {
  const span = view.end - view.start
  const rawStep = span / 8
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? mag * 10
  const out: { x: number; label: string }[] = []
  for (let v = Math.ceil(view.start / step) * step; v <= view.end; v += step) {
    out.push({ x: xOfAbs(v), label: fmtTick(v) })
  }
  return out
})

function fmtTick(v: number): string {
  if (Math.abs(v) >= 1e5 || (Math.abs(v) < 1 && v !== 0)) return v.toPrecision(3)
  return String(Math.round(v * 100) / 100)
}

const LANE_BASE = 46
function laneY(index: number): number { return LANE_BASE + index * laneGap }
function xOfAbs(abs: number): number {
  const f = (abs - view.start) / (view.end - view.start)
  return pad + f * (boardW.value - pad * 2)
}
function absOfX(x: number): number {
  const f = (x - pad) / (boardW.value - pad * 2)
  return view.start + f * (view.end - view.start)
}
function xOf(e: TimelineEvent): number {
  const cal = store.current?.settings.calendars ?? []
  return xOfAbs(e.time ? eventAbs(e, cal) ?? 0 : 0)
}

function lineColor(hex: string): string {
  return resolveDataColor(hex, theme.isDark ? 'dark' : 'light')
}

// ---- 缩放 / 平移（M4 交互）----
function onWheel(ev: WheelEvent): void {
  const rect = boardEl.value!.getBoundingClientRect()
  const x = ev.clientX - rect.left
  const anchor = absOfX(x)
  const factor = ev.deltaY > 0 ? 1.15 : 1 / 1.15
  const start = anchor - (anchor - view.start) * factor
  const end = anchor + (view.end - anchor) * factor
  view.start = start
  view.end = end
}

let dragging = false
let dragX = 0
let dragStart0 = 0
let dragEnd0 = 0
let dragMoved = false

function onPointerDown(ev: PointerEvent): void {
  if ((ev.target as HTMLElement).closest('.event')) return
  dragging = true
  dragMoved = false
  dragX = ev.clientX
  dragStart0 = view.start
  dragEnd0 = view.end
  ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
}

function onPointerMove(ev: PointerEvent): void {
  if (!dragging) return
  const dx = ev.clientX - dragX
  if (Math.abs(dx) > 3) dragMoved = true
  const span = dragEnd0 - dragStart0
  const dAbs = (-dx / (boardW.value - pad * 2)) * span
  view.start = dragStart0 + dAbs
  view.end = dragEnd0 + dAbs
}

function onPointerUp(): void { dragging = false }

/** 点击轨道空白处：在该线该时刻插入事件（M4 时间轴交互）*/
function onBoardClick(ev: MouseEvent): void {
  if (dragMoved || !store.current) return
  const target = ev.target as HTMLElement
  if (!target.classList.contains('axis-svg')) return
  const rect = boardEl.value!.getBoundingClientRect()
  const x = ev.clientX - rect.left
  const y = ev.clientY - rect.top
  const laneIdx = Math.round((y - LANE_BASE) / laneGap)
  const lane = lanes.value[laneIdx]
  if (!lane) return
  const abs = absOfX(x)
  const cal = store.current.settings.calendars[0]
  if (!cal) return
  const value = Math.round((abs - cal.offset) / cal.unitYears)
  const e: TimelineEvent = {
    id: uuid(), worldlineId: lane.w.id,
    time: { calendarId: cal.id, value, display: `${cal.name} ${value} 年` },
    title: '新事件', description: '', participantIds: [], locationId: null, causalLinks: [],
    collapsed: false, locked: false,
  }
  store.upsertEvent(e)
  selectedEvent.value = e
}

// ---- 事件 ----
function openEvent(e: TimelineEvent): void {
  selectedEvent.value = e
}

function createEvent(): void {
  if (!store.current || !newEventWl.value) return
  const cal = store.current.settings.calendars[0]
  const e: TimelineEvent = {
    id: uuid(), worldlineId: newEventWl.value,
    time: newEventTimed.value && cal ? { calendarId: cal.id, value: newEventTime.value, display: `${cal.name} ${newEventTime.value} 年` } : null,
    title: '新事件', description: '', participantIds: [], locationId: null, causalLinks: [],
    collapsed: false, locked: false,
  }
  store.upsertEvent(e)
  addEventClicked.value = false
  selectedEvent.value = e
}

function onForked(): void {
  message.info('新 IF 线已出现在轨道中')
}

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
  // 级联范围预计算：子树全部世界线 + 其事件（用于脏标记删除行）
  const subtree = new Set<string>([w.id])
  let grew = true
  while (grew) {
    grew = false
    for (const line of data.settings.worldlines) {
      if (line.parentWorldlineId && subtree.has(line.parentWorldlineId) && !subtree.has(line.id)) { subtree.add(line.id); grew = true }
    }
  }
  const removedEventIds = data.events.filter((e) => subtree.has(e.worldlineId)).map((e) => e.id)
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

let resizeObs: ResizeObserver | null = null

// 快捷键 Ctrl+Alt+E 新建事件（M7-F3）
function onNewEventShortcut(): void {
  addEventClicked.value = true
}
onMounted(() => window.addEventListener('woc:new-event', onNewEventShortcut))
onUnmounted(() => window.removeEventListener('woc:new-event', onNewEventShortcut))

/** M6-F3 时间轴 PNG（当前视口，按当前主题，含质感） */
async function exportPng(): Promise<void> {
  if (!boardEl.value) return
  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(boardEl.value, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(), scale: 2 })
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `时间轴.png`)
      message.success('时间轴 PNG 已导出')
    }, 'image/png')
  } catch {
    message.error('导出失败')
  }
}
onMounted(() => {
  resizeObs = new ResizeObserver(() => {
    if (boardEl.value) {
      boardW.value = boardEl.value.clientWidth
      boardH.value = boardEl.value.clientHeight
    }
  })
  if (boardEl.value) resizeObs.observe(boardEl.value)
})
onUnmounted(() => resizeObs?.disconnect())
</script>

<style scoped>
.timeline { display: flex; flex-direction: column; gap: var(--space-2); height: 100%; }
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
.main-row { flex: 1; display: flex; gap: var(--space-2); min-height: 0; }
.board { flex: 1; min-width: 0; overflow: hidden; position: relative; cursor: grab; background: var(--surface); }
.board:active { cursor: grabbing; }
.axis-svg { display: block; }
.tick-line { stroke: var(--border-weak); stroke-width: 1; }
.tick-text { fill: var(--text-3); font-size: 10px; text-anchor: middle; }
.lane-name { font-size: 12px; font-weight: 500; }
.event circle { cursor: pointer; stroke: var(--surface); stroke-width: 2; }
.event circle.locked { stroke: var(--accent); stroke-width: 2.5; }
.event.inherited circle { cursor: pointer; }
.event-label { fill: var(--text-1); font-size: 12px; pointer-events: none; }
.event-label.dim { fill: var(--text-3); }
.event-meta { fill: var(--text-3); font-size: 10px; pointer-events: none; }
.fork-curve { stroke-width: 1.5; stroke-dasharray: 4 3; opacity: 0.8; }
.empty-hint { fill: var(--text-3); font-size: 13px; }
.untimed { width: 264px; flex-shrink: 0; padding: var(--space-2); display: flex; flex-direction: column; gap: 8px; overflow: auto; }
.untimed-title { font-size: 12px; color: var(--text-3); }
.untimed-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); cursor: pointer; padding: 5px 8px; border-radius: var(--radius-s); }
.untimed-item:hover { background: var(--surface-2); color: var(--text-1); }
.untimed-divider { border-top: 1px solid var(--border-weak); margin: 6px 0 2px; }
.ev-group { display: flex; flex-direction: column; gap: 2px; }
.ev-group-head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; margin: 6px 0 2px; }
.ev-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ev-row { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ev-time { font-size: 11px; color: var(--text-3); flex-shrink: 0; }
.new-ev { display: flex; gap: 10px; align-items: center; }
</style>
