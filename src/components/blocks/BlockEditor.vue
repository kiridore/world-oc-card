<template>
  <div class="block-editor">
    <div
      v-for="(b, i) in modelValue"
      :key="i"
      class="block"
      :class="{ group: b.type === 'group' }"
    >
      <div class="block-head">
        <n-tag
          size="tiny"
          round
          :bordered="false"
        >
          {{ typeLabel(b.type) }}
        </n-tag>
        <input
          class="title-input"
          :value="b.title"
          placeholder="标题"
          @input="setTitle(i, ($event.target as HTMLInputElement).value)"
        >
        <div class="ops">
          <button
            class="op"
            title="上移"
            :disabled="i === 0"
            @click="move(i, -1)"
          >
            <ChevronUp :size="14" />
          </button>
          <button
            class="op"
            title="下移"
            :disabled="i === modelValue.length - 1"
            @click="move(i, 1)"
          >
            <ChevronDown :size="14" />
          </button>
          <button
            class="op danger"
            title="删除"
            @click="remove(i)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </div>

      <!-- 分组：递归编辑子块 -->
      <BlockEditor
        v-if="b.type === 'group'"
        :model-value="b.children"
        @update:model-value="(v) => patch(i, { children: v })"
      />

      <template v-else-if="b.type === 'kv'">
        <div
          v-for="(item, j) in kv(b).items"
          :key="j"
          class="kv-row"
        >
          <input
            class="kv-key"
            :value="item.key"
            placeholder="键"
            @input="patchDeep(i, (bl) => { kv(bl).items[j].key = ($event.target as HTMLInputElement).value })"
          >
          <input
            class="kv-val"
            :value="item.value"
            placeholder="值"
            @input="patchDeep(i, (bl) => { kv(bl).items[j].value = ($event.target as HTMLInputElement).value })"
          >
          <button
            class="op danger"
            @click="patchDeep(i, (bl) => { kv(bl).items.splice(j, 1) })"
          >
            <X :size="13" />
          </button>
        </div>
        <button
          class="add-mini"
          @click="patchDeep(i, (bl) => { kv(bl).items.push({ key: '', value: '' }) })"
        >
          <Plus :size="13" /> 加一行
        </button>
      </template>

      <div
        v-else-if="b.type === 'text'"
        class="md-split"
      >
        <textarea
          class="md-input"
          :value="txt(b).content"
          placeholder="支持 Markdown…"
          @input="patchDeep(i, (bl) => { txt(bl).content = ($event.target as HTMLTextAreaElement).value })"
        />
        <div
          class="md-preview prose"
          v-html="render(txt(b).content)"
        />
      </div>

      <template v-else-if="b.type === 'list'">
        <n-dynamic-tags
          v-if="lst(b).flag === 'tags'"
          :value="lst(b).items"
          @update:value="(v: string[]) => patch(i, { type: 'list', title: b.title, items: v, flag: 'tags' } as never)"
        />
        <template v-else>
          <div
            v-for="(item, j) in lst(b).items"
            :key="j"
            class="kv-row"
          >
            <input
              class="kv-val"
              :value="item"
              placeholder="条目"
              @input="patchDeep(i, (bl) => { lst(bl).items[j] = ($event.target as HTMLInputElement).value })"
            >
            <button
              class="op danger"
              @click="patchDeep(i, (bl) => { lst(bl).items.splice(j, 1) })"
            >
              <X :size="13" />
            </button>
          </div>
          <button
            class="add-mini"
            @click="patchDeep(i, (bl) => { lst(bl).items.push('') })"
          >
            <Plus :size="13" /> 加一条
          </button>
        </template>
        <label class="flag-toggle">
          <input
            type="checkbox"
            :checked="lst(b).flag === 'tags'"
            @change="patch(i, { type: 'list', title: b.title, items: lst(b).items, flag: ($event.target as HTMLInputElement).checked ? 'tags' : undefined } as never)"
          >
          用作标签块（参与列表筛选）
        </label>
      </template>

      <div
        v-else-if="b.type === 'image'"
        class="image-edit"
      >
        <AssetImage :asset-id="b.assetId" />
        <div class="image-ops">
          <n-button
            size="tiny"
            @click="uploadImage(i)"
          >
            <Upload :size="13" /> 上传图片
          </n-button>
          <span class="hint">图片存 assets 独立存储，不内联进 JSON</span>
        </div>
      </div>

      <div
        v-else-if="b.type === 'table'"
        class="table-edit"
      >
        <div class="kv-row">
          <input
            v-for="(h, j) in tbl(b).header"
            :key="j"
            class="kv-key"
            :value="h"
            :placeholder="`表头${j + 1}`"
            @input="patchDeep(i, (bl) => { tbl(bl).header[j] = ($event.target as HTMLInputElement).value })"
          >
        </div>
        <div
          v-for="(row, j) in tbl(b).rows"
          :key="j"
          class="kv-row"
        >
          <input
            v-for="(c, k) in row"
            :key="k"
            class="kv-val"
            :value="c"
            @input="patchDeep(i, (bl) => { tbl(bl).rows[j][k] = ($event.target as HTMLInputElement).value })"
          >
          <button
            class="op danger"
            @click="patchDeep(i, (bl) => { tbl(bl).rows.splice(j, 1) })"
          >
            <X :size="13" />
          </button>
        </div>
        <div class="mini-ops">
          <button
            class="add-mini"
            @click="patchDeep(i, (bl) => { tbl(bl).rows.push(tbl(bl).header.map(() => '')) })"
          >
            <Plus :size="13" /> 加行
          </button>
          <button
            class="add-mini"
            @click="patchDeep(i, (bl) => { tbl(bl).header.push(''); for (const r of tbl(bl).rows) r.push('') })"
          >
            <Plus :size="13" /> 加列
          </button>
        </div>
      </div>

      <div
        v-else-if="b.type === 'link'"
        class="link-edit"
      >
        <n-select
          size="small"
          style="width: 130px"
          :value="b.targetType"
          :options="targetTypeOptions"
          @update:value="(v) => patch(i, { targetType: v, targetId: '' } as never)"
        />
        <n-select
          size="small"
          style="flex: 1"
          :value="b.targetId || null"
          filterable
          placeholder="选择目标"
          :options="targetOptions(b.targetType)"
          @update:value="(v) => patch(i, { targetId: v ?? '' } as never)"
        />
      </div>
    </div>

    <n-dropdown
      trigger="click"
      :options="addOptions"
      @select="add"
    >
      <n-button
        size="small"
        dashed
      >
        <Plus :size="14" /> 添加字段块
      </n-button>
    </n-dropdown>
  </div>
</template>

<script setup lang="ts">
import { NTag, NButton, NDropdown, NSelect, NDynamicTags, useMessage } from 'naive-ui'
import { Plus, Trash2, ChevronUp, ChevronDown, X, Upload } from 'lucide-vue-next'
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/markdown'
import AssetImage from '../AssetImage.vue'
import { useProjectStore } from '@/stores/project'
import { uuid } from '@/utils/id'
import type { FieldBlock } from '@/types'

const props = defineProps<{ modelValue: FieldBlock[] }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: FieldBlock[]): void }>()
const store = useProjectStore()
const message = useMessage()

const TYPE_LABELS: Record<string, string> = {
  group: '分组', kv: '键值组', text: 'Markdown', list: '列表', image: '图片', table: '表格', link: '链接',
}
const typeLabel = (t: string) => TYPE_LABELS[t] ?? t

// 模板里 <template v-else-if> 包裹下不做联合窄化，用提取类型辅助
type KvBlock = Extract<FieldBlock, { type: 'kv' }>
type TextBlock = Extract<FieldBlock, { type: 'text' }>
type ListBlock = Extract<FieldBlock, { type: 'list' }>
type TableBlock = Extract<FieldBlock, { type: 'table' }>
const kv = (b: FieldBlock) => b as KvBlock
const txt = (b: FieldBlock) => b as TextBlock
const lst = (b: FieldBlock) => b as ListBlock
const tbl = (b: FieldBlock) => b as TableBlock

const addOptions = Object.entries(TYPE_LABELS).map(([value, label]) => ({ label, key: value }))

function add(type: string | number): void {
  const base: Record<string, FieldBlock> = {
    group: { type: 'group', title: '分组', children: [] },
    kv: { type: 'kv', title: '信息组', items: [{ key: '', value: '' }] },
    text: { type: 'text', title: '文本', content: '' },
    list: { type: 'list', title: '列表', items: [] },
    // assetId 占位：schema 要求非空，未上传前显示"失效引用"，上传后立即替换
    image: { type: 'image', title: '图片', assetId: uuid() },
    table: { type: 'table', title: '表格', header: ['列一', '列二'], rows: [] },
    link: { type: 'link', title: '链接', targetType: 'character', targetId: '' },
  }
  const block = base[type]
  if (!block) return
  const index = props.modelValue.length
  emit('update:modelValue', [...props.modelValue, JSON.parse(JSON.stringify(block))])
  if (block.type === 'image') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (file) {
        const meta = await store.addAsset(file)
        if (meta) patch(index, { assetId: meta.id } as never)
      } else {
        remove(index) // 用户取消选择 → 移除空图片块
      }
    }
    input.click()
  }
  if (block.type === 'link') {
    message.info('请在块内选择链接类型与目标')
  }
}

function setTitle(i: number, title: string): void { patch(i, { title }) }

function patch(i: number, part: Partial<FieldBlock>): void {
  const next = [...props.modelValue]
  next[i] = { ...next[i], ...part } as FieldBlock
  emit('update:modelValue', next)
}

function patchDeep(i: number, mutate: (b: FieldBlock) => void): void {
  const next = JSON.parse(JSON.stringify(props.modelValue)) as FieldBlock[]
  mutate(next[i])
  emit('update:modelValue', next)
}

function move(i: number, dir: -1 | 1): void {
  const j = i + dir
  if (j < 0 || j >= props.modelValue.length) return
  const next = [...props.modelValue]
  ;[next[i], next[j]] = [next[j], next[i]]
  emit('update:modelValue', next)
}

function remove(i: number): void {
  emit('update:modelValue', props.modelValue.filter((_, k) => k !== i))
}

async function uploadImage(i: number): Promise<void> {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const meta = await store.addAsset(file)
    if (meta) patch(i, { assetId: meta.id } as never)
  }
  input.click()
}

const targetTypeOptions = [
  { label: '角色', value: 'character' },
  { label: '百科条目', value: 'codexEntry' },
  { label: '事件', value: 'event' },
]

function targetOptions(t: string): { label: string; value: string }[] {
  if (t === 'character') return store.current?.characters.map((c) => ({ label: c.name, value: c.id })) ?? []
  if (t === 'codexEntry') return store.current?.codex.map((c) => ({ label: c.name, value: c.id })) ?? []
  return store.current?.events.map((e) => ({ label: e.title, value: e.id })) ?? []
}

const render = renderMarkdown
</script>

<style scoped>
.block-editor { display: flex; flex-direction: column; gap: var(--space-2); }
.block { border: 1px solid var(--border-weak); border-radius: var(--radius-m); padding: var(--space-2); background: var(--surface); display: flex; flex-direction: column; gap: 10px; }
.block.group { background: var(--surface-2); }
.block-head { display: flex; align-items: center; gap: 10px; }
.title-input { flex: 1; background: transparent; border: none; outline: none; color: var(--text-1); font-size: 14px; font-weight: 500; }
.ops { display: flex; gap: 2px; }
.op { border: none; background: transparent; color: var(--text-3); cursor: pointer; padding: 3px; border-radius: 4px; display: grid; place-items: center; }
.op:hover:not(:disabled) { background: var(--surface-2); color: var(--text-1); }
.op:disabled { opacity: 0.3; cursor: default; }
.op.danger:hover { color: var(--text-1); }
.kv-row { display: flex; gap: 8px; align-items: center; }
.kv-key, .kv-val { background: var(--bg); border: 1px solid var(--border-weak); border-radius: var(--radius-s); color: var(--text-1); padding: 5px 10px; font-size: 13px; outline: none; }
.kv-key { width: 160px; flex-shrink: 0; }
.kv-val { flex: 1; min-width: 0; }
.add-mini { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; border: 1px dashed var(--border); background: transparent; color: var(--text-3); font-size: 12px; padding: 4px 10px; border-radius: var(--radius-s); cursor: pointer; }
.add-mini:hover { color: var(--accent-text); border-color: var(--accent); }
.mini-ops { display: flex; gap: 8px; }
.md-split { display: flex; gap: 10px; }
.md-input { flex: 1; min-height: 140px; resize: vertical; background: var(--bg); border: 1px solid var(--border-weak); border-radius: var(--radius-s); color: var(--text-1); padding: 10px; font-size: 13px; font-family: Consolas, monospace; outline: none; line-height: 1.7; }
.md-preview { flex: 1; padding: 4px 8px; border-left: 1px dashed var(--border); font-size: 14px; overflow: auto; max-height: 280px; }
.image-edit { display: flex; flex-direction: column; gap: 8px; }
.image-ops { display: flex; align-items: center; gap: 10px; }
.hint { font-size: 12px; color: var(--text-3); }
.flag-toggle { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-3); cursor: pointer; }
.link-edit { display: flex; gap: 8px; }
.table-edit { display: flex; flex-direction: column; gap: 8px; }
</style>
