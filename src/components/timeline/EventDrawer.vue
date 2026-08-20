<template>
  <n-drawer
    :show="!!event"
    :width="480"
    @update:show="(v: boolean) => !v && $emit('close')"
  >
    <n-drawer-content
      :title="event ? `事件：${event.title || '未命名'}` : ''"
      closable
    >
      <div
        v-if="event && draft"
        class="drawer-body"
      >
        <div class="row">
          <span class="lbl">标题</span>
          <n-input
            v-model:value="d.title"
            placeholder="事件标题"
          />
        </div>
        <div class="row">
          <span class="lbl">世界线</span>
          <n-select
            v-model:value="d.worldlineId"
            :options="worldlineOptions"
          />
        </div>
        <div class="row">
          <span class="lbl">时间</span>
          <div class="time-edit">
            <n-checkbox
              :checked="d.time !== null"
              @update:checked="toggleTimed"
            >
              定时
            </n-checkbox>
            <template v-if="d.time">
              <n-select
                v-model:value="d.time.calendarId"
                size="small"
                style="width: 120px"
                :options="calendarOptions"
              />
              <n-input-number
                v-model:value="d.time.value"
                size="small"
                style="width: 120px"
                :step="1"
              />
              <span class="hint">{{ suggestDisplay(d.time, calendars) }}</span>
            </template>
            <span
              v-else
              class="hint"
            >未定时草稿（仅出现在画布视图）</span>
          </div>
        </div>
        <div class="row">
          <span class="lbl">参与者</span>
          <n-select
            v-model:value="d.participantIds"
            multiple
            filterable
            clearable
            placeholder="选择角色"
            :options="characterOptions"
          />
        </div>
        <div class="row">
          <span class="lbl">地点</span>
          <n-select
            v-model:value="d.locationId"
            clearable
            filterable
            placeholder="百科条目（建议地点类）"
            :options="codexOptions"
          />
        </div>
        <div class="row">
          <span class="lbl">描述</span>
          <textarea
            v-model="d.description"
            class="desc"
            placeholder="Markdown 描述"
          />
        </div>
        <div class="row checks">
          <n-checkbox
            :checked="d.locked"
            @update:checked="(v: boolean) => (d.locked = v)"
          >
            锁定（定稿）
          </n-checkbox>
          <n-checkbox
            :checked="d.collapsed"
            @update:checked="(v: boolean) => (d.collapsed = v)"
          >
            折叠
          </n-checkbox>
        </div>
        <div class="ref-list">
          <div class="lbl">
            参与者：
          </div>
          <n-tag
            v-for="p in d.participantIds"
            :key="p"
            size="small"
            round
          >
            {{ store.characterById(p)?.name ?? '失效引用' }}
          </n-tag>
          <span
            v-if="d.participantIds.length === 0"
            class="hint"
          >无</span>
        </div>
        <div class="drawer-ops">
          <n-button
            size="small"
            type="primary"
            @click="save"
          >
            保存
          </n-button>
          <n-button
            size="small"
            :disabled="!canFork"
            @click="forkHere"
          >
            <GitBranch :size="14" /> 从此处创建 IF 线
          </n-button>
          <n-button
            size="small"
            type="error"
            quaternary
            @click="confirmDelete"
          >
            <Trash2 :size="14" /> 删除
          </n-button>
        </div>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import {
  NDrawer, NDrawerContent, NInput, NInputNumber, NSelect, NButton, NCheckbox, NTag,
  useDialog, useMessage,
} from 'naive-ui'
import { GitBranch, Trash2 } from 'lucide-vue-next'
import { useProjectStore } from '@/stores/project'
import { suggestDisplay } from '@/utils/calendar'
import { eventReferences, removeEventCascade } from '@/utils/integrity'
import type { TimelineEvent } from '@/types'

const props = defineProps<{ event: TimelineEvent | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'forked', worldlineId: string): void }>()

const store = useProjectStore()
const dialog = useDialog()
const message = useMessage()

const draft = ref<TimelineEvent | null>(null)
// 模板别名：根节点 v-if 已保证非空，规避模板窄化限制
const d = computed<TimelineEvent>(() => draft.value as TimelineEvent)

watch(() => props.event, (e) => {
  draft.value = e ? JSON.parse(JSON.stringify(e)) : null
}, { immediate: true })

const calendars = computed(() => store.current?.settings.calendars ?? [])
const worldlineOptions = computed(() =>
  (store.current?.settings.worldlines ?? []).map((w) => ({
    label: w.name + (w.status === 'abandoned' ? '（已废弃）' : ''), value: w.id,
  })))
const calendarOptions = computed(() => calendars.value.map((c) => ({ label: c.name, value: c.id })))
const characterOptions = computed(() => (store.current?.characters ?? []).map((c) => ({ label: c.name, value: c.id })))
const codexOptions = computed(() => (store.current?.codex ?? []).map((c) => ({ label: c.name, value: c.id })))

const canFork = computed(() => draft.value?.time !== null)

function toggleTimed(on: boolean): void {
  if (!draft.value || !store.current) return
  const cal = store.current.settings.calendars[0]
  draft.value.time = on && cal ? { calendarId: cal.id, value: 0, display: '' } : null
}

function save(): void {
  if (!draft.value) return
  if (draft.value.time && !draft.value.time.display.trim()) {
    draft.value.time.display = suggestDisplay(draft.value.time, calendars.value)
  }
  store.upsertEvent(JSON.parse(JSON.stringify(draft.value)))
  message.success('事件已保存')
}

function forkHere(): void {
  if (!draft.value || !store.current) return
  const parent = store.worldlineById(draft.value.worldlineId)
  const nameRef = ref(`IF 线（自「${draft.value.title}」）`)
  dialog.create({
    title: `从此处创建 IF 世界线`,
    content: `将以「${draft.value.title}」为分叉点从「${parent?.name}」分出一条新世界线。`,
    positiveText: '创建',
    negativeText: '取消',
    onPositiveClick: () => {
      const wl = store.forkWorldline(draft.value!.id, nameRef.value || 'IF 线')
      if (wl) {
        message.success(`世界线「${wl.name}」已创建`)
        emit('forked', wl.id)
      }
    },
  })
}

function confirmDelete(): void {
  if (!draft.value || !store.current) return
  const targetId = draft.value.id
  const title = draft.value.title
  const hits = eventReferences(store.current, targetId)
  dialog.warning({
    title: '删除事件',
    content: hits.length
      ? `「${title}」被以下位置引用，将一并清理：\n${hits.map((h) => `· ${h.where}`).join('\n')}`
      : `确定删除「${title}」？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const data = store.current!
      const touched = new Set<string>()
      for (const e of data.events) if (e.causalLinks.includes(targetId)) touched.add(e.id)
      for (const w of data.settings.worldlines) if (w.forkPointEventId === targetId) touched.add(w.id)
      removeEventCascade(data, targetId)
      store.mark({ kind: 'event', id: targetId })
      for (const id of touched) store.mark({ kind: 'event', id })
      store.updateSettings()
      await store.flush()
      emit('close')
      message.success('事件已删除')
    },
  })
}
</script>

<style scoped>
.drawer-body { display: flex; flex-direction: column; gap: 14px; }
.row { display: flex; flex-direction: column; gap: 6px; }
.lbl { font-size: 12px; color: var(--text-3); }
.time-edit { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hint { font-size: 12px; color: var(--text-3); }
.desc { min-height: 120px; resize: vertical; background: var(--bg); border: 1px solid var(--border-weak); border-radius: var(--radius-s); color: var(--text-1); padding: 10px; font-size: 13px; font-family: Consolas, monospace; outline: none; line-height: 1.7; }
.checks { flex-direction: row; gap: 16px; }
.ref-list { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.drawer-ops { display: flex; gap: 8px; margin-top: 8px; }
</style>
