<template>
  <n-drawer
    :show="show"
    :width="420"
    @update:show="$emit('update:show', $event)"
  >
    <n-drawer-content title="模板管理">
      <div class="tpl-manager">
        <div
          v-for="(t, i) in templates"
          :key="t.id"
          class="tpl-row"
        >
          <div class="drag-ops">
            <button
              class="op"
              :disabled="i === 0"
              @click="move(i, -1)"
            >
              <ChevronUp :size="14" />
            </button>
            <button
              class="op"
              :disabled="i === templates.length - 1"
              @click="move(i, 1)"
            >
              <ChevronDown :size="14" />
            </button>
          </div>
          <div class="tpl-main">
            <input
              v-if="editingId === t.id"
              v-model="editName"
              class="rename"
              @keyup.enter="saveRename(t)"
              @blur="saveRename(t)"
            >
            <div
              v-else
              class="tpl-name"
              @dblclick="startRename(t)"
            >
              {{ t.name }} <n-tag
                v-if="t.builtin"
                size="tiny"
                round
                :bordered="false"
              >
                内置
              </n-tag>
            </div>
            <div class="tpl-meta">
              {{ scopeLabel(t.scope) }} · {{ new Date(t.createdAt).toLocaleDateString('zh-CN') }}
            </div>
          </div>
          <div class="ops">
            <button
              class="op"
              title="导出模板文件"
              @click="exportOne(t)"
            >
              <Download :size="14" />
            </button>
            <button
              class="op danger"
              title="删除"
              @click="remove(t)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
        <n-empty
          v-if="templates.length === 0"
          description="暂无模板——在角色或百科编辑器中「存为模板」"
        />
        <div class="footer">
          <n-button
            size="small"
            @click="importOne"
          >
            <Upload :size="13" /> 导入模板文件
          </n-button>
        </div>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NDrawer, NDrawerContent, NButton, NTag, NEmpty, useMessage } from 'naive-ui'
import { ChevronUp, ChevronDown, Trash2, Download, Upload } from 'lucide-vue-next'
import { useProjectStore } from '@/stores/project'
import { serializeTemplateFile, parseTemplateFile } from '@/utils/template'
import { downloadText, pickFile } from '@/utils/download'
import type { Template } from '@/types'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()
const store = useProjectStore()
const message = useMessage()

const templates = computed(() => store.current?.templates ?? [])
const editingId = ref<string | null>(null)
const editName = ref('')

function scopeLabel(s: string): string {
  return s === 'character' ? '角色' : '百科'
}

function startRename(t: Template): void {
  editingId.value = t.id
  editName.value = t.name
}

function saveRename(t: Template): void {
  if (editingId.value !== t.id) return
  editingId.value = null
  const name = editName.value.trim()
  if (!store.current || !name || name === t.name) return
  t.name = name
  store.updateTemplates()
}

function move(i: number, dir: -1 | 1): void {
  if (!store.current) return
  const list = [...store.current.templates]
  const j = i + dir
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  store.current.templates = list
  store.updateTemplates()
}

function remove(t: Template): void {
  if (!store.current) return
  store.current.templates = store.current.templates.filter((x) => x.id !== t.id)
  store.updateTemplates()
  message.success('模板已删除')
}

function exportOne(t: Template): void {
  downloadText(serializeTemplateFile(t), `${t.name}.template.json`, 'application/json')
}

async function importOne(): Promise<void> {
  const file = await pickFile('.json')
  if (!file || !store.current) return
  const parsed = parseTemplateFile(await file.text())
  if (!parsed.ok) {
    message.error(parsed.error)
    return
  }
  const tpl = { ...parsed.template, id: parsed.template.id }
  store.current.templates = [...store.current.templates, tpl]
  store.updateTemplates()
  message.success(`已导入模板「${tpl.name}」`)
}
</script>

<style scoped>
.tpl-manager { display: flex; flex-direction: column; gap: 10px; height: 100%; }
.tpl-row { display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-weak); border-radius: var(--radius-m); padding: 10px 12px; }
.tpl-main { flex: 1; min-width: 0; }
.tpl-name { font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
.tpl-meta { font-size: 12px; color: var(--text-3); margin-top: 3px; }
.rename { width: 100%; background: var(--bg); border: 1px solid var(--accent); border-radius: var(--radius-s); color: var(--text-1); padding: 3px 8px; font-size: 14px; outline: none; }
.ops, .drag-ops { display: flex; gap: 2px; }
.op { border: none; background: transparent; color: var(--text-3); cursor: pointer; padding: 4px; border-radius: 4px; display: grid; place-items: center; }
.op:hover:not(:disabled) { background: var(--surface-2); color: var(--text-1); }
.op:disabled { opacity: 0.3; }
.footer { margin-top: auto; display: flex; gap: 8px; }
</style>
