<template>
  <EmptyProject>
    <div class="page characters">
      <!-- 左：角色列表 -->
      <aside class="list panel">
        <div class="list-head">
          <n-input
            v-model:value="search"
            size="small"
            placeholder="全文搜索（含所有字段块）"
            clearable
          >
            <template #prefix>
              <Search :size="14" />
            </template>
          </n-input>
          <n-select
            v-model:value="tagFilter"
            size="small"
            multiple
            clearable
            placeholder="标签筛选"
            :options="tagOptions"
            :max-tag-count="2"
          />
          <div class="list-btns">
            <n-button
              size="small"
              type="primary"
              @click="newCharacter"
            >
              <Plus :size="14" /> 新建角色
            </n-button>
            <n-button
              size="small"
              quaternary
              title="模板管理"
              @click="showTplManager = true"
            >
              <LayoutTemplate :size="14" />
            </n-button>
          </div>
        </div>
        <div class="char-list">
          <div
            v-for="c in filtered"
            :key="c.id"
            class="char-item"
            :class="{ active: c.id === selectedId }"
            @click="select(c.id)"
          >
            <span class="char-name">{{ c.name }}</span>
            <span class="char-count">{{ c.fieldBlocks.length }} 块</span>
          </div>
          <n-empty
            v-if="filtered.length === 0"
            size="small"
            :description="store.current?.characters.length ? '没有匹配的角色' : '还没有角色'"
          />
        </div>
      </aside>

      <!-- 右：角色卡 / 编辑 -->
      <section
        v-if="selected"
        ref="cardEl"
        class="detail panel"
      >
        <div class="detail-head">
          <template v-if="editing">
            <input
              v-model="draft.name"
              class="name-input"
              placeholder="角色名称（必填）"
            >
          </template>
          <h2
            v-else
            class="name"
          >
            {{ selected.name }}
          </h2>
          <div class="detail-ops">
            <template v-if="editing">
              <span class="autosave-hint"><CheckCircle2 :size="13" /> 编辑自动保存</span>
              <n-button
                size="small"
                type="primary"
                :disabled="!draft.name.trim()"
                @click="finishEdit"
              >
                完成
              </n-button>
            </template>
            <template v-else>
              <n-button
                size="small"
                @click="insertTemplate"
              >
                <CopyPlus :size="14" /> 从模板插入
              </n-button>
              <n-button
                size="small"
                @click="saveAsTemplate"
              >
                <BookmarkPlus :size="14" /> 存为模板
              </n-button>
              <n-button
                size="small"
                @click="exportCardPng"
              >
                <ImageDown :size="14" /> 导出 PNG
              </n-button>
              <n-button
                size="small"
                type="primary"
                @click="startEdit"
              >
                <Pencil :size="14" /> 编辑
              </n-button>
              <n-button
                size="small"
                quaternary
                type="error"
                @click="confirmDelete"
              >
                <Trash2 :size="14" /> 删除
              </n-button>
            </template>
          </div>
        </div>
        <div class="detail-body">
          <BlockEditor
            v-if="editing"
            v-model="draft.fieldBlocks"
          />
          <BlockView
            v-else
            :blocks="selected.fieldBlocks"
            @open-link="openLink"
          />
        </div>
      </section>
      <section
        v-else
        class="detail panel empty-detail"
      >
        <n-empty description="选择左侧角色查看，或新建一个角色">
          <template #extra>
            <n-button
              type="primary"
              @click="newCharacter"
            >
              新建角色
            </n-button>
          </template>
        </n-empty>
      </section>
    </div>
  </EmptyProject>

  <TemplatePicker
    v-model:show="showPicker"
    :mode="pickerMode"
    @pick="onPickTemplate"
    @skip="createCharacter(null)"
  />
  <TemplateManager v-model:show="showTplManager" />
  <n-modal
    v-model:show="showSaveTpl"
    preset="dialog"
    title="存为模板"
  >
    <n-input
      v-model:value="tplName"
      placeholder="模板名称"
    />
    <label class="keep-values"><input
      v-model="keepValues"
      type="checkbox"
    > 保留当前值（默认只保存结构：键名/标题/块骨架）</label>
    <template #action>
      <n-button
        type="primary"
        :disabled="!tplName.trim()"
        @click="doSaveTemplate"
      >
        保存模板
      </n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NButton, NInput, NSelect, NEmpty, NModal, useDialog, useMessage,
} from 'naive-ui'
import { Plus, Search, Pencil, Trash2, BookmarkPlus, CopyPlus, LayoutTemplate, ImageDown, CheckCircle2 } from 'lucide-vue-next'
import EmptyProject from '@/components/EmptyProject.vue'
import BlockView from '@/components/blocks/BlockView.vue'
import BlockEditor from '@/components/blocks/BlockEditor.vue'
import TemplatePicker from '@/components/TemplatePicker.vue'
import TemplateManager from '@/components/TemplateManager.vue'
import { useProjectStore } from '@/stores/project'
import { serializeBlocksText, collectTags, insertTemplateBlocks, makeTemplatePayload, newTemplate } from '@/utils/template'
import { characterReferences, removeCharacterCascade } from '@/utils/integrity'
import { uuid, nowIso } from '@/utils/id'
import { downloadBlob } from '@/utils/download'
import type { Character, FieldBlock, Template } from '@/types'

const store = useProjectStore()
const router = useRouter()
const route = useRoute()
const dialog = useDialog()
const message = useMessage()

// 图谱节点点击跳转（M5-F4）：/characters?id=xxx；快捷键 Ctrl+Alt+C 新建角色（M7-F3）
onMounted(() => {
  const id = route.query.id
  if (typeof id === 'string' && store.current?.characters.some((c) => c.id === id)) selectedId.value = id
  window.addEventListener('woc:new-character', onCreateShortcut)
})

onUnmounted(() => window.removeEventListener('woc:new-character', onCreateShortcut))

function onCreateShortcut(): void {
  createCharacter(null)
}

const search = ref('')
const tagFilter = ref<string[]>([])
const selectedId = ref<string | null>(null)
const editing = ref(false)
const draft = reactive<{ name: string; fieldBlocks: FieldBlock[] }>({ name: '', fieldBlocks: [] })
const showPicker = ref(false)
const pickerMode = ref<'create' | 'insert'>('create')
const showTplManager = ref(false)
const showSaveTpl = ref(false)
const tplName = ref('')
const keepValues = ref(false)
const cardEl = ref<HTMLElement | null>(null)

const selected = computed(() => store.current?.characters.find((c) => c.id === selectedId.value) ?? null)

const allTags = computed(() => {
  const set = new Set<string>()
  for (const c of store.current?.characters ?? []) for (const t of collectTags(c.fieldBlocks)) set.add(t)
  return [...set]
})
const tagOptions = computed(() => allTags.value.map((t) => ({ label: t, value: t })))

const filtered = computed(() => {
  let list = store.current?.characters ?? []
  const q = search.value.trim().toLowerCase()
  if (q) list = list.filter((c) => (`${c.name}\n${serializeBlocksText(c.fieldBlocks)}`).toLowerCase().includes(q))
  if (tagFilter.value.length) {
    list = list.filter((c) => {
      const tags = collectTags(c.fieldBlocks)
      return tagFilter.value.every((t) => tags.includes(t))
    })
  }
  return list
})

function select(id: string): void {
  if (editing.value) {
    // 自动保存模式下切换角色：先落盘当前草稿再切换，无数据丢失
    saveDraftNow()
    editing.value = false
  }
  selectedId.value = id
}

function newCharacter(): void {
  pickerMode.value = 'create'
  showPicker.value = true
}

function createCharacter(blocks: FieldBlock[] | null): void {
  if (!store.current) return
  const c: Character = {
    id: uuid(), name: '新角色', fieldBlocks: blocks ?? [],
    createdAt: nowIso(), updatedAt: nowIso(),
  }
  store.upsertCharacter(c)
  selectedId.value = c.id
  // 新建即进入编辑（改动自动保存，无需二级编辑入口）
  loadDraftFrom(c)
  editing.value = true
  message.success('角色已创建，直接编辑即可（自动保存）')
}

function startEdit(): void {
  if (!selected.value) return
  loadDraftFrom(selected.value)
  editing.value = true
}

function loadDraftFrom(c: Character): void {
  draft.name = c.name
  draft.fieldBlocks = JSON.parse(JSON.stringify(c.fieldBlocks))
  lastSaved = serializeDraft()
}

function serializeDraft(): string {
  return JSON.stringify({ name: draft.name.trim(), blocks: draft.fieldBlocks })
}

// ---- 自动保存：输入停顿 800ms 后落库；提示节流避免刷屏 ----
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let lastSaved = ''
let lastNoticeAt = 0

function saveDraftNow(): void {
  if (!editing.value || !selected.value) return
  if (!draft.name.trim()) return
  const snap = serializeDraft()
  if (snap === lastSaved) return
  lastSaved = snap
  store.upsertCharacter({
    ...selected.value,
    name: draft.name.trim(),
    fieldBlocks: JSON.parse(JSON.stringify(draft.fieldBlocks)),
  })
  const now = Date.now()
  if (now - lastNoticeAt > 4000) {
    lastNoticeAt = now
    message.success('已自动保存')
  }
}

watch(() => [draft.name, draft.fieldBlocks], () => {
  if (!editing.value) return
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(saveDraftNow, 800)
}, { deep: true })

function finishEdit(): void {
  if (autosaveTimer) { clearTimeout(autosaveTimer); autosaveTimer = null }
  saveDraftNow()
  editing.value = false
  message.success('已完成，修改已保存')
}

function confirmDelete(): void {
  if (!selected.value || !store.current) return
  const targetId = selected.value.id
  const targetName = selected.value.name
  const hits = characterReferences(store.current, targetId)
  dialog.warning({
    title: '删除角色',
    content: hits.length
      ? `「${targetName}」被以下位置引用，删除后将一并清理：\n${hits.map((h) => `· ${h.where}`).join('\n')}`
      : `确定删除「${targetName}」？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const data = store.current!
      const touchedEventIds = data.events.filter((e) => e.participantIds.includes(targetId)).map((e) => e.id)
      const touchedCharIds = hits.filter((h) => h.kind === 'link-block').map((h) => h.id)
      removeCharacterCascade(data, targetId)
      store.mark({ kind: 'character', id: targetId })
      store.updateRelations()
      for (const id of touchedEventIds) store.mark({ kind: 'event', id })
      for (const id of touchedCharIds) store.mark({ kind: 'character', id })
      await store.flush()
      if (selectedId.value === targetId) selectedId.value = null
      message.success('已删除并清理引用')
    },
  })
}

function insertTemplate(): void {
  pickerMode.value = 'insert'
  showPicker.value = true
}

function onPickTemplate(t: Template): void {
  if (!store.current) return
  if (pickerMode.value === 'create') {
    const blocks = 'fieldBlocks' in t.payload ? t.payload.fieldBlocks : []
    createCharacter(JSON.parse(JSON.stringify(blocks)))
  } else if (selected.value) {
    const blocks = 'fieldBlocks' in t.payload ? t.payload.fieldBlocks : []
    const merged = insertTemplateBlocks(selected.value.fieldBlocks, blocks)
    store.upsertCharacter({ ...selected.value, fieldBlocks: merged })
    message.success(`已插入模板「${t.name}」的字段`)
  }
}

function saveAsTemplate(): void {
  if (!selected.value) return
  tplName.value = `${selected.value.name}的模板`
  keepValues.value = false
  showSaveTpl.value = true
}

function doSaveTemplate(): void {
  if (!store.current || !selected.value || !tplName.value.trim()) return
  const tpl = newTemplate(tplName.value.trim(), 'character', makeTemplatePayload(selected.value.fieldBlocks, keepValues.value))
  store.current.templates = [...store.current.templates, tpl]
  store.updateTemplates()
  showSaveTpl.value = false
  message.success(`模板「${tpl.name}」已保存`)
}

function openLink(block: FieldBlock): void {
  if (block.type !== 'link') return
  if (block.targetType === 'character') {
    selectedId.value = block.targetId
  } else if (block.targetType === 'codexEntry') {
    router.push('/codex')
    message.info('已跳转百科（可在侧栏搜索该条目）')
  } else {
    router.push('/timeline')
  }
}

/** M6-F3 角色卡 PNG（按当前主题） */
async function exportCardPng(): Promise<void> {
  if (!cardEl.value) return
  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(cardEl.value, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(), scale: 2 })
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${selected.value?.name ?? '角色'}-角色卡.png`)
      message.success('角色卡 PNG 已导出')
    }, 'image/png')
  } catch {
    message.error('导出失败')
  }
}
</script>

<style scoped>
.characters { display: flex; gap: var(--space-2); height: 100%; }
.list { width: 300px; flex-shrink: 0; padding: var(--space-2); display: flex; flex-direction: column; gap: 10px; }
.list-head { display: flex; flex-direction: column; gap: 8px; }
.list-btns { display: flex; gap: 8px; }
.char-list { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 4px; }
.char-item { display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; border-radius: var(--radius-m); cursor: pointer; font-size: 14px; }
.char-item:hover { background: var(--surface-2); }
.char-item.active { background: var(--accent-weak); color: var(--accent-text); }
.char-count { font-size: 11px; color: var(--text-3); }
.detail { flex: 1; min-width: 0; padding: var(--space-3); display: flex; flex-direction: column; }
.empty-detail { align-items: center; justify-content: center; }
.detail-head { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2); }
.name { margin: 0; font-size: 20px; }
.name-input { font-size: 18px; font-weight: 600; background: transparent; border: none; border-bottom: 2px solid var(--accent); outline: none; color: var(--text-1); padding: 2px 0; flex: 1; }
.detail-ops { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.autosave-hint { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-3); }
.detail-body { flex: 1; overflow: auto; }
.keep-values { display: flex; gap: 6px; margin-top: 12px; font-size: 13px; color: var(--text-2); }
</style>
