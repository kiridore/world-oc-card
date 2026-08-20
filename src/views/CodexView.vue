<template>
  <EmptyProject>
    <div class="page codex">
      <!-- 左：类型分组侧栏 -->
      <aside class="side panel">
        <div class="side-head">
          <n-button
            size="small"
            type="primary"
            @click="showNewPicker = true"
          >
            <Plus :size="14" /> 新建条目
          </n-button>
          <n-button
            size="small"
            quaternary
            @click="showTypeModal = true"
          >
            <FolderPlus :size="14" /> 类型
          </n-button>
        </div>
        <div class="type-list">
          <div
            v-for="g in groups"
            :key="g.type.id"
            class="type-group"
            :class="{ active: selectedTypeId === g.type.id && !selectedId }"
            @click="selectedTypeId = g.type.id; selectedId = null"
          >
            <span
              class="type-dot"
              :style="{ background: firstColorOf(g.type.id) }"
            />
            <span class="type-name">{{ g.type.name }}</span>
            <span class="type-count">{{ g.entries.length }}</span>
          </div>
        </div>
      </aside>

      <!-- 中：条目列表 -->
      <aside class="entry-list panel">
        <n-input
          v-model:value="search"
          size="small"
          placeholder="搜索条目"
          clearable
        >
          <template #prefix>
            <Search :size="14" />
          </template>
        </n-input>
        <div class="entries">
          <div
            v-for="e in visibleEntries"
            :key="e.id"
            class="entry-item"
            :class="{ active: e.id === selectedId }"
            @click="selectEntry(e.id)"
          >
            <span
              class="entry-dot"
              :style="{ background: e.color }"
            />
            <span class="entry-name">{{ e.name }}</span>
          </div>
          <n-empty
            v-if="visibleEntries.length === 0"
            size="small"
            description="暂无条目"
          />
        </div>
      </aside>

      <!-- 右：条目编辑 -->
      <section
        v-if="selected"
        class="detail panel"
      >
        <div class="detail-head">
          <input
            v-model="draft.name"
            class="name-input"
            :class="{ invalid: !nameOk }"
            placeholder="条目名称（项目内唯一）"
          >
          <n-select
            v-model:value="draft.typeId"
            size="small"
            style="width: 130px"
            :options="typeOptions"
          />
          <div class="detail-ops">
            <n-button
              size="small"
              @click="applyTplVisible = true"
            >
              <CopyPlus :size="14" /> 属性模板
            </n-button>
            <n-button
              size="small"
              @click="saveAsTemplate"
            >
              <BookmarkPlus :size="14" /> 存为模板
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

        <div class="color-row">
          <span class="lbl">标识色：</span>
          <button
            v-for="c in DATA_PALETTE"
            :key="c"
            class="swatch"
            :class="{ active: draft.color === c }"
            :style="{ background: c }"
            :title="c"
            @click="draft.color = c"
          />
          <label
            class="custom-color"
            :class="{ warn: !colorUsable }"
          >
            <input
              v-model="draft.color"
              type="color"
            >
            <span v-if="!colorUsable">对比度不足</span>
          </label>
        </div>

        <div class="attrs">
          <div
            v-for="(a, i) in draft.attributes"
            :key="i"
            class="attr-row"
          >
            <input
              v-model="a.key"
              class="attr-key"
              placeholder="属性名"
            >
            <input
              v-model="a.value"
              class="attr-val"
              placeholder="属性值"
            >
            <button
              class="op danger"
              @click="draft.attributes.splice(i, 1)"
            >
              <X :size="13" />
            </button>
          </div>
          <button
            class="add-mini"
            @click="draft.attributes.push({ key: '', value: '' })"
          >
            <Plus :size="13" /> 加属性
          </button>
        </div>

        <div class="content-split">
          <textarea
            v-model="draft.content"
            class="content-input"
            placeholder="Markdown 正文，用 [[条目名]] 建立双向链接"
          />
          <div
            class="content-preview prose"
            @click="onPreviewClick"
            v-html="renderedContent"
          />
        </div>

        <div class="backlinks">
          <div class="bl-title">
            被引用于（{{ backlinks.length }}）
          </div>
          <template
            v-for="(h, i) in backlinks"
            :key="i"
          >
            <div
              class="bl-item"
              @click="jump(h)"
            >
              · {{ h.where }}
            </div>
          </template>
          <div
            v-if="backlinks.length === 0"
            class="bl-empty"
          >
            暂无引用
          </div>
        </div>
        <div class="save-bar">
          <span
            v-if="!nameOk"
            class="warn-text"
          >名称与现有条目重复（项目内全局唯一）</span>
          <n-button
            size="small"
            type="primary"
            :disabled="!nameOk || !draft.name.trim()"
            @click="save"
          >
            保存
          </n-button>
        </div>
      </section>
      <section
        v-else
        class="detail panel empty-detail"
      >
        <n-empty description="选择或新建一个百科条目">
          <template #extra>
            <n-button
              type="primary"
              @click="showNewPicker = true"
            >
              新建条目
            </n-button>
          </template>
        </n-empty>
      </section>
    </div>
  </EmptyProject>

  <!-- 新建：模板选择（含空白） -->
  <n-modal
    :show="showNewPicker"
    preset="dialog"
    title="新建百科条目（可选用模板）"
    @update:show="showNewPicker = $event"
  >
    <div class="tpl-list">
      <div
        v-for="t in codexTemplates"
        :key="t.id"
        class="tpl-item"
        @click="createEntry(t)"
      >
        <div class="tpl-name">
          {{ t.name }} <n-tag
            v-if="t.builtin"
            size="tiny"
            round
            :bordered="false"
          >
            内置
          </n-tag>
        </div>
        <div class="tpl-desc">
          {{ 'attributeKeys' in t.payload ? `${t.payload.attributeKeys.length} 个预置属性键` : '' }}
        </div>
      </div>
      <div
        class="tpl-item plain"
        @click="createEntry(null)"
      >
        <div class="tpl-name">
          空白条目
        </div>
        <div class="tpl-desc">
          自由填写
        </div>
      </div>
    </div>
  </n-modal>

  <!-- 属性模板插入 -->
  <n-modal
    :show="applyTplVisible"
    preset="dialog"
    title="从属性模板插入"
    @update:show="applyTplVisible = $event"
  >
    <div class="tpl-list">
      <div
        v-for="t in codexTemplates"
        :key="t.id"
        class="tpl-item"
        @click="applyTemplate(t)"
      >
        <div class="tpl-name">
          {{ t.name }}
        </div>
      </div>
      <n-empty
        v-if="codexTemplates.length === 0"
        size="small"
        description="暂无百科模板"
      />
    </div>
  </n-modal>

  <!-- 类型管理 -->
  <n-modal
    v-model:show="showTypeModal"
    preset="dialog"
    title="条目类型"
  >
    <div class="type-manage">
      <div
        v-for="t in store.current?.settings.codexTypes ?? []"
        :key="t.id"
        class="type-row"
      >
        <span>{{ t.name }}</span>
        <n-tag
          v-if="isBuiltinType(t.key)"
          size="tiny"
          round
          :bordered="false"
        >
          内置
        </n-tag>
        <button
          v-else
          class="op danger"
          @click="removeType(t)"
        >
          <Trash2 :size="13" />
        </button>
      </div>
      <div class="new-type">
        <n-input
          v-model:value="newTypeName"
          size="small"
          placeholder="自定义类型名"
        />
        <n-button
          size="small"
          :disabled="!newTypeName.trim()"
          @click="addType"
        >
          添加
        </n-button>
      </div>
    </div>
  </n-modal>

  <!-- 存为模板 -->
  <n-modal
    v-model:show="showSaveTpl"
    preset="dialog"
    title="存为百科模板"
  >
    <n-input
      v-model:value="tplName"
      placeholder="模板名称"
    />
    <label class="keep"><input
      v-model="tplSkeleton"
      type="checkbox"
    > 同时保存正文骨架（当前正文）</label>
    <template #action>
      <n-button
        type="primary"
        :disabled="!tplName.trim()"
        @click="doSaveTemplate"
      >
        保存
      </n-button>
    </template>
  </n-modal>

  <!-- [[不存在]] → 创建占位 -->
  <n-modal
    v-model:show="showCreateFromLink"
    preset="dialog"
    :title="`创建条目「${pendingLinkName}」？`"
  >
    <p class="link-hint">
      正文中链接的条目尚不存在，现在创建它？
    </p>
    <template #action>
      <n-button
        type="primary"
        @click="createFromLink"
      >
        创建
      </n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton, NInput, NSelect, NEmpty, NModal, NTag, useDialog, useMessage,
} from 'naive-ui'
import { Plus, Search, Trash2, X, FolderPlus, CopyPlus, BookmarkPlus } from 'lucide-vue-next'
import EmptyProject from '@/components/EmptyProject.vue'
import { useProjectStore, BUILTIN_CODEX_TYPES } from '@/stores/project'
import { renderMarkdown } from '@/utils/markdown'
import { codexNameUnique } from '@/utils/codex'
import { codexReferences, removeCodexCascade, type RefHit } from '@/utils/integrity'
import { DATA_PALETTE, isUsableDataColor, palettePick } from '@/utils/colors'
import { newTemplate } from '@/utils/template'
import { uuid } from '@/utils/id'
import type { CodexEntry, Template } from '@/types'

const store = useProjectStore()
const router = useRouter()
const dialog = useDialog()
const message = useMessage()

const search = ref('')
const selectedTypeId = ref<string | null>(null)
const selectedId = ref<string | null>(null)
const draft = reactive<{ name: string; typeId: string; color: string; content: string; attributes: { key: string; value: string }[] }>({
  name: '', typeId: '', color: DATA_PALETTE[2], content: '', attributes: [],
})
const showNewPicker = ref(false)
const applyTplVisible = ref(false)
const showTypeModal = ref(false)
const newTypeName = ref('')
const showSaveTpl = ref(false)
const tplName = ref('')
const tplSkeleton = ref(false)
const showCreateFromLink = ref(false)
const pendingLinkName = ref('')

const selected = computed(() => store.current?.codex.find((c) => c.id === selectedId.value) ?? null)

const groups = computed(() => {
  const types = store.current?.settings.codexTypes ?? []
  const entries = store.current?.codex ?? []
  return types.map((t) => ({ type: t, entries: entries.filter((e) => e.typeId === t.id) }))
})

const typeOptions = computed(() => (store.current?.settings.codexTypes ?? []).map((t) => ({ label: t.name, value: t.id })))

const visibleEntries = computed(() => {
  let list = store.current?.codex ?? []
  if (selectedTypeId.value) list = list.filter((e) => e.typeId === selectedTypeId.value)
  const q = search.value.trim().toLowerCase()
  if (q) list = list.filter((e) => `${e.name}\n${e.content}`.toLowerCase().includes(q))
  return list
})

const nameOk = computed(() => {
  if (!store.current) return false
  const n = draft.name.trim()
  return n.length > 0 && codexNameUnique(store.current, n, selectedId.value ?? undefined)
})

const colorUsable = computed(() => isUsableDataColor(draft.color))

const renderedContent = computed(() => renderMarkdown(draft.content))

const backlinks = computed<RefHit[]>(() => (store.current && selected.value ? codexReferences(store.current, selected.value.id) : []))

const codexTemplates = computed(() => (store.current?.templates ?? []).filter((t) => t.scope === 'codex'))

function firstColorOf(typeId: string): string {
  const e = (store.current?.codex ?? []).find((x) => x.typeId === typeId)
  return e?.color ?? palettePick(3)
}

function selectEntry(id: string): void {
  saveDraftIfChanged()
  selectedId.value = id
  loadDraft()
}

function loadDraft(): void {
  const e = selected.value
  if (!e) return
  draft.name = e.name
  draft.typeId = e.typeId
  draft.color = e.color
  draft.content = e.content
  draft.attributes = JSON.parse(JSON.stringify(e.attributes))
}

function saveDraftIfChanged(): void {
  const e = selected.value
  if (!e) return
  if (e.name === draft.name && e.typeId === draft.typeId && e.color === draft.color && e.content === draft.content
    && JSON.stringify(e.attributes) === JSON.stringify(draft.attributes)) return
  if (draft.name.trim() && codexNameUnique(store.current!, draft.name, e.id)) {
    save()
  }
}

function save(): void {
  if (!selected.value || !store.current) return
  const updated: CodexEntry = {
    ...selected.value,
    name: draft.name.trim(), typeId: draft.typeId, color: draft.color,
    content: draft.content, attributes: draft.attributes.filter((a) => a.key.trim()),
  }
  store.upsertCodex(updated)
  message.success('已保存')
}

function createEntry(tpl: Template | null): void {
  if (!store.current) return
  const typeId = selectedTypeId.value ?? store.current.settings.codexTypes[0]?.id
  if (!typeId) { message.error('请先创建条目类型'); return }
  const attributes = tpl && 'attributeKeys' in tpl.payload
    ? tpl.payload.attributeKeys.map((k) => ({ key: k, value: '' }))
    : []
  const content = tpl && 'contentSkeleton' in tpl.payload && tpl.payload.contentSkeleton ? tpl.payload.contentSkeleton : ''
  const entry: CodexEntry = {
    id: uuid(), typeId, name: `新条目 ${(store.current.codex.length + 1)}`,
    content, attributes, color: palettePick(store.current.codex.length),
  }
  store.upsertCodex(entry)
  selectedId.value = entry.id
  loadDraft()
  showNewPicker.value = false
  message.success('条目已创建，请修改名称并保存')
}

function applyTemplate(t: Template): void {
  if (!('attributeKeys' in t.payload)) return
  for (const k of t.payload.attributeKeys) {
    if (!draft.attributes.some((a) => a.key === k)) draft.attributes.push({ key: k, value: '' })
  }
  if (t.payload.contentSkeleton && !draft.content) draft.content = t.payload.contentSkeleton
  applyTplVisible.value = false
  message.success(`已插入模板「${t.name}」的属性键`)
}

function isBuiltinType(key: string): boolean {
  return BUILTIN_CODEX_TYPES.some((t) => t.key === key)
}

function addType(): void {
  if (!store.current) return
  const name = newTypeName.value.trim()
  if (!name) return
  store.current.settings.codexTypes.push({ id: uuid(), key: `custom-${uuid().slice(0, 8)}`, name })
  store.updateSettings()
  newTypeName.value = ''
}

function removeType(t: { id: string; name: string }): void {
  if (!store.current) return
  const used = store.current.codex.filter((e) => e.typeId === t.id).length
  if (used > 0) { message.warning(`类型「${t.name}」下仍有 ${used} 个条目，先移走或删除它们`); return }
  store.current.settings.codexTypes = store.current.settings.codexTypes.filter((x) => x.id !== t.id)
  store.updateSettings()
}

function saveAsTemplate(): void {
  tplName.value = `${draft.name}模板`
  tplSkeleton.value = false
  showSaveTpl.value = true
}

function doSaveTemplate(): void {
  if (!store.current || !tplName.value.trim()) return
  const tpl = newTemplate(tplName.value.trim(), 'codex', {
    attributeKeys: draft.attributes.filter((a) => a.key.trim()).map((a) => a.key),
    contentSkeleton: tplSkeleton.value ? draft.content : undefined,
  })
  store.current.templates = [...store.current.templates, tpl]
  store.updateTemplates()
  showSaveTpl.value = false
  message.success(`模板「${tpl.name}」已保存`)
}

function confirmDelete(): void {
  if (!selected.value || !store.current) return
  const targetId = selected.value.id
  const targetName = selected.value.name
  const hits = codexReferences(store.current, targetId)
  dialog.warning({
    title: '删除百科条目',
    content: hits.length
      ? `「${targetName}」被以下位置引用，删除后 [[链接]] 将转为失效占位、引用一并清理：\n${hits.map((h) => `· ${h.where}`).join('\n')}`
      : `确定删除「${targetName}」？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const data = store.current!
      const touchedEvents = data.events.filter((e) => e.locationId === targetId).map((e) => e.id)
      const touchedCodex = hits.filter((h) => h.kind === 'codex-link').map((h) => h.id)
      const touchedChars = hits.filter((h) => h.kind === 'link-block').map((h) => h.id)
      removeCodexCascade(data, targetId)
      store.mark({ kind: 'codex', id: targetId })
      for (const id of touchedEvents) store.mark({ kind: 'event', id })
      for (const id of touchedCodex) store.mark({ kind: 'codex', id })
      for (const id of touchedChars) store.mark({ kind: 'character', id })
      await store.flush()
      if (selectedId.value === targetId) selectedId.value = null
      message.success('已删除并清理引用')
    },
  })
}

/** M3-F2/E1：预览区点击 [[链接]] → 存在则跳转；不存在弹"创建此条目" */
function onPreviewClick(ev: MouseEvent): void {
  const a = (ev.target as HTMLElement).closest('a.codex-link')
  if (!a) return
  const name = a.getAttribute('data-codex-name') ?? ''
  const target = (store.current?.codex ?? []).find((c) => c.name === name)
  if (target) {
    selectEntry(target.id)
  } else {
    pendingLinkName.value = name
    showCreateFromLink.value = true
  }
}

function createFromLink(): void {
  if (!store.current) return
  const entry: CodexEntry = {
    id: uuid(), typeId: selected.value?.typeId ?? store.current.settings.codexTypes[0].id,
    name: pendingLinkName.value, content: '', attributes: [], color: palettePick(store.current.codex.length),
  }
  store.upsertCodex(entry)
  selectedId.value = entry.id
  loadDraft()
  showCreateFromLink.value = false
  message.success(`条目「${entry.name}」已创建`)
}

function jump(h: RefHit): void {
  if (h.kind === 'event-location' || h.kind === 'causal-link') {
    router.push('/timeline')
    message.info('已跳转时间轴')
  } else if (h.kind === 'link-block') {
    router.push('/characters')
    message.info('已跳转角色页')
  } else {
    selectEntry(h.id)
  }
}
</script>

<style scoped>
.codex { display: flex; gap: var(--space-2); height: 100%; }
.side { width: 200px; flex-shrink: 0; padding: var(--space-2); display: flex; flex-direction: column; gap: 10px; }
.side-head { display: flex; gap: 8px; }
.type-list { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 2px; }
.type-group { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--radius-m); cursor: pointer; font-size: 13px; }
.type-group:hover { background: var(--surface-2); }
.type-group.active { background: var(--accent-weak); color: var(--accent-text); }
.type-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.type-count { margin-left: auto; font-size: 11px; color: var(--text-3); }
.entry-list { width: 230px; flex-shrink: 0; padding: var(--space-2); display: flex; flex-direction: column; gap: 10px; }
.entries { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 2px; }
.entry-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--radius-m); cursor: pointer; font-size: 13px; }
.entry-item:hover { background: var(--surface-2); }
.entry-item.active { background: var(--accent-weak); color: var(--accent-text); }
.entry-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.detail { flex: 1; min-width: 0; padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); overflow: auto; }
.empty-detail { align-items: center; justify-content: center; }
.detail-head { display: flex; gap: 10px; align-items: center; }
.name-input { flex: 1; font-size: 17px; font-weight: 600; background: transparent; border: none; border-bottom: 2px solid var(--border); outline: none; color: var(--text-1); padding: 2px 0; min-width: 100px; }
.name-input:focus { border-color: var(--accent); }
.name-input.invalid { border-color: var(--text-3); }
.detail-ops { display: flex; gap: 6px; }
.color-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.lbl { font-size: 12px; color: var(--text-3); }
.swatch { width: 18px; height: 18px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
.swatch.active { border-color: var(--text-1); }
.custom-color { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
.custom-color input { width: 22px; height: 22px; border: none; background: transparent; cursor: pointer; padding: 0; }
.custom-color.warn span { color: var(--text-1); }
.custom-color span:empty { display: none; }
.attrs { display: flex; flex-direction: column; gap: 6px; }
.attr-row { display: flex; gap: 8px; align-items: center; }
.attr-key, .attr-val { background: var(--bg); border: 1px solid var(--border-weak); border-radius: var(--radius-s); color: var(--text-1); padding: 5px 10px; font-size: 13px; outline: none; }
.attr-key { width: 150px; flex-shrink: 0; }
.attr-val { flex: 1; }
.add-mini { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; border: 1px dashed var(--border); background: transparent; color: var(--text-3); font-size: 12px; padding: 4px 10px; border-radius: var(--radius-s); cursor: pointer; }
.add-mini:hover { color: var(--accent-text); border-color: var(--accent); }
.content-split { display: flex; gap: 10px; flex: 1; min-height: 220px; }
.content-input { flex: 1; resize: vertical; background: var(--bg); border: 1px solid var(--border-weak); border-radius: var(--radius-s); color: var(--text-1); padding: 10px; font-size: 13px; font-family: Consolas, monospace; outline: none; line-height: 1.7; }
.content-preview { flex: 1; border-left: 1px dashed var(--border); padding: 4px 8px; overflow: auto; font-size: 14px; }
.backlinks { border-top: 1px solid var(--border-weak); padding-top: 10px; }
.bl-title { font-size: 12px; color: var(--text-3); margin-bottom: 6px; }
.bl-item { font-size: 13px; color: var(--text-2); cursor: pointer; padding: 3px 0; }
.bl-item:hover { color: var(--accent-text); }
.bl-empty { font-size: 12px; color: var(--text-3); }
.save-bar { display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
.warn-text { font-size: 12px; color: var(--text-1); }
.tpl-list { display: flex; flex-direction: column; gap: 8px; max-height: 50vh; overflow: auto; }
.tpl-item { border: 1px solid var(--border-weak); border-radius: var(--radius-m); padding: 12px 14px; cursor: pointer; }
.tpl-item:hover { border-color: var(--accent); }
.tpl-item.plain { border-style: dashed; }
.tpl-name { font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
.tpl-desc { font-size: 12px; color: var(--text-3); margin-top: 4px; }
.type-manage { display: flex; flex-direction: column; gap: 6px; }
.type-row { display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 6px 0; }
.new-type { display: flex; gap: 8px; margin-top: 10px; }
.op { border: none; background: transparent; color: var(--text-3); cursor: pointer; padding: 3px; border-radius: 4px; }
.op.danger:hover { color: var(--text-1); }
.keep { display: flex; gap: 6px; margin-top: 12px; font-size: 13px; color: var(--text-2); }
.link-hint { font-size: 13px; color: var(--text-2); }
</style>
