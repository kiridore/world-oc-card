<template>
  <div class="block-view">
    <template
      v-for="(b, i) in blocks"
      :key="i"
    >
      <!-- 分组：递归渲染子块 -->
      <section
        v-if="b.type === 'group'"
        class="group"
      >
        <h4 class="group-title">
          {{ b.title }}
        </h4>
        <BlockView
          :blocks="b.children"
          @open-link="$emit('open-link', $event)"
        />
      </section>

      <div
        v-else-if="b.type === 'kv'"
        class="kv"
      >
        <div
          v-if="b.title"
          class="block-title"
        >
          {{ b.title }}
        </div>
        <table class="kv-table">
          <tr
            v-for="(item, j) in b.items"
            :key="j"
          >
            <td class="k">
              {{ item.key }}
            </td>
            <td class="v">
              {{ item.value }}
            </td>
          </tr>
        </table>
      </div>

      <div
        v-else-if="b.type === 'text'"
        class="text"
      >
        <div
          v-if="b.title"
          class="block-title"
        >
          {{ b.title }}
        </div>
        <div
          class="prose"
          v-html="render(b.content)"
        />
      </div>

      <div
        v-else-if="b.type === 'list'"
        class="list"
      >
        <div
          v-if="b.title"
          class="block-title"
        >
          {{ b.title }}
        </div>
        <div
          v-if="b.flag === 'tags'"
          class="tags"
        >
          <n-tag
            v-for="(t, j) in b.items"
            :key="j"
            size="small"
            round
          >
            {{ t }}
          </n-tag>
        </div>
        <ul
          v-else
          class="plain"
        >
          <li
            v-for="(t, j) in b.items"
            :key="j"
          >
            {{ t }}
          </li>
        </ul>
      </div>

      <div
        v-else-if="b.type === 'image'"
        class="image"
      >
        <div
          v-if="b.title"
          class="block-title"
        >
          {{ b.title }}
        </div>
        <AssetImage :asset-id="b.assetId" />
      </div>

      <div
        v-else-if="b.type === 'table'"
        class="table"
      >
        <div
          v-if="b.title"
          class="block-title"
        >
          {{ b.title }}
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th
                v-for="(h, j) in b.header"
                :key="j"
              >
                {{ h }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, j) in b.rows"
              :key="j"
            >
              <td
                v-for="(c, k) in row"
                :key="k"
              >
                {{ c }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-else-if="b.type === 'link'"
        class="link"
      >
        <div
          v-if="b.title"
          class="block-title"
        >
          {{ b.title }}
        </div>
        <a
          v-if="linkLabel(b) !== null"
          class="link-target"
          href="javascript:void(0)"
          @click.prevent="$emit('open-link', b)"
        >
          {{ linkLabel(b) }} <ArrowUpRight
            :size="13"
            style="vertical-align: -2px"
          />
        </a>
        <n-tag
          v-else
          type="warning"
          size="small"
          round
        >
          <span class="broken"><Unlink :size="12" /> 失效引用</span>
        </n-tag>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { NTag } from 'naive-ui'
import { ArrowUpRight, Unlink } from 'lucide-vue-next'
import { renderMarkdown } from '@/utils/markdown'
import AssetImage from '../AssetImage.vue'
import { useProjectStore } from '@/stores/project'
import type { FieldBlock } from '@/types'

defineProps<{ blocks: FieldBlock[] }>()
defineEmits<{ (e: 'open-link', block: FieldBlock): void }>()

const store = useProjectStore()
const render = renderMarkdown

function linkLabel(b: FieldBlock): string | null {
  if (b.type !== 'link') return null
  if (b.targetType === 'character') return store.characterById(b.targetId)?.name ?? null
  if (b.targetType === 'codexEntry') return store.codexById(b.targetId)?.name ?? null
  return store.eventById(b.targetId)?.title ?? null
}
</script>

<style scoped>
.block-view { display: flex; flex-direction: column; gap: var(--space-3); }
.block-title { font-size: 13px; color: var(--text-3); margin-bottom: 6px; }
.group { border-left: 3px solid var(--border); padding-left: var(--space-2); display: flex; flex-direction: column; gap: var(--space-2); }
.group-title { margin: 0 0 4px; font-size: 15px; color: var(--text-1); }
.kv-table { border-collapse: collapse; }
.kv-table td { padding: 5px 14px 5px 0; font-size: 14px; vertical-align: top; }
.kv-table .k { color: var(--text-3); white-space: nowrap; }
.kv-table .v { color: var(--text-1); }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.plain { margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.9; }
.data-table { border-collapse: collapse; }
.data-table th, .data-table td { border: 1px solid var(--border); padding: 6px 14px; font-size: 14px; text-align: left; }
.data-table th { background: var(--surface-2); font-weight: 500; }
.link-target { color: var(--accent-text); cursor: pointer; font-size: 14px; text-decoration: none; }
.link-target:hover { text-decoration: underline; }
.broken { display: inline-flex; align-items: center; gap: 4px; }
:deep(.broken-ref) { color: var(--text-3); font-style: italic; }
:deep(.codex-link) { color: var(--accent-text); cursor: pointer; }
</style>
