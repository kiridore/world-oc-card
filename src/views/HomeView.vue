<template>
  <div class="home page">
    <div class="home-head">
      <h1>我的项目</h1>
      <div class="actions">
        <n-button
          type="primary"
          @click="showCreate = true"
        >
          <Plus :size="15" /> 新建项目
        </n-button>
        <n-button @click="onImport">
          <Upload :size="15" /> 导入 zip
        </n-button>
      </div>
    </div>

    <n-empty
      v-if="store.projects.length === 0"
      description="还没有项目——新建一个世界观，或导入此前导出的 zip 备份"
      class="empty"
    >
      <template #extra>
        <n-button
          type="primary"
          @click="showCreate = true"
        >
          新建项目
        </n-button>
      </template>
    </n-empty>

    <div
      v-else
      class="grid"
    >
      <div
        v-for="p in store.projects"
        :key="p.id"
        class="card panel"
        @dblclick="open(p.id)"
      >
        <div class="card-head">
          <span class="card-name">{{ p.name }}</span>
          <span class="card-time">{{ fmt(p.updatedAt) }}</span>
        </div>
        <div
          v-if="p.stats"
          class="card-stats"
        >
          <n-tag
            size="small"
            round
          >
            {{ p.stats.characters }} 角色
          </n-tag>
          <n-tag
            size="small"
            round
          >
            {{ p.stats.events }} 事件
          </n-tag>
          <n-tag
            size="small"
            round
          >
            {{ p.stats.worldlines }} 世界线
          </n-tag>
        </div>
        <div class="card-actions">
          <n-button
            size="small"
            type="primary"
            @click="open(p.id)"
          >
            打开
          </n-button>
          <n-button
            size="small"
            quaternary
            @click="rename(p)"
          >
            重命名
          </n-button>
          <n-button
            size="small"
            quaternary
            type="error"
            @click="remove(p)"
          >
            删除
          </n-button>
        </div>
      </div>
    </div>

    <n-modal
      v-model:show="showCreate"
      preset="dialog"
      title="新建项目"
    >
      <n-input
        v-model:value="newName"
        placeholder="项目名称，如：星陨大陆"
        @keyup.enter="create"
      />
      <template #action>
        <n-button
          :disabled="!newName.trim()"
          type="primary"
          @click="create"
        >
          创建
        </n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NInput, NModal, NEmpty, NTag, useDialog, useMessage } from 'naive-ui'
import { Plus, Upload } from 'lucide-vue-next'
import { useProjectStore } from '@/stores/project'
import { pickFile } from '@/utils/download'

const store = useProjectStore()
const router = useRouter()
const dialog = useDialog()
const message = useMessage()
const showCreate = ref(false)
const newName = ref('')

onMounted(() => void store.refreshProjects())

async function create(): Promise<void> {
  const name = newName.value.trim()
  if (!name) return
  const meta = await store.createProject(name)
  showCreate.value = false
  newName.value = ''
  message.success(`项目「${name}」已创建`)
  await store.openProject(meta.id)
  router.push('/characters')
}

async function open(id: string): Promise<void> {
  const ok = await store.openProject(id)
  if (ok) router.push('/characters')
  else message.error('项目不存在或已损坏')
}

function fmt(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16)
}

function rename(p: { id: string; name: string }): void {
  const nameRef = ref(p.name)
  dialog.create({
    title: '重命名项目',
    content: () => h(NInput, { value: nameRef.value, 'onUpdate:value': (v: string) => (nameRef.value = v) }),
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      if (nameRef.value.trim()) await store.renameProject(p.id, nameRef.value.trim())
    },
  })
}

function remove(p: { id: string; name: string }): void {
  dialog.warning({
    title: '删除项目',
    content: `确定删除「${p.name}」？所有角色、事件与设定将一并删除，且不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await store.deleteProject(p.id)
      message.success('已删除')
    },
  })
}

async function onImport(): Promise<void> {
  const file = await pickFile('.zip')
  if (!file) return
  const res = await store.importZip(file, 'copy')
  await store.refreshProjects()
  message.success(`已导入「${res.meta.name}」${res.warnings.length ? `（${res.warnings.length} 条警告）` : ''}`)
}
</script>

<style scoped>
.home { display: flex; flex-direction: column; gap: var(--space-3); }
.home-head { display: flex; justify-content: space-between; align-items: center; }
h1 { margin: 0; font-size: 20px; }
.actions { display: flex; gap: var(--space-1); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-2); }
.card { padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); cursor: default; }
.card-head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-2); }
.card-name { font-size: 16px; font-weight: 600; }
.card-time { font-size: 12px; color: var(--text-3); white-space: nowrap; }
.card-stats { display: flex; gap: 6px; flex-wrap: wrap; }
.card-actions { display: flex; gap: var(--space-1); margin-top: auto; }
.empty { margin-top: var(--space-5); }
</style>
