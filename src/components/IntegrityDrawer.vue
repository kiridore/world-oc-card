<template>
  <n-drawer
    :show="show"
    :width="460"
    @update:show="$emit('update:show', $event)"
  >
    <n-drawer-content :title="`完整性巡检${broken.length || orphans.length ? `（${broken.length} 失效引用 · ${orphans.length} 孤儿资产）` : '（全部健康）'}`">
      <div class="scan">
        <n-button
          size="small"
          type="primary"
          :loading="scanning"
          @click="scan"
        >
          重新扫描
        </n-button>

        <div
          v-if="broken.length"
          class="section"
        >
          <h4>失效引用（{{ broken.length }}）</h4>
          <div
            v-for="(b, i) in broken"
            :key="i"
            class="hit"
            @click="jump(b)"
          >
            <n-tag
              size="small"
              round
              :bordered="false"
            >
              {{ b.type }}
            </n-tag>
            <span class="where">{{ b.where }}</span>
            <span class="detail">{{ b.detail }}</span>
          </div>
        </div>

        <div
          v-if="orphans.length"
          class="section"
        >
          <h4>孤儿资产（未被任何图片块引用，{{ orphans.length }}）</h4>
          <div
            v-for="o in orphans"
            :key="o"
            class="hit"
          >
            <span class="where">{{ assetName(o) }}</span>
            <n-button
              size="tiny"
              quaternary
              type="error"
              @click="removeAsset(o)"
            >
              删除
            </n-button>
          </div>
          <n-button
            size="small"
            type="warning"
            @click="removeAllOrphans"
          >
            清理全部孤儿资产
          </n-button>
          <p class="hint">
            导出的 zip 备份默认不含孤儿资产。
          </p>
        </div>

        <n-empty
          v-if="!broken.length && !orphans.length"
          description="未发现失效引用与孤儿资产"
        />
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NDrawer, NDrawerContent, NButton, NTag, NEmpty, useMessage } from 'naive-ui'
import { useProjectStore } from '@/stores/project'
import { scanBrokenReferences, findOrphanAssets, type BrokenRef } from '@/utils/integrity'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()
const store = useProjectStore()
const router = useRouter()
const message = useMessage()

const broken = ref<BrokenRef[]>([])
const orphans = ref<string[]>([])
const scanning = ref(false)

const assetName = computed(() => (id: string) => {
  const m = store.assets.find((a) => a.id === id)
  return m ? `${m.name}（${(m.size / 1024).toFixed(0)}KB）` : id
})

function scan(): void {
  scanning.value = true
  try {
    broken.value = store.current ? scanBrokenReferences(store.current) : []
    orphans.value = store.current ? findOrphanAssets(store.current, store.assets) : []
  } finally {
    scanning.value = false
  }
}

watch(() => props.show, (v) => { if (v) scan() }, { immediate: true })

function jump(b: BrokenRef): void {
  if (b.type === '事件') router.push('/timeline')
  else if (b.type === '角色字段') router.push('/characters')
  else if (b.type === '关系' || b.type === '世界线') router.push('/timeline')
  emit('update:show', false)
}

async function removeAsset(id: string): Promise<void> {
  await store.deleteAssets([id])
  scan()
  message.success('已删除')
}

async function removeAllOrphans(): Promise<void> {
  await store.deleteAssets(orphans.value)
  scan()
  message.success(`已清理 ${orphans.value.length} 个孤儿资产`)
}
</script>

<style scoped>
.scan { display: flex; flex-direction: column; gap: var(--space-3); }
.section { display: flex; flex-direction: column; gap: 8px; }
h4 { margin: 0; font-size: 14px; }
.hit { display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-weak); border-radius: var(--radius-m); padding: 8px 12px; font-size: 13px; cursor: pointer; }
.hit:hover { border-color: var(--accent); }
.where { color: var(--text-1); }
.detail { color: var(--text-3); font-size: 12px; margin-left: auto; text-align: right; }
.hint { font-size: 12px; color: var(--text-3); margin: 4px 0 0; }
</style>
