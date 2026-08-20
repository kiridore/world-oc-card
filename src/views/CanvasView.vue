<template>
  <EmptyProject>
    <div class="page canvas">
      <div class="topbar panel">
        <span class="hint">画布：自由组织事件与因果链（时间轴视图按时间排序，两视图共享数据）。拖动连线建立因果，拖动节点后位置自动保存。</span>
        <n-button
          size="small"
          type="primary"
          @click="addUntimedEvent"
        >
          <Plus :size="14" /> 新建草稿事件
        </n-button>
      </div>
      <div class="flow-wrap panel">
        <VueFlow
          :nodes="nodes"
          :edges="edges"
          :default-viewport="{ zoom: 0.9 }"
          fit-view-on-init
          :nodes-draggable="true"
          :nodes-connectable="true"
          :connection-radius="24"
          @node-click="onNodeClick"
          @node-drag-stop="onDragStop"
          @connect="onConnect"
        >
          <Background :gap="24" />
          <Controls />
        </VueFlow>
      </div>
    </div>
  </EmptyProject>

  <EventDrawer
    :event="selectedEvent"
    @close="selectedEvent = null"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NButton, useMessage } from 'naive-ui'
import { Plus } from 'lucide-vue-next'
import { VueFlow, type Node, type Edge, type Connection, type NodeDragEvent } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import EmptyProject from '@/components/EmptyProject.vue'
import EventDrawer from '@/components/timeline/EventDrawer.vue'
import { useProjectStore } from '@/stores/project'
import { useThemeStore } from '@/stores/theme'
import { eventAbs } from '@/utils/calendar'
import { resolveDataColor, palettePick } from '@/utils/colors'
import { uuid } from '@/utils/id'
import type { TimelineEvent } from '@/types'

const store = useProjectStore()
const theme = useThemeStore()
const message = useMessage()
const selectedEvent = ref<TimelineEvent | null>(null)

const nodes = computed<Node[]>(() => {
  const data = store.current
  if (!data) return []
  const cal = data.settings.calendars
  const lines = [...data.settings.worldlines].sort((a, b) => a.order - b.order)
  const lineIndex = new Map(lines.map((w, i) => [w.id, i]))
  const absVals = data.events.map((e) => (e.time ? eventAbs(e, cal) : null)).filter((v): v is number => v !== null)
  const min = absVals.length ? Math.min(...absVals) : 0
  const max = absVals.length ? Math.max(...absVals) : 1
  return data.events.map((e) => {
    const wl = data.settings.worldlines.find((w) => w.id === e.worldlineId)
    const color = wl ? resolveDataColor(wl.color, theme.isDark ? 'dark' : 'light') : palettePick(9)
    const abs = e.time ? eventAbs(e, cal) : null
    // 自动布局：无 canvasPos 时按时间 × 世界线泳道落位；用户拖动后固定
    const autoX = abs !== null ? 80 + ((abs - min) / Math.max(max - min, 1)) * 1400 : 80 + (Math.random() * 200)
    const autoY = 80 + (lineIndex.get(e.worldlineId) ?? 0) * 160
    return {
      id: e.id,
      position: e.canvasPos ?? { x: Math.round(autoX), y: Math.round(autoY) },
      data: { event: e, color },
      style: {},
    }
  })
})

const edges = computed<Edge[]>(() => {
  const data = store.current
  if (!data) return []
  const out: Edge[] = []
  for (const e of data.events) {
    for (const target of e.causalLinks) {
      out.push({
        id: `${e.id}->${target}`,
        source: e.id,
        target,
        animated: true,
        style: { stroke: 'var(--accent)' },
      })
    }
  }
  return out
})

function onNodeClick({ node }: { node: Node }): void {
  const e = store.current?.events.find((x) => x.id === node.id)
  if (e) selectedEvent.value = e
}

/** M4-F7 画布位置持久化 */
function onDragStop(drag: NodeDragEvent): void {
  const e = store.current?.events.find((x) => x.id === drag.node.id)
  if (!e) return
  store.upsertEvent({ ...e, canvasPos: { x: drag.node.position.x, y: drag.node.position.y } })
}

/** 拖拽连线 → causalLinks（M4 画布因果）*/
function onConnect({ source, target }: Connection): void {
  if (!source || !target || source === target || !store.current) return
  const e = store.current.events.find((x) => x.id === source)
  if (!e) return
  if (e.causalLinks.includes(target)) return
  store.upsertEvent({ ...e, causalLinks: [...e.causalLinks, target] })
  message.success('已建立因果连线')
}

function addUntimedEvent(): void {
  if (!store.current) return
  const wl = store.current.settings.worldlines[0]
  if (!wl) { message.error('缺少世界线'); return }
  const e: TimelineEvent = {
    id: uuid(), worldlineId: wl.id, time: null,
    title: '草稿事件', description: '', participantIds: [], locationId: null, causalLinks: [],
    collapsed: false, locked: false,
  }
  store.upsertEvent(e)
  selectedEvent.value = e
}
</script>

<style scoped>
.canvas { display: flex; flex-direction: column; gap: var(--space-2); height: 100%; }
.topbar { padding: 10px var(--space-2); display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); }
.hint { font-size: 12px; color: var(--text-3); }
.flow-wrap { flex: 1; min-height: 0; overflow: hidden; background: var(--surface); }
</style>

<style>
/* Vue Flow 主题接入 token（G10：无硬编码色值，主题切换即时换肤） */
.vue-flow { background: var(--surface); }
.vue-flow__node-default, .vue-flow__node {
  background: var(--surface-2) !important;
  border: 1px solid var(--border) !important;
  color: var(--text-1) !important;
  border-radius: var(--radius-m) !important;
  padding: 8px 14px !important;
  font-size: 13px !important;
  font-family: var(--font-ui) !important;
  box-shadow: var(--shadow-1) !important;
  width: auto !important;
}
.vue-flow__node.selected { border-color: var(--accent) !important; }
.vue-flow__handle { background: var(--accent) !important; border: 2px solid var(--surface) !important; width: 8px !important; height: 8px !important; }
.vue-flow__edge-path { stroke-width: 1.8; }
.vue-flow__controls {
  background: var(--surface) !important; border: 1px solid var(--border) !important;
  border-radius: var(--radius-m) !important; overflow: hidden; box-shadow: var(--shadow-1) !important;
}
.vue-flow__controls-button {
  background: var(--surface) !important; border-bottom: 1px solid var(--border-weak) !important;
}
.vue-flow__controls-button svg { fill: var(--text-2) !important; }
.vue-flow__background { background: transparent; }
.vue-flow__background pattern circle { fill: var(--border-weak); }
</style>
