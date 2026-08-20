<template>
  <n-modal
    :show="show"
    preset="dialog"
    :title="mode === 'create' ? '选择模板起稿（可跳过）' : '从模板插入字段'"
    @update:show="$emit('update:show', $event)"
  >
    <div class="tpl-list">
      <div
        v-for="t in scoped"
        :key="t.id"
        class="tpl-item"
        @click="pick(t)"
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
          {{ describe(t) }}
        </div>
      </div>
      <div
        v-if="mode === 'create'"
        class="tpl-item plain"
        @click="$emit('update:show', false)"
      >
        <div class="tpl-name">
          跳过，直接创建空白角色
        </div>
        <div class="tpl-desc">
          只有名称，字段之后自由添加
        </div>
      </div>
      <n-empty
        v-if="scoped.length === 0 && mode === 'insert'"
        description="暂无可用模板"
        size="small"
      />
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NModal, NTag, NEmpty } from 'naive-ui'
import { useProjectStore } from '@/stores/project'
import type { Template } from '@/types'

const props = defineProps<{ show: boolean; mode: 'create' | 'insert' }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void; (e: 'pick', t: Template): void }>()
const store = useProjectStore()

const scoped = computed(() => (store.current?.templates ?? []).filter((t) => t.scope === 'character'))

function describe(t: Template): string {
  if ('fieldBlocks' in t.payload) {
    return `${t.payload.fieldBlocks.length} 个字段块` + (t.builtin ? ' · 预置结构' : '')
  }
  return '百科模板'
}

function pick(t: Template): void {
  emit('pick', t)
  emit('update:show', false)
}
</script>

<style scoped>
.tpl-list { display: flex; flex-direction: column; gap: 8px; max-height: 50vh; overflow: auto; }
.tpl-item { border: 1px solid var(--border-weak); border-radius: var(--radius-m); padding: 12px 14px; cursor: pointer; }
.tpl-item:hover { border-color: var(--accent); }
.tpl-item.plain { border-style: dashed; }
.tpl-name { font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
.tpl-desc { font-size: 12px; color: var(--text-3); margin-top: 4px; }
</style>
