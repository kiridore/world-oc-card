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
            v-model:value="lineId"
            :options="worldlineOptions"
          />
        </div>
        <div class="row">
          <span class="lbl">时间</span>
          <EventTimeEditor v-model="d.time" />
        </div>
        <div class="row">
          <span class="lbl">参与者（角色 / 势力）</span>
          <n-select
            v-model:value="d.participantIds"
            multiple
            filterable
            clearable
            placeholder="选择角色或势力条目"
            :options="participantOptions"
          />
        </div>
        <div class="row">
          <span class="lbl">关联百科</span>
          <n-select
            v-model:value="d.relatedCodexIds"
            multiple
            filterable
            clearable
            placeholder="选择百科条目"
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
          <span class="lbl">参与者：</span>
          <n-tag
            v-for="p in d.participantIds"
            :key="p"
            size="small"
            round
          >
            {{ participantName(p) }}
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
            v-if="event.time"
            size="small"
            quaternary
            @click="toDraft"
          >
            放回草稿箱
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
  NDrawer, NDrawerContent, NInput, NSelect, NButton, NCheckbox, NTag,
  useDialog, useMessage,
} from 'naive-ui'
import { GitBranch, Trash2 } from 'lucide-vue-next'
import { useProjectStore } from '@/stores/project'
import EventTimeEditor from './EventTimeEditor.vue'
import { eventReferences } from '@/utils/integrity'
import type { EventTime, TimelineEvent } from '@/types'

const props = defineProps<{ event: TimelineEvent | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'forked', worldlineId: string): void }>()

const store = useProjectStore()
const dialog = useDialog()
const message = useMessage()

const draft = ref<TimelineEvent | null>(null)
/** 打开抽屉时的原状快照（保存对比用） */
const before = ref<TimelineEvent | null>(null)
/** 世界线选择：草稿默认主世界线，已定时默认当前线 */
const lineId = ref<string | null>(null)
// 模板别名：根节点 v-if 已保证非空，规避模板窄化限制
const d = computed<TimelineEvent>(() => draft.value as TimelineEvent)

watch(() => props.event, (e) => {
  draft.value = e ? JSON.parse(JSON.stringify(e)) : null
  before.value = e ? JSON.parse(JSON.stringify(e)) : null
  lineId.value = e?.worldlineId ?? store.current?.settings.worldlines[0]?.id ?? null
}, { immediate: true })

const worldlineOptions = computed(() =>
  (store.current?.settings.worldlines ?? []).map((w) => ({
    label: w.name + (w.status === 'abandoned' ? '（已废弃）' : ''), value: w.id,
  })))
const factionTypeIds = computed(() =>
  new Set((store.current?.settings.codexTypes ?? []).filter((t) => t.key === 'faction').map((t) => t.id)))
const participantOptions = computed(() => [
  ...(store.current?.characters ?? []).map((c) => ({ label: c.name, value: c.id })),
  ...(store.current?.codex ?? [])
    .filter((c) => factionTypeIds.value.has(c.typeId))
    .map((c) => ({ label: `${c.name}（势力）`, value: c.id })),
])
const codexOptions = computed(() => (store.current?.codex ?? []).map((c) => ({ label: c.name, value: c.id })))

const canFork = computed(() => draft.value?.time !== null)

function participantName(id: string): string {
  return store.characterById(id)?.name ?? store.codexById(id)?.name ?? '失效引用'
}

function timeError(t: EventTime | null): string | null {
  if (t === null) return null
  if (t.mode === 'custom') return t.text.trim() ? null : '自定义时间不能为空'
  return [t.era, t.year, t.month, t.day].some((v) => v.trim() !== '') ? null : '纪年法时间至少填写一个字段'
}

function save(): void {
  if (!draft.value || !store.current) return
  const b = before.value
  const err = timeError(draft.value.time)
  if (err) { message.error(err); return }
  if (!draft.value.title.trim()) { message.error('标题不能为空'); return }

  const hadTime = b?.time != null
  const t = draft.value.time // 局部缓存：reactive 属性访问无法被 TS 窄化（坑 3 同类）
  const hasTime = t != null
  const clone = () => JSON.parse(JSON.stringify(draft.value))

  if (!hasTime) {
    // 草稿：全字段保存（worldlineId 强制 null，防止草稿被误挂线）
    if (hadTime) {
      // 先放回草稿（捕获原线以重编号），再全字段持久化（含非时间编辑）
      store.moveToDraft(draft.value.id)
      store.upsertEvent({ ...clone(), worldlineId: null, time: null, rank: 0 })
      emit('close')
      message.success('已放回草稿箱')
    } else {
      store.upsertEvent({ ...clone(), worldlineId: null, time: null })
      message.success('事件已保存为草稿')
    }
  } else if (!hadTime) {
    // 草稿补全时间：先存全字段（保持草稿形态），再入线
    store.upsertEvent({ ...clone(), worldlineId: null, time: null })
    const wlId = lineId.value ?? store.current.settings.worldlines[0]?.id
    if (!wlId) { message.error('请先创建世界线'); return }
    store.setEventTime(draft.value.id, t!, wlId)
    message.success('事件已入线并保存')
  } else {
    const timeChanged = JSON.stringify(draft.value.time) !== JSON.stringify(b!.time)
    const lineChanged = lineId.value !== b!.worldlineId
    // 时间或线任一变化都先全字段持久化（保持原线，防仅换线/仅改时间丢非时间编辑；
    // clone().worldlineId 恒为原线，覆盖仅为显式）
    if (timeChanged || lineChanged) store.upsertEvent({ ...clone(), worldlineId: b!.worldlineId })
    if (lineChanged && lineId.value) store.moveToWorldline(draft.value.id, lineId.value)
    if (!timeChanged && !lineChanged) store.upsertEvent(clone())
    message.success('事件已保存')
  }
}

function toDraft(): void {
  if (!draft.value) return
  store.moveToDraft(draft.value.id)
  emit('close')
  message.success('已放回草稿箱')
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
      store.removeEvent(targetId)
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
.hint { font-size: 12px; color: var(--text-3); }
.desc { min-height: 120px; resize: vertical; background: var(--bg); border: 1px solid var(--border-weak); border-radius: var(--radius-s); color: var(--text-1); padding: 10px; font-size: 13px; font-family: Consolas, monospace; outline: none; line-height: 1.7; }
.checks { flex-direction: row; gap: 16px; }
.ref-list { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.drawer-ops { display: flex; gap: 8px; margin-top: 8px; }
</style>
